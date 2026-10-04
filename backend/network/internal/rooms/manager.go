package rooms

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"github.com/jaydensouthworth/castledecks/backend/internal/accounts"
	"github.com/jaydensouthworth/castledecks/lobby/lobby"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const MaxRooms = 32
const MaxPairs = 128
const MaxClients = 256

type pairing struct {
	identity   accounts.RoomIdentity
	expires    time.Time
	room, host string
}
type entry struct {
	room         *lobby.Room
	socket       *lobby.SocketHandler
	owner, guest accounts.RoomIdentity
	expires      time.Time
}
type rate struct{ next, expires time.Time }
type Manager struct {
	origin            string
	store             *accounts.Store
	mu                sync.Mutex
	pairs             map[[32]byte]*pairing
	rooms             map[string]*entry
	rates             map[string]rate
	requests, sockets chan struct{}
	cancel            context.CancelFunc
	done              chan struct{}
	closed            bool
}

func New(origin string, store *accounts.Store) (*Manager, error) {
	u, e := url.Parse(origin)
	if e != nil || u.Scheme != "https" || u.Host == "" || u.Path != "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || store == nil {
		return nil, errors.New("exact HTTPS origin and store required")
	}
	ctx, cancel := context.WithCancel(context.Background())
	m := &Manager{origin: origin, store: store, pairs: map[[32]byte]*pairing{}, rooms: map[string]*entry{}, rates: map[string]rate{}, requests: make(chan struct{}, 16), sockets: make(chan struct{}, 64), cancel: cancel, done: make(chan struct{})}
	go func() {
		defer close(m.done)
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				m.sweep()
			}
		}
	}()
	return m, nil
}
func (m *Manager) Close() {
	m.cancel()
	<-m.done
	m.mu.Lock()
	defer m.mu.Unlock()
	m.closed = true
	for id := range m.rooms {
		m.remove(id)
	}
	clear(m.pairs)
}
func (m *Manager) remove(id string) {
	if room := m.rooms[id]; room != nil {
		delete(m.rooms, id)
		room.room.Close()
	}
}
func (m *Manager) sweep() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	m.mu.Lock()
	defer m.mu.Unlock()
	_ = m.cleanup(ctx)
}
func (m *Manager) cleanup(ctx context.Context) error {
	now := time.Now()
	for key, p := range m.pairs {
		if !p.expires.After(now) {
			delete(m.pairs, key)
		}
	}
	for key, r := range m.rates {
		if !r.expires.After(now) {
			delete(m.rates, key)
		}
	}
	for id, e := range m.rooms {
		if !e.expires.After(now) {
			m.remove(id)
		}
	}
	for id, e := range m.rooms {
		valid, err := m.valid(ctx, e)
		if err != nil {
			return err
		}
		if !valid {
			m.remove(id)
		}
	}
	return nil
}
func (m *Manager) valid(ctx context.Context, e *entry) (bool, error) {
	for _, identity := range []accounts.RoomIdentity{e.owner, e.guest} {
		valid, err := m.store.RoomBindingValid(ctx, identity.Binding, identity.Account, time.Now())
		if err != nil {
			return false, err
		}
		if !valid {
			return false, nil
		}
	}
	return true, nil
}
func (m *Manager) member(account string) (string, *entry) {
	for id, e := range m.rooms {
		if e.owner.Account == account || e.guest.Account == account {
			return id, e
		}
	}
	return "", nil
}
func (m *Manager) allow(account string) bool {
	now := time.Now()
	r, exists := m.rates[account]
	if r.next.After(now) || !exists && len(m.rates) >= MaxClients {
		return false
	}
	m.rates[account] = rate{now.Add(2 * time.Second), now.Add(10 * time.Minute)}
	return true
}
func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		return "", e
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
func response(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func failure(w http.ResponseWriter, status int, code string) {
	response(w, status, map[string]string{"error": code})
}
func csrfFor(r *http.Request, socket bool) string {
	if !socket {
		if len(r.Header.Values("X-CSRF-Token")) != 1 {
			return ""
		}
		return r.Header.Get("X-CSRF-Token")
	}
	value := ""
	for _, line := range r.Header.Values("Sec-WebSocket-Protocol") {
		for _, p := range strings.Split(line, ",") {
			p = strings.TrimSpace(p)
			if strings.HasPrefix(p, "castledecks-csrf.") {
				if value != "" {
					return ""
				}
				value = strings.TrimPrefix(p, "castledecks-csrf.")
			}
		}
	}
	return value
}
func pairBody(w http.ResponseWriter, r *http.Request) (string, bool) {
	media, _, e := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if e != nil || media != "application/json" {
		failure(w, 415, "json_required")
		return "", false
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 128))
	start, e := d.Token()
	if e != nil || start != json.Delim('{') {
		failure(w, 400, "invalid_request")
		return "", false
	}
	key, e := d.Token()
	var code string
	if e != nil || key != "pairCode" || d.Decode(&code) != nil || len(code) != 43 {
		failure(w, 400, "invalid_request")
		return "", false
	}
	end, e := d.Token()
	if e != nil || end != json.Delim('}') {
		failure(w, 400, "invalid_request")
		return "", false
	}
	if _, e = d.Token(); e != io.EOF {
		failure(w, 400, "invalid_request")
		return "", false
	}
	return code, true
}
func (m *Manager) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if r.Host != strings.TrimPrefix(m.origin, "https://") || r.Header.Get("Origin") != m.origin || len(r.Header.Values("Origin")) != 1 || r.Header.Get("Sec-Fetch-Site") == "cross-site" || r.URL.RawQuery != "" {
		failure(w, 403, "origin_required")
		return
	}
	socket := strings.HasPrefix(r.URL.Path, "/api/lobby/")
	admission := m.requests
	if socket {
		admission = m.sockets
	}
	select {
	case admission <- struct{}{}:
		defer func() { <-admission }()
	default:
		failure(w, 503, "busy")
		return
	}
	authCtx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	identity, e := m.store.RoomIdentity(r.WithContext(authCtx), csrfFor(r, socket), time.Now())
	cancel()
	if e != nil {
		failure(w, 401, "session_binding_required")
		return
	}
	if socket {
		m.serveSocket(w, r, identity)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	r = r.WithContext(ctx)
	code := ""
	if r.Method == "POST" && (r.URL.Path == "/api/rooms" || r.URL.Path == "/api/rooms/revoke-pair") {
		var ok bool
		code, ok = pairBody(w, r)
		if !ok {
			return
		}
	} else if r.Method == "POST" || r.Method == "DELETE" {
		raw, e := io.ReadAll(http.MaxBytesReader(w, r.Body, 1))
		if e != nil || len(raw) != 0 {
			failure(w, 400, "empty_body_required")
			return
		}
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed || ctx.Err() != nil {
		failure(w, 503, "unavailable")
		return
	}
	if e = m.cleanup(ctx); e != nil {
		failure(w, 503, "unavailable")
		return
	}
	valid, e := m.store.RoomBindingValid(ctx, identity.Binding, identity.Account, time.Now())
	if e != nil {
		failure(w, 503, "unavailable")
		return
	}
	if !valid {
		failure(w, 401, "session_binding_required")
		return
	}
	switch {
	case r.Method == "GET" && r.URL.Path == "/api/rooms/current":
		id, e := m.member(identity.Account)
		if e == nil {
			failure(w, 404, "room_unavailable")
			return
		}
		response(w, 200, map[string]any{"room": id, "protocol": 1, "expiresAt": e.expires.Unix()})
	case r.Method == "DELETE" && r.URL.Path == "/api/rooms/current":
		id, _ := m.member(identity.Account)
		if id == "" {
			w.WriteHeader(204)
			return
		}
		if len(r.Header.Values("If-Match")) != 1 || r.Header.Get("If-Match") != `"`+id+`"` {
			failure(w, 409, "room_changed")
			return
		}
		m.remove(id)
		w.WriteHeader(204)
	case r.Method == "POST" && r.URL.Path == "/api/rooms/revoke-pair":
		key := sha256.Sum256([]byte(code))
		p := m.pairs[key]
		if p != nil && p.identity.Account == identity.Account {
			if p.room != "" && m.rooms[p.room] != nil {
				failure(w, 409, "pair_already_used")
				return
			}
			delete(m.pairs, key)
		}
		w.WriteHeader(204)
	case r.Method == "POST" && r.URL.Path == "/api/rooms/pair":
		if _, e := m.member(identity.Account); e != nil {
			failure(w, 409, "already_in_room")
			return
		}
		if !m.allow(identity.Account) {
			failure(w, 429, "try_later")
			return
		}
		for key, p := range m.pairs {
			if p.identity.Account == identity.Account {
				delete(m.pairs, key)
			}
		}
		if len(m.pairs) >= MaxPairs {
			failure(w, 503, "busy")
			return
		}
		code, e := randomToken()
		if e != nil {
			failure(w, 503, "unavailable")
			return
		}
		expires := time.Now().Add(2 * time.Minute)
		if identity.Expires.Before(expires) {
			expires = identity.Expires
		}
		m.pairs[sha256.Sum256([]byte(code))] = &pairing{identity: identity, expires: expires}
		response(w, 201, map[string]any{"pairCode": code, "expiresAt": expires.Unix(), "consent": "Anyone you deliberately give this code can create one private readiness room with you until expiry. No game progress is shared."})
	case r.Method == "POST" && r.URL.Path == "/api/rooms":
		p := m.pairs[sha256.Sum256([]byte(code))]
		if p == nil || !p.expires.After(time.Now()) || p.identity.Account == identity.Account {
			failure(w, 404, "pair_unavailable")
			return
		}
		valid, e := m.store.RoomBindingValid(ctx, p.identity.Binding, p.identity.Account, time.Now())
		if e != nil {
			failure(w, 503, "unavailable")
			return
		}
		if !valid {
			failure(w, 404, "pair_unavailable")
			return
		}
		if p.room != "" {
			if p.host == identity.Account && m.rooms[p.room] != nil {
				response(w, 200, map[string]any{"room": p.room, "protocol": 1})
				return
			}
			failure(w, 404, "pair_unavailable")
			return
		}
		if !m.allow(identity.Account) {
			failure(w, 429, "try_later")
			return
		}
		if _, room := m.member(identity.Account); room != nil {
			failure(w, 409, "already_in_room")
			return
		}
		if _, room := m.member(p.identity.Account); room != nil {
			failure(w, 409, "pair_unavailable")
			return
		}
		if len(m.rooms) >= MaxRooms {
			failure(w, 503, "busy")
			return
		}
		id, e := randomToken()
		if e != nil {
			failure(w, 503, "unavailable")
			return
		}
		expires := time.Now().Add(15 * time.Minute)
		for _, expiry := range []time.Time{identity.Expires, p.identity.Expires} {
			if expiry.Before(expires) {
				expires = expiry
			}
		}
		lifetime := time.Until(expires)
		if lifetime <= 0 {
			failure(w, 401, "session_expired")
			return
		}
		room, e := lobby.NewRoom(id, identity.Account, []string{p.identity.Account}, lobby.Options{Lifetime: lifetime})
		if e != nil {
			failure(w, 503, "unavailable")
			return
		}
		handler, e := lobby.NewSocketHandler(m.origin, room, func(request *http.Request, csrf string) (lobby.Principal, error) {
			v, e := m.store.RoomIdentity(request, csrf, time.Now())
			return lobby.Principal{Account: v.Account, Expires: v.Expires}, e
		})
		if e != nil {
			room.Close()
			failure(w, 503, "unavailable")
			return
		}
		m.rooms[id] = &entry{room, handler, identity, p.identity, expires}
		p.room = id
		p.host = identity.Account
		response(w, 201, map[string]any{"room": id, "protocol": 1, "expiresAt": expires.Unix()})
	default:
		failure(w, 404, "not_found")
	}
}
func (m *Manager) serveSocket(w http.ResponseWriter, r *http.Request, identity accounts.RoomIdentity) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	m.mu.Lock()
	id := strings.TrimPrefix(r.URL.Path, "/api/lobby/")
	entry := m.rooms[id]
	if m.closed || entry == nil || !entry.expires.After(time.Now()) || identity.Account != entry.owner.Account && identity.Account != entry.guest.Account {
		m.mu.Unlock()
		failure(w, 404, "room_unavailable")
		return
	}
	valid, e := m.valid(ctx, entry)
	if e != nil {
		m.mu.Unlock()
		failure(w, 503, "unavailable")
		return
	}
	if !valid {
		m.remove(id)
		m.mu.Unlock()
		failure(w, 404, "room_unavailable")
		return
	}
	handler := entry.socket
	m.mu.Unlock()
	handler.ServeHTTP(w, r)
}
