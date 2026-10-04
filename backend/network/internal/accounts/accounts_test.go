package accounts

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func storeFor(t *testing.T) *Store {
	t.Helper()
	s, e := OpenStore(filepath.Join(t.TempDir(), "test.sqlite"))
	if e != nil {
		t.Fatal(e)
	}
	j, e := InitializeDeletionJournal(filepath.Join(t.TempDir(), "deletions.sqlite"), RecoveryPolicy{BackupHours: 24, TombstoneHours: 48, MaxRecords: 1000})
	if e != nil {
		t.Fatal(e)
	}
	if e = s.ConfigureDeletionJournal(context.Background(), j); e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { s.Close(); j.Close() })
	return s
}
func signIn(t *testing.T, s *Store, id string) (Session, string) {
	t.Helper()
	token, _ := randomToken()
	csrf, _ := randomToken()
	v, e := s.SignIn(context.Background(), "https://issuer.invalid", id, token, csrf, id, "", time.Now())
	if e != nil {
		t.Fatal(e)
	}
	return v, token
}
func fixture(t *testing.T, kind string) string {
	t.Helper()
	raw, e := os.ReadFile("testdata/" + kind + ".json")
	if e != nil {
		t.Fatal(e)
	}
	return string(raw)
}
func service(t *testing.T, s *Store, p IdentityProvider) *Server {
	t.Helper()
	v, e := NewServer(Config{Origin: "https://game.invalid", Store: s, Provider: p})
	if e != nil {
		t.Fatal(e)
	}
	return v
}
func request(t *testing.T, s *Server, method, path, token, csrf, body, revision string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, "https://game.invalid"+path, strings.NewReader(body))
	r.Header.Set("Origin", "https://game.invalid")
	r.Header.Set("Content-Type", "application/json")
	if csrf != "" {
		r.Header.Set("X-CSRF-Token", csrf)
	}
	if token != "" {
		r.AddCookie(&http.Cookie{Name: sessionCookie, Value: token})
	}
	if revision != "" {
		r.Header.Set("If-Match", revision)
	}
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, r)
	return w
}
func envelope(document string) string {
	raw, _ := json.Marshal(map[string]string{"document": document})
	return string(raw)
}
func TestSaveCASIsolationAndPersistence(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.sqlite")
	s, e := OpenStore(path)
	if e != nil {
		t.Fatal(e)
	}
	defer s.Close()
	j, e := InitializeDeletionJournal(filepath.Join(t.TempDir(), "journal.sqlite"), RecoveryPolicy{24, 48, 1000})
	if e != nil {
		t.Fatal(e)
	}
	defer j.Close()
	if e = s.ConfigureDeletionJournal(context.Background(), j); e != nil {
		t.Fatal(e)
	}
	a, _ := signIn(t, s, "a")
	b, _ := signIn(t, s, "b")
	document := fixture(t, "decks")
	var wg sync.WaitGroup
	results := make(chan error, 20)
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, e := s.PutSave(context.Background(), a.AccountID, "decks", 1, 0, document, time.Now())
			results <- e
		}()
	}
	wg.Wait()
	close(results)
	won := 0
	for e := range results {
		if e == nil {
			won++
		} else if !errors.Is(e, ErrConflict) {
			t.Fatal(e)
		}
	}
	if won != 1 {
		t.Fatal("CAS winners", won)
	}
	if _, e = s.GetSave(context.Background(), b.AccountID, "decks", 1); !errors.Is(e, ErrNotFound) {
		t.Fatal("cross-account access")
	}
	s.Close()
	s, e = OpenStore(path)
	if e != nil {
		t.Fatal(e)
	}
	if e = s.ConfigureDeletionJournal(context.Background(), j); e != nil {
		t.Fatal(e)
	}
	saved, e := s.GetSave(context.Background(), a.AccountID, "decks", 1)
	if e != nil || saved.Document != document || saved.Revision != 1 || saved.Trust != "client-reported" {
		t.Fatal(saved, e)
	}
	s.Close()
}
func TestSessionsBoundedRevokedAndHashed(t *testing.T) {
	s := storeFor(t)
	var tokens []string
	for i := 0; i < 7; i++ {
		_, token := signIn(t, s, "a")
		tokens = append(tokens, token)
	}
	for i, token := range tokens {
		_, e := s.Session(context.Background(), token, time.Now())
		if (e == nil) != (i >= 2) {
			t.Fatal("session bound", i, e)
		}
	}
	var stored string
	if e := s.db.QueryRow(`SELECT token_hash FROM sessions LIMIT 1`).Scan(&stored); e != nil {
		t.Fatal(e)
	}
	for _, token := range tokens {
		if stored == token {
			t.Fatal("plaintext session stored")
		}
	}
	_ = s.Logout(context.Background(), tokens[6])
	if _, e := s.Session(context.Background(), tokens[6], time.Now()); !errors.Is(e, ErrNotFound) {
		t.Fatal("logout")
	}
	v, _ := s.Session(context.Background(), tokens[5], time.Now())
	_, e := s.PutSave(context.Background(), v.AccountID, "decks", 1, 0, fixture(t, "decks"), time.Now())
	if e != nil {
		t.Fatal(e)
	}
	if e = s.DeleteAccount(context.Background(), v.AccountID); e != nil {
		t.Fatal(e)
	}
	if _, e = s.GetSave(context.Background(), v.AccountID, "decks", 1); !errors.Is(e, ErrNotFound) {
		t.Fatal("save not deleted")
	}
	if _, e = s.Session(context.Background(), tokens[5], time.Now()); !errors.Is(e, ErrNotFound) {
		t.Fatal("session not cascaded")
	}
}
func TestLoginStateOneShotBrowserAndExpiry(t *testing.T) {
	s := storeFor(t)
	now := time.Now()
	a := LoginAttempt{Nonce: "nonce", Verifier: "verifier", Expires: now.Add(time.Minute).Unix()}
	if e := s.CreateLogin(context.Background(), "state", "browser", a, now); e != nil {
		t.Fatal(e)
	}
	if _, e := s.ConsumeLogin(context.Background(), "state", "wrong-browser", now); !errors.Is(e, ErrNotFound) {
		t.Fatal("browser binding")
	}
	if v, e := s.ConsumeLogin(context.Background(), "state", "browser", now); e != nil || v.Nonce != "nonce" {
		t.Fatal(v, e)
	}
	if _, e := s.ConsumeLogin(context.Background(), "state", "browser", now); !errors.Is(e, ErrNotFound) {
		t.Fatal("replay")
	}
	_ = s.CreateLogin(context.Background(), "expired", "browser", a, now)
	if _, e := s.ConsumeLogin(context.Background(), "expired", "browser", now.Add(2*time.Minute)); !errors.Is(e, ErrNotFound) {
		t.Fatal("expiry")
	}
}
func TestCancelledDatabaseOperationPreservesSave(t *testing.T) {
	s := storeFor(t)
	a, _ := signIn(t, s, "a")
	doc := fixture(t, "decks")
	_, e := s.PutSave(context.Background(), a.AccountID, "decks", 1, 0, doc, time.Now())
	if e != nil {
		t.Fatal(e)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, e = s.PutSave(ctx, a.AccountID, "decks", 1, 1, "not committed", time.Now()); e == nil {
		t.Fatal("cancelled write")
	}
	v, e := s.GetSave(context.Background(), a.AccountID, "decks", 1)
	if e != nil || v.Revision != 1 || v.Document != doc {
		t.Fatal("cancelled mutation changed data")
	}
}
func TestNewerDatabaseRefused(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.sqlite")
	s, e := OpenStore(path)
	if e != nil {
		t.Fatal(e)
	}
	_, e = s.db.Exec(`INSERT INTO schema_migrations VALUES(99)`)
	if e != nil {
		t.Fatal(e)
	}
	s.Close()
	if next, e := OpenStore(path); e == nil {
		next.Close()
		t.Fatal("future database accepted")
	}
}
func TestHTTPAccountBindingCASAndSafeErrors(t *testing.T) {
	s := storeFor(t)
	a, at := signIn(t, s, "a")
	b, bt := signIn(t, s, "b")
	h := service(t, s, nil)
	if request(t, h, "GET", "/api/account", at, "", "", "").Code != 200 {
		t.Fatal("account")
	}
	if request(t, h, "GET", "/api/saves", bt, a.CSRF, "", "").Code != 403 {
		t.Fatal("stale tab binding")
	}
	for _, kind := range []string{"decks", "crownroad", "wayfarer"} {
		w := request(t, h, "PUT", "/api/saves/"+kind+"/1", at, a.CSRF, envelope(fixture(t, kind)), `"0"`)
		if w.Code != 200 {
			t.Fatal(kind, w.Code, w.Body.String())
		}
		if request(t, h, "PUT", "/api/saves/"+kind+"/1", at, a.CSRF, envelope(fixture(t, kind)), `"0"`).Code != 409 {
			t.Fatal("lost CAS")
		}
		if request(t, h, "GET", "/api/saves/"+kind+"/1", bt, b.CSRF, "", "").Code != 404 {
			t.Fatal("cross-account save")
		}
		w = request(t, h, "GET", "/api/saves/"+kind+"/1", at, a.CSRF, "", "")
		if w.Code != 200 || w.Header().Get("ETag") != `"1"` {
			t.Fatal("revision")
		}
	}
	bad := request(t, h, "PUT", "/api/saves/decks/1", at, a.CSRF, `{"document":"x","Document":"y"}`, `"1"`)
	if bad.Code != 400 || strings.Contains(bad.Body.String(), "sqlite") {
		t.Fatal("ambiguous keys or unsafe error")
	}
	if request(t, h, "DELETE", "/api/account", at, a.CSRF, `{"confirm":"wrong"}`, "").Code != 400 {
		t.Fatal("confirmation")
	}
	if request(t, h, "DELETE", "/api/account", at, a.CSRF, `{"confirm":"DELETE MY ACCOUNT"}`, "").Code != 204 {
		t.Fatal("delete")
	}
	if request(t, h, "GET", "/api/account", at, "", "", "").Code != 401 {
		t.Fatal("deleted session")
	}
}
func TestHTTPOriginDuplicateCookieAndAdmission(t *testing.T) {
	s := storeFor(t)
	a, token := signIn(t, s, "a")
	h := service(t, s, nil)
	for _, mode := range []string{"origin", "host", "cookie", "csrf", "query"} {
		r := httptest.NewRequest("POST", "https://game.invalid/api/auth/logout", nil)
		r.Header.Set("Origin", "https://game.invalid")
		r.Header.Set("X-CSRF-Token", a.CSRF)
		r.AddCookie(&http.Cookie{Name: sessionCookie, Value: token})
		switch mode {
		case "origin":
			r.Header.Set("Origin", "https://other.invalid")
		case "host":
			r.Host = "other.invalid"
		case "cookie":
			r.AddCookie(&http.Cookie{Name: sessionCookie, Value: token})
		case "csrf":
			r.Header.Add("X-CSRF-Token", a.CSRF)
		case "query":
			r.URL.RawQuery = "token=bad"
		}
		w := httptest.NewRecorder()
		h.Handler().ServeHTTP(w, r)
		if w.Code < 400 {
			t.Fatal(mode, w.Code)
		}
	}
	for i := 0; i < cap(h.slots); i++ {
		h.slots <- struct{}{}
	}
	if request(t, h, "GET", "/api/health", "", "", "", "").Code != 503 {
		t.Fatal("no admission bound")
	}
	for i := 0; i < cap(h.slots); i++ {
		<-h.slots
	}
	server := HTTPServer("127.0.0.1:0", h.Handler())
	if server.ReadHeaderTimeout <= 0 || server.ReadTimeout <= 0 || server.WriteTimeout <= 0 || server.IdleTimeout <= 0 || server.MaxHeaderBytes != 16384 {
		t.Fatal("missing HTTP limits")
	}
}

type fakeProvider struct {
	nonce, verifier string
	reject          bool
}

func (f *fakeProvider) AuthURL(state, nonce, verifier string) string {
	f.nonce = nonce
	f.verifier = verifier
	return "https://accounts.google.com/o/oauth2/v2/auth?state=" + url.QueryEscape(state)
}
func (f *fakeProvider) Exchange(ctx context.Context, code, verifier, nonce string) (Identity, error) {
	if f.reject || code != "test-code" || nonce != f.nonce || verifier != f.verifier {
		return Identity{}, errors.New("test rejected")
	}
	return Identity{"https://accounts.google.com", "synthetic-subject"}, nil
}
func TestLoginCallbackCookieAndReplay(t *testing.T) {
	s := storeFor(t)
	p := &fakeProvider{}
	h := service(t, s, p)
	start := request(t, h, "POST", "/api/auth/google/start", "", "", "", "")
	if start.Code != 200 {
		t.Fatal(start.Code, start.Body.String())
	}
	var v map[string]string
	_ = json.Unmarshal(start.Body.Bytes(), &v)
	u, _ := url.Parse(v["url"])
	state := u.Query().Get("state")
	cookie := start.Result().Cookies()[0]
	if !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteLaxMode || cookie.Path != "/" {
		t.Fatal("cookie flags")
	}
	r := httptest.NewRequest("GET", "https://game.invalid/api/auth/google/callback?state="+state+"&code=test-code", nil)
	r.AddCookie(cookie)
	w := httptest.NewRecorder()
	h.Handler().ServeHTTP(w, r)
	if w.Code != 303 || w.Header().Get("Location") != "/battle?account=connected" {
		t.Fatal(w.Code, w.Body.String())
	}
	again := httptest.NewRecorder()
	h.Handler().ServeHTTP(again, r)
	if again.Code != 400 {
		t.Fatal("callback replay")
	}
	found := false
	for _, c := range w.Result().Cookies() {
		if c.Name == sessionCookie {
			found = true
			if request(t, h, "GET", "/api/account", c.Value, "", "", "").Code != 200 {
				t.Fatal("callback session")
			}
		}
	}
	if !found {
		t.Fatal("missing session cookie")
	}
}
func TestDocumentVersionAndProvenanceBoundary(t *testing.T) {
	for _, kind := range []string{"crownroad", "wayfarer", "decks"} {
		if e := ValidateDocument(kind, fixture(t, kind)); e != nil {
			t.Fatal(kind, e)
		}
	}
	for _, raw := range []string{`{"schema":"castledecks-deck-presets-3","decks":[]}`, `{"schema":"castledecks-deck-presets-1","schema":"castledecks-deck-presets-1","decks":[]}`, `{"schema":"castledecks-deck-presets-1","decks":[]} {}`, strings.Repeat("[", 42) + strings.Repeat("]", 42), strings.Repeat("x", 32769)} {
		if ValidateDocument("decks", raw) == nil {
			t.Fatal("invalid document accepted")
		}
	}
	c := fixture(t, "crownroad")
	if !strings.Contains(c, `\"cheated\":true`) {
		t.Fatal("fixture must preserve assisted provenance")
	}
	if ValidateDocument("crownroad", strings.Replace(c, "castledecks-local-checkpoint-1", "castledecks-local-checkpoint-99", 1)) == nil {
		t.Fatal("future checkpoint accepted")
	}
}
func TestClientRateFairnessAndIPv6Grouping(t *testing.T) {
	l, _ := newLimit(nil)
	now := time.Now()
	requestFor := func(addr string) *http.Request {
		r := httptest.NewRequest("POST", "https://test.invalid", nil)
		r.RemoteAddr = addr
		return r
	}
	for i := 0; i < 3; i++ {
		if !l.allow(requestFor("192.0.2.1:44"), now) {
			t.Fatal("initial burst")
		}
	}
	if l.allow(requestFor("192.0.2.1:44"), now) {
		t.Fatal("unbounded client")
	}
	if !l.allow(requestFor("192.0.2.2:44"), now) {
		t.Fatal("single client starves victim")
	}
	for i := 0; i < 1024; i++ {
		_ = l.allow(requestFor(fmt.Sprintf("[2001:db8:1::%x]:44", i+1)), now)
	}
	if len(l.clients) != 3 {
		t.Fatal("IPv6 buckets", len(l.clients))
	}
	if !l.allow(requestFor("192.0.2.3:44"), now.Add(30*time.Second)) {
		t.Fatal("subnet churn blocked victim")
	}
}
func TestTrustedProxyBoundary(t *testing.T) {
	l, _ := newLimit([]string{"192.0.2.0/24"})
	for _, header := range []string{"", "bad", "198.51.100.1, broken", "fe80::1%eth0", strings.Repeat("198.51.100.1,", 9) + "198.51.100.1"} {
		r := httptest.NewRequest("POST", "https://test.invalid", nil)
		r.RemoteAddr = "192.0.2.1:44"
		r.Header.Set("X-Forwarded-For", header)
		if _, e := l.client(r); e == nil {
			t.Fatal("malformed chain", header)
		}
	}
	r := httptest.NewRequest("POST", "https://test.invalid", nil)
	r.RemoteAddr = "198.51.100.4:44"
	r.Header.Set("X-Forwarded-For", "192.0.2.90")
	a, e := l.client(r)
	if e != nil || a.String() != "198.51.100.4" {
		t.Fatal("untrusted forwarding")
	}
	if _, e = newLimit([]string{"0.0.0.0/0"}); e == nil {
		t.Fatal("broad trust")
	}
}
func FuzzDocumentEnvelope(f *testing.F) {
	f.Add("decks", `{"schema":"castledecks-deck-presets-1","decks":[]}`)
	f.Add("crownroad", "null")
	f.Fuzz(func(t *testing.T, kind, text string) {
		if len(text) > MaxDocument+1 {
			return
		}
		_ = ValidateDocument(kind, text)
	})
}
func TestUnknownClientsDoNotAllocateWhenGlobalBudgetEmpty(t *testing.T) {
	l, _ := newLimit(nil)
	now := time.Now()
	for i := 1; i <= 200; i++ {
		r := httptest.NewRequest("POST", "https://test.invalid", nil)
		r.RemoteAddr = fmt.Sprintf("198.51.100.%d:123", i)
		_ = l.allow(r, now)
	}
	if len(l.clients) != 10 {
		t.Fatal("global-denied clients allocated", len(l.clients))
	}
}
func TestCheckpointMetadataBounds(t *testing.T) {
	for _, field := range []string{"revision", "writtenAt", "transaction", "reason", "activeIndex", "level", "phase"} {
		t.Run(field, func(t *testing.T) {
			var v map[string]any
			_ = json.Unmarshal([]byte(fixture(t, "crownroad")), &v)
			switch field {
			case "revision":
				v[field] = 0
			case "writtenAt":
				v[field] = -1
			case "transaction":
				v[field] = "bad token"
			case "reason":
				v[field] = "live-tick"
			case "activeIndex":
				v["payload"].(map[string]any)[field] = 99
			case "level":
				v["payload"].(map[string]any)["resume"].(map[string]any)[field] = 99
			case "phase":
				v["payload"].(map[string]any)["resume"].(map[string]any)[field] = "running"
			}
			raw, _ := json.Marshal(v)
			if ValidateDocument("crownroad", string(raw)) == nil {
				t.Fatal("invalid metadata accepted")
			}
		})
	}
}
func TestDisabledProviderAndBodyBounds(t *testing.T) {
	s := storeFor(t)
	h := service(t, s, nil)
	if request(t, h, "POST", "/api/auth/google/start", "", "", "", "").Code != 503 {
		t.Fatal("disabled provider")
	}
	a, token := signIn(t, s, "a")
	if request(t, h, "PUT", "/api/saves/decks/1", token, a.CSRF, strings.Repeat("x", 6*MaxDocument+129), `"0"`).Code != 413 {
		t.Fatal("body limit")
	}
	if request(t, h, "PUT", "/api/saves/decks/1", token, a.CSRF, envelope(fixture(t, "decks")), "").Code != 428 {
		t.Fatal("missing revision")
	}
}
