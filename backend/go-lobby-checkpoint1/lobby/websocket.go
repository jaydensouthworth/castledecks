package lobby

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"github.com/coder/websocket"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Principal struct {
	Account string
	Expires time.Time
}

// Authenticator must validate the existing session AND the supplied CSRF binding,
// honor request context deadlines, and return no Google identity on the wire.
type Authenticator func(*http.Request, string) (Principal, error)
type SocketHandler struct {
	Origin                  string
	Room                    *Room
	Authenticate            Authenticator
	Heartbeat, WriteTimeout time.Duration
	slots                   chan struct{}
}

func NewSocketHandler(origin string, room *Room, auth Authenticator) (*SocketHandler, error) {
	u, e := url.Parse(origin)
	if e != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || room == nil || auth == nil {
		return nil, errors.New("exact HTTPS origin, room and authenticator required")
	}
	return &SocketHandler{origin, room, auth, 20 * time.Second, 5 * time.Second, make(chan struct{}, 8)}, nil
}
func (h *SocketHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	if r.Method != "GET" || r.URL.Path != "/api/lobby/"+h.Room.id || r.URL.RawQuery != "" {
		http.Error(w, "not found", 404)
		return
	}
	if r.Host != strings.TrimPrefix(h.Origin, "https://") || r.Header.Get("Origin") != h.Origin || len(r.Header.Values("Origin")) != 1 {
		http.Error(w, "origin rejected", 403)
		return
	}
	version := false
	csrf := ""
	for _, line := range r.Header.Values("Sec-WebSocket-Protocol") {
		for _, p := range strings.Split(line, ",") {
			p = strings.TrimSpace(p)
			if p == "castledecks-lobby-v1" {
				version = true
			}
			if strings.HasPrefix(p, "castledecks-csrf.") {
				if csrf != "" {
					http.Error(w, "ambiguous binding", 403)
					return
				}
				csrf = strings.TrimPrefix(p, "castledecks-csrf.")
			}
		}
	}
	if !version || len(csrf) != 43 || !identifier.MatchString(csrf) {
		http.Error(w, "protocol and binding required", 400)
		return
	}
	select {
	case h.slots <- struct{}{}:
		defer func() { <-h.slots }()
	default:
		http.Error(w, "busy", 503)
		return
	}
	authCtx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	principal, e := h.Authenticate(r.WithContext(authCtx), csrf)
	cancel()
	if e != nil || principal.Account == "" || !principal.Expires.After(time.Now()) {
		http.Error(w, "sign in required", 401)
		return
	}
	authorize, cancel := context.WithTimeout(r.Context(), time.Second)
	e = h.Room.Authorize(authorize, principal.Account)
	cancel()
	if e != nil {
		http.Error(w, "room unavailable", 403)
		return
	}
	socket, e := websocket.Accept(w, r, &websocket.AcceptOptions{Subprotocols: []string{"castledecks-lobby-v1"}, CompressionMode: websocket.CompressionDisabled})
	if e != nil {
		return
	}
	defer socket.CloseNow()
	join, cancel := context.WithTimeout(r.Context(), time.Second)
	peer, e := h.Room.Join(join, principal.Account)
	cancel()
	if e != nil {
		return
	}
	defer peer.Close()
	socket.SetReadLimit(4096)
	ctx, cancel := context.WithDeadline(context.Background(), principal.Expires)
	defer cancel()
	writerDone := make(chan struct{})
	go func() {
		defer close(writerDone)
		defer cancel()
		ticker := time.NewTicker(h.Heartbeat)
		defer ticker.Stop()
		for {
			var value any
			select {
			case <-ctx.Done():
				return
			case <-peer.Done():
				return
			case v, ok := <-peer.Acks():
				if !ok {
					return
				}
				value = v
			case v, ok := <-peer.Snapshots():
				if !ok {
					return
				}
				value = v
			case <-ticker.C:
				ping, stop := context.WithTimeout(ctx, h.WriteTimeout)
				fresh, err := h.Authenticate(r.WithContext(ping), csrf)
				if err == nil && fresh.Account == principal.Account && fresh.Expires.After(time.Now()) {
					err = socket.Ping(ping)
				} else {
					err = errors.New("session ended")
				}
				stop()
				if err != nil {
					return
				}
				continue
			}
			raw, err := json.Marshal(value)
			if err != nil {
				return
			}
			write, stop := context.WithTimeout(ctx, h.WriteTimeout)
			err = socket.Write(write, websocket.MessageText, raw)
			stop()
			if err != nil {
				return
			}
		}
	}()
	defer func() { cancel(); socket.CloseNow(); <-writerDone }()
	tokens, last := 20.0, time.Now()
	for {
		typ, raw, err := socket.Read(ctx)
		if err != nil {
			return
		}
		if typ != websocket.MessageText {
			return
		}
		now := time.Now()
		tokens += now.Sub(last).Seconds() * 10
		if tokens > 20 {
			tokens = 20
		}
		last = now
		if tokens < 1 {
			return
		}
		tokens--
		var command Command
		if decodeCommand(raw, &command) != nil {
			return
		}
		commandCtx, stop := context.WithTimeout(ctx, time.Second)
		_, err = peer.Command(commandCtx, command)
		stop()
		if err != nil {
			return
		}
	}
}
func decodeCommand(raw []byte, command *Command) error {
	d := json.NewDecoder(bytes.NewReader(raw))
	first, e := d.Token()
	if e != nil || first != json.Delim('{') {
		return errors.New("object required")
	}
	fields := map[string]bool{}
	for d.More() {
		key, e := d.Token()
		if e != nil {
			return e
		}
		name, ok := key.(string)
		if !ok || fields[name] {
			return errors.New("duplicate key")
		}
		switch name {
		case "v", "id", "sequence", "expectedRevision", "type", "ready":
		default:
			return errors.New("unknown field")
		}
		fields[name] = true
		var value json.RawMessage
		if e = d.Decode(&value); e != nil {
			return e
		}
		if string(value) == "null" {
			return errors.New("null field")
		}
	}
	if _, e = d.Token(); e != nil {
		return e
	}
	if _, e = d.Token(); e != io.EOF {
		return errors.New("trailing data")
	}
	for _, name := range []string{"v", "id", "sequence", "expectedRevision", "type"} {
		if !fields[name] {
			return errors.New("missing field")
		}
	}
	return json.Unmarshal(raw, command)
}
