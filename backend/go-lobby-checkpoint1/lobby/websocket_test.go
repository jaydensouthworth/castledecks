package lobby

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/coder/websocket"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func socketFixture(t *testing.T) (*Room, *SocketHandler, *httptest.Server, *atomic.Bool) {
	t.Helper()
	room := roomFor(t)
	revoked := &atomic.Bool{}
	h, e := NewSocketHandler("https://test.invalid", room, func(r *http.Request, csrf string) (Principal, error) {
		cookie, e := r.Cookie("synthetic-session")
		if e != nil || cookie.Value != "account-a" || csrf != strings.Repeat("s", 43) || revoked.Load() {
			return Principal{}, errors.New("not signed in")
		}
		return Principal{"account-a", time.Now().Add(5 * time.Second)}, nil
	})
	if e != nil {
		t.Fatal(e)
	}
	h.Heartbeat = 20 * time.Millisecond
	h.WriteTimeout = 200 * time.Millisecond
	server := httptest.NewTLSServer(h)
	h.Origin = server.URL
	t.Cleanup(func() { room.Close(); server.Close() })
	return room, h, server, revoked
}
func socketDial(t *testing.T, h *SocketHandler, s *httptest.Server, csrf string) (*websocket.Conn, error) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	headers := http.Header{}
	headers.Set("Origin", h.Origin)
	headers.Set("Cookie", "synthetic-session=account-a")
	c, _, e := websocket.Dial(ctx, strings.Replace(s.URL, "https:", "wss:", 1)+"/api/lobby/"+h.Room.id, &websocket.DialOptions{HTTPClient: s.Client(), HTTPHeader: headers, Subprotocols: []string{"castledecks-lobby-v1", "castledecks-csrf." + csrf}})
	return c, e
}
func TestTLSIdleHeartbeatThenReady(t *testing.T) {
	_, h, s, _ := socketFixture(t)
	c, e := socketDial(t, h, s, strings.Repeat("s", 43))
	if e != nil {
		t.Fatal(e)
	}
	defer c.CloseNow()
	if c.Subprotocol() != "castledecks-lobby-v1" {
		t.Fatal("CSRF echoed")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_, raw, e := c.Read(ctx)
	if e != nil {
		t.Fatal(e)
	}
	var snap Snapshot
	if e = json.Unmarshal(raw, &snap); e != nil {
		t.Fatal(e)
	}
	result := make(chan error, 1)
	go func() { _, _, e := c.Read(ctx); result <- e }()
	select {
	case e := <-result:
		t.Fatal("healthy idle socket ended", e)
	case <-time.After(150 * time.Millisecond):
	}
	raw, _ = json.Marshal(ready(snap.NextSequence, snap.Revision, "ready-after-idle", true))
	if e = c.Write(ctx, websocket.MessageText, raw); e != nil {
		t.Fatal(e)
	}
	select {
	case e := <-result:
		if e != nil {
			t.Fatal(e)
		}
	case <-ctx.Done():
		t.Fatal("no command response")
	}
	cancel()
	c.CloseNow()
}
func TestTLSSessionBindingAndRevocation(t *testing.T) {
	_, h, s, revoked := socketFixture(t)
	if c, e := socketDial(t, h, s, strings.Repeat("x", 43)); e == nil {
		c.CloseNow()
		t.Fatal("mismatched binding")
	}
	c, e := socketDial(t, h, s, strings.Repeat("s", 43))
	if e != nil {
		t.Fatal(e)
	}
	defer c.CloseNow()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	_, _, e = c.Read(ctx)
	if e != nil {
		t.Fatal(e)
	}
	revoked.Store(true)
	if _, _, e = c.Read(ctx); e == nil {
		t.Fatal("revocation did not close socket")
	}
}
func TestFailedUpgradeKeepsExistingConnection(t *testing.T) {
	r, h, _, _ := socketFixture(t)
	c := join(t, r, "account-a")
	snap := snapshot(t, c)
	request := httptest.NewRequest("GET", h.Origin+"/api/lobby/"+r.id, nil)
	request.Header.Set("Origin", h.Origin)
	request.Header.Set("Cookie", "synthetic-session=account-a")
	request.Header.Set("Sec-WebSocket-Protocol", "castledecks-lobby-v1, castledecks-csrf."+strings.Repeat("s", 43))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, request)
	if w.Code < 400 {
		t.Fatal("upgrade expected to fail")
	}
	ack := command(t, c, ready(1, snap.Revision, "still-owned", true))
	if ack.Code != "ok" {
		t.Fatal(ack)
	}
}
func TestAuthWorkAdmittedBeforeCallback(t *testing.T) {
	r := roomFor(t)
	entered := make(chan struct{}, 32)
	var active, maximum atomic.Int32
	release := make(chan struct{})
	h, e := NewSocketHandler("https://test.invalid", r, func(request *http.Request, csrf string) (Principal, error) {
		n := active.Add(1)
		defer active.Add(-1)
		for previous := maximum.Load(); n > previous; previous = maximum.Load() {
			if maximum.CompareAndSwap(previous, n) {
				break
			}
		}
		entered <- struct{}{}
		select {
		case <-release:
			return Principal{"account-a", time.Now().Add(time.Minute)}, nil
		case <-request.Context().Done():
			return Principal{}, request.Context().Err()
		}
	})
	if e != nil {
		t.Fatal(e)
	}
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			request := httptest.NewRequest("GET", "https://test.invalid/api/lobby/"+r.id, nil)
			request.Header.Set("Origin", h.Origin)
			request.Header.Set("Sec-WebSocket-Protocol", "castledecks-lobby-v1, castledecks-csrf."+strings.Repeat("s", 43))
			h.ServeHTTP(httptest.NewRecorder(), request)
		}()
	}
	deadline := time.Now().Add(time.Second)
	for len(entered) < 8 && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if len(entered) > 8 {
		close(release)
		wg.Wait()
		t.Fatal("unbounded auth work")
	}
	close(release)
	wg.Wait()
	if maximum.Load() != 8 {
		t.Fatal("expected peak eight concurrent authentications", maximum.Load())
	}
}
func TestMalformedFramesAndOriginRejected(t *testing.T) {
	for _, raw := range []string{`{"v":1,"v":1}`, strings.Repeat("x", 5000), `{"V":1,"id":"x","sequence":1,"expectedRevision":1,"type":"start"}`} {
		t.Run(raw[:8], func(t *testing.T) {
			_, h, s, _ := socketFixture(t)
			c, e := socketDial(t, h, s, strings.Repeat("s", 43))
			if e != nil {
				t.Fatal(e)
			}
			defer c.CloseNow()
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			_, _, _ = c.Read(ctx)
			_ = c.Write(ctx, websocket.MessageText, []byte(raw))
			if _, _, e = c.Read(ctx); e == nil {
				t.Fatal("malformed frame retained connection")
			}
		})
	}
	_, h, _, _ := socketFixture(t)
	r := httptest.NewRequest("GET", h.Origin+"/api/lobby/"+h.Room.id, nil)
	r.Header.Set("Origin", "https://other.invalid")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal("origin")
	}
}
