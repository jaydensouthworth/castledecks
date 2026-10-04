package rooms

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/coder/websocket"
	"github.com/jaydensouthworth/castledecks/backend/internal/accounts"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

type testIdentity struct{ account, token, csrf string }

func setup(t *testing.T) (*Manager, *accounts.Store, *httptest.Server) {
	t.Helper()
	s, e := accounts.OpenStore(filepath.Join(t.TempDir(), "test.sqlite"))
	if e != nil {
		t.Fatal(e)
	}
	j, e := accounts.InitializeDeletionJournal(filepath.Join(t.TempDir(), "journal.sqlite"), accounts.RecoveryPolicy{BackupHours: 24, TombstoneHours: 48, MaxRecords: 1000})
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { j.Close() })
	if e = s.ConfigureDeletionJournal(context.Background(), j); e != nil {
		t.Fatal(e)
	}
	m, e := New("https://test.invalid", s)
	if e != nil {
		t.Fatal(e)
	}
	server := httptest.NewTLSServer(m)
	m.origin = server.URL
	t.Cleanup(func() { m.Close(); server.Close(); s.Close() })
	return m, s, server
}
func user(t *testing.T, s *accounts.Store, id string) testIdentity {
	t.Helper()
	token, _ := randomToken()
	csrf, _ := randomToken()
	_, e := s.SignIn(context.Background(), "https://issuer.invalid", id, token, csrf, id, "", time.Now())
	if e != nil {
		t.Fatal(e)
	}
	return testIdentity{id, token, csrf}
}
func req(m *Manager, u testIdentity, method, path, body, match string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, m.origin+path, strings.NewReader(body))
	r.Header.Set("Origin", m.origin)
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("X-CSRF-Token", u.csrf)
	if match != "" {
		r.Header.Set("If-Match", match)
	}
	r.AddCookie(&http.Cookie{Name: "__Host-castledecks-session", Value: u.token})
	w := httptest.NewRecorder()
	m.ServeHTTP(w, r)
	return w
}
func field(t *testing.T, w *httptest.ResponseRecorder, key string) string {
	t.Helper()
	var v map[string]any
	if e := json.Unmarshal(w.Body.Bytes(), &v); e != nil {
		t.Fatal(w.Code, w.Body.String())
	}
	value, _ := v[key].(string)
	return value
}
func pairCode(t *testing.T, m *Manager, u testIdentity) string {
	t.Helper()
	w := req(m, u, "POST", "/api/rooms/pair", "", "")
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	return field(t, w, "pairCode")
}
func create(t *testing.T, m *Manager, host, guest testIdentity) (string, string) {
	t.Helper()
	code := pairCode(t, m, guest)
	w := req(m, host, "POST", "/api/rooms", `{"pairCode":"`+code+`"}`, "")
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	return field(t, w, "room"), code
}
func dial(t *testing.T, m *Manager, server *httptest.Server, u testIdentity, room string) (*websocket.Conn, error) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	h := http.Header{}
	h.Set("Origin", m.origin)
	h.Set("Cookie", "__Host-castledecks-session="+u.token)
	c, _, e := websocket.Dial(ctx, strings.Replace(server.URL, "https:", "wss:", 1)+"/api/lobby/"+room, &websocket.DialOptions{HTTPClient: server.Client(), HTTPHeader: h, Subprotocols: []string{"castledecks-lobby-v1", "castledecks-csrf." + u.csrf}})
	return c, e
}
func TestPairConsentIdempotentCreateAndWithdrawal(t *testing.T) {
	m, s, _ := setup(t)
	a, b, c := user(t, s, "a"), user(t, s, "b"), user(t, s, "c")
	id, code := create(t, m, a, b)
	body := `{"pairCode":"` + code + `"}`
	w := req(m, a, "POST", "/api/rooms", body, "")
	if w.Code != 200 || field(t, w, "room") != id {
		t.Fatal("creation retry")
	}
	if req(m, c, "POST", "/api/rooms", body, "").Code != 404 {
		t.Fatal("consumed code")
	}
	if req(m, c, "GET", "/api/rooms/current", "", "").Code != 404 {
		t.Fatal("private membership")
	}
	if field(t, req(m, b, "GET", "/api/rooms/current", "", ""), "room") != id {
		t.Fatal("guest discovery")
	}
	if req(m, b, "POST", "/api/rooms/revoke-pair", body, "").Code != 409 {
		t.Fatal("used pairing requires explicit close")
	}
	if req(m, b, "DELETE", "/api/rooms/current", "", `"older-room"`).Code != 409 {
		t.Fatal("stale close accepted")
	}
	if req(m, b, "DELETE", "/api/rooms/current", "", `"`+id+`"`).Code != 204 {
		t.Fatal("guest cannot withdraw")
	}
	if req(m, a, "POST", "/api/rooms", body, "").Code != 404 {
		t.Fatal("closed room resurrected")
	}
}
func TestRealAccountSocketRevocationAndShutdown(t *testing.T) {
	m, s, server := setup(t)
	a, b, c := user(t, s, "a"), user(t, s, "b"), user(t, s, "c")
	id, _ := create(t, m, a, b)
	if socket, e := dial(t, m, server, c, id); e == nil {
		socket.CloseNow()
		t.Fatal("outsider")
	}
	bad := a
	bad.csrf = b.csrf
	if socket, e := dial(t, m, server, bad, id); e == nil {
		socket.CloseNow()
		t.Fatal("cross-session binding")
	}
	socket, e := dial(t, m, server, a, id)
	if e != nil {
		t.Fatal(e)
	}
	defer socket.CloseNow()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_, _, e = socket.Read(ctx)
	if e != nil {
		t.Fatal(e)
	}
	if socket.Subprotocol() != "castledecks-lobby-v1" {
		t.Fatal("CSRF echoed")
	}
	if e = s.Logout(context.Background(), b.token); e != nil {
		t.Fatal(e)
	}
	m.sweep()
	if _, _, e = socket.Read(ctx); e == nil {
		t.Fatal("revoked room active")
	}
	m.Close()
	if req(m, a, "GET", "/api/rooms/current", "", "").Code != 503 {
		t.Fatal("closed manager")
	}
}
func TestCancellationDoesNotRevokeUnrelatedRoom(t *testing.T) {
	m, s, _ := setup(t)
	a, b := user(t, s, "a"), user(t, s, "b")
	id, _ := create(t, m, a, b)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	m.mu.Lock()
	e := m.cleanup(ctx)
	kept := m.rooms[id] != nil
	m.mu.Unlock()
	if e == nil || !kept {
		t.Fatal("cancelled validation destroyed unrelated room", e)
	}
}
func TestConcurrentCodeConsumptionHasOneWinner(t *testing.T) {
	m, s, _ := setup(t)
	guest := user(t, s, "guest")
	code := pairCode(t, m, guest)
	users := []testIdentity{}
	for i := 0; i < 12; i++ {
		users = append(users, user(t, s, fmt.Sprint(i)))
	}
	results := make(chan int, 12)
	var wg sync.WaitGroup
	for _, u := range users {
		wg.Add(1)
		go func(u testIdentity) {
			defer wg.Done()
			results <- req(m, u, "POST", "/api/rooms", `{"pairCode":"`+code+`"}`, "").Code
		}(u)
	}
	wg.Wait()
	close(results)
	won := 0
	for status := range results {
		if status == 201 {
			won++
		} else if status != 404 {
			t.Fatal(status)
		}
	}
	if won != 1 {
		t.Fatal("creation winners", won)
	}
}
func TestPairExpiryRegenerationAndRevocation(t *testing.T) {
	for _, mode := range []string{"expiry", "logout", "deletion", "withdrawal", "regenerate"} {
		t.Run(mode, func(t *testing.T) {
			m, s, _ := setup(t)
			a, b := user(t, s, "a"), user(t, s, "b")
			code := pairCode(t, m, b)
			body := `{"pairCode":"` + code + `"}`
			switch mode {
			case "expiry":
				m.mu.Lock()
				for _, p := range m.pairs {
					p.expires = time.Now().Add(-time.Second)
				}
				m.mu.Unlock()
			case "logout":
				_ = s.Logout(context.Background(), b.token)
			case "deletion":
				_ = s.DeleteAccount(context.Background(), b.account)
			case "withdrawal":
				if req(m, b, "POST", "/api/rooms/revoke-pair", body, "").Code != 204 {
					t.Fatal("revoke")
				}
			case "regenerate":
				m.mu.Lock()
				delete(m.rates, b.account)
				m.mu.Unlock()
				_ = pairCode(t, m, b)
			}
			if req(m, a, "POST", "/api/rooms", body, "").Code != 404 {
				t.Fatal("stale pairing")
			}
		})
	}
}
func TestManagerCapsAndExpiry(t *testing.T) {
	m, s, _ := setup(t)
	for i := 0; i < MaxRooms; i++ {
		create(t, m, user(t, s, fmt.Sprint("a", i)), user(t, s, fmt.Sprint("b", i)))
	}
	a, b := user(t, s, "extra-a"), user(t, s, "extra-b")
	code := pairCode(t, m, b)
	if req(m, a, "POST", "/api/rooms", `{"pairCode":"`+code+`"}`, "").Code != 503 {
		t.Fatal("room cap")
	}
	m.mu.Lock()
	for _, e := range m.rooms {
		e.expires = time.Now().Add(-time.Second)
	}
	m.mu.Unlock()
	m.sweep()
	m.mu.Lock()
	if len(m.rooms) != 0 {
		t.Fatal("TTL")
	}
	m.mu.Unlock()
	for i := len(m.pairs); i < MaxPairs; i++ {
		pairCode(t, m, user(t, s, fmt.Sprint("pair", i)))
	}
	if req(m, user(t, s, "overflow"), "POST", "/api/rooms/pair", "", "").Code != 503 {
		t.Fatal("pair cap")
	}
	m.mu.Lock()
	for i := len(m.rates); i < MaxClients; i++ {
		m.rates[fmt.Sprint("rate", i)] = rate{time.Now(), time.Now().Add(time.Minute)}
	}
	if m.allow("new-client") {
		t.Fatal("rate map cap")
	}
	m.mu.Unlock()
}
func TestStrictControlRequestAndRate(t *testing.T) {
	m, s, _ := setup(t)
	a, b := user(t, s, "a"), user(t, s, "b")
	code := pairCode(t, m, b)
	if req(m, b, "POST", "/api/rooms/pair", "", "").Code != 429 {
		t.Fatal("burst limit")
	}
	for _, body := range []string{`{"PairCode":"` + code + `"}`, `{"pairCode":"` + code + `","pairCode":"` + code + `"}`, `{"pairCode":null}`, `{"pairCode":"` + code + `"} {}`} {
		if req(m, a, "POST", "/api/rooms", body, "").Code != 400 {
			t.Fatal("invalid envelope", body)
		}
	}
	bad := a
	bad.csrf = b.csrf
	if req(m, bad, "GET", "/api/rooms/current", "", "").Code != 401 {
		t.Fatal("wrong principal binding")
	}
	for i := 0; i < cap(m.requests); i++ {
		m.requests <- struct{}{}
	}
	if req(m, a, "GET", "/api/rooms/current", "", "").Code != 503 {
		t.Fatal("admission cap")
	}
	for i := 0; i < cap(m.requests); i++ {
		<-m.requests
	}
}
func TestAccountBackedLostAckReconnect(t *testing.T) {
	m, s, server := setup(t)
	a, b := user(t, s, "a"), user(t, s, "b")
	id, _ := create(t, m, a, b)
	c, e := dial(t, m, server, a, id)
	if e != nil {
		t.Fatal(e)
	}
	defer c.CloseNow()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	read := func(kind string) map[string]any {
		t.Helper()
		for i := 0; i < 10; i++ {
			_, raw, e := c.Read(ctx)
			if e != nil {
				t.Fatal(e)
			}
			var value map[string]any
			_ = json.Unmarshal(raw, &value)
			if value["type"] == kind {
				return value
			}
		}
		t.Fatal("missing event")
		return nil
	}
	snap := read("snapshot")
	cmd := fmt.Sprintf(`{"v":1,"id":"lost","sequence":1,"expectedRevision":%.0f,"type":"ready","ready":true}`, snap["revision"])
	if e = c.Write(ctx, websocket.MessageText, []byte(cmd)); e != nil {
		t.Fatal(e)
	}
	first := read("ack")
	c.CloseNow()
	c, e = dial(t, m, server, a, id)
	if e != nil {
		t.Fatal(e)
	}
	defer c.CloseNow()
	next := read("snapshot")
	if next["nextSequence"] != float64(2) {
		t.Fatal("missing sequence recovery")
	}
	_ = c.Write(ctx, websocket.MessageText, []byte(cmd))
	replay := read("ack")
	if fmt.Sprint(first) != fmt.Sprint(replay) {
		t.Fatal("different replay result")
	}
}
