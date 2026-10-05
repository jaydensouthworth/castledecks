package accounts

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

const sessionCookie = "__Host-castledecks-session"
const loginCookie = "__Host-castledecks-login"

type Config struct {
	Origin            string
	Store             *Store
	Provider          IdentityProvider
	TrustedProxyCIDRs []string
	Now               func() time.Time
	Logger            *slog.Logger
}
type Server struct {
	cfg                           Config
	mux                           *http.ServeMux
	slots                         chan struct{}
	limit                         *loginLimit
	requests, rejected, conflicts atomic.Uint64
}
type Stats struct {
	Requests, Rejected, Conflicts uint64
	InFlight                      int
}

func NewServer(cfg Config) (*Server, error) {
	u, e := url.Parse(cfg.Origin)
	if e != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || cfg.Store == nil {
		return nil, errors.New("exact HTTPS origin and store required")
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	if cfg.Logger == nil {
		cfg.Logger = slog.New(slog.NewJSONHandler(io.Discard, nil))
	}
	limit, e := newLimit(cfg.TrustedProxyCIDRs)
	if e != nil {
		return nil, e
	}
	s := &Server{cfg: cfg, mux: http.NewServeMux(), slots: make(chan struct{}, 16), limit: limit}
	s.mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		reply(w, 200, map[string]any{"ok": true, "protocol": 1, "accountsEnabled": cfg.Provider != nil})
	})
	s.mux.HandleFunc("GET /api/ready", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), time.Second)
		defer cancel()
		var version int
		err := cfg.Store.db.QueryRowContext(ctx, "SELECT COALESCE(MAX(version),0) FROM schema_migrations").Scan(&version)
		if cfg.Provider == nil || err != nil || version != 2 || cfg.Store.journalState(r.Context(), "readiness-probe") != nil {
			problem(w, 503, "not_ready")
			return
		}
		reply(w, 200, map[string]any{"ready": true})
	})
	s.mux.HandleFunc("POST /api/auth/google/start", s.start)
	s.mux.HandleFunc("GET /api/auth/google/callback", s.callback)
	s.mux.HandleFunc("GET /api/account", s.account)
	s.mux.HandleFunc("POST /api/auth/logout", s.logout)
	s.mux.HandleFunc("DELETE /api/account", s.deleteAccount)
	s.mux.HandleFunc("GET /api/saves", s.list)
	s.mux.HandleFunc("GET /api/saves/{kind}/{slot}", s.get)
	s.mux.HandleFunc("PUT /api/saves/{kind}/{slot}", s.put)
	return s, nil
}
func (s *Server) Stats() Stats {
	return Stats{s.requests.Load(), s.rejected.Load(), s.conflicts.Load(), len(s.slots)}
}
func (s *Server) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.requests.Add(1)
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		if r.Host != strings.TrimPrefix(s.cfg.Origin, "https://") {
			problem(w, 421, "wrong_host")
			return
		}
		select {
		case s.slots <- struct{}{}:
			defer func() { <-s.slots }()
		default:
			s.rejected.Add(1)
			problem(w, 503, "busy")
			return
		}
		callback := r.URL.Path == "/api/auth/google/callback"
		if (r.Method != "GET" && r.Method != "HEAD") && (r.Header.Get("Origin") != s.cfg.Origin || len(r.Header.Values("Origin")) != 1) {
			problem(w, 403, "origin_required")
			return
		}
		if r.Header.Get("Sec-Fetch-Site") == "cross-site" && !callback {
			problem(w, 403, "cross_site_request")
			return
		}
		if !callback && r.URL.RawQuery != "" {
			problem(w, 400, "query_not_supported")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		start := time.Now()
		defer func() {
			if recover() != nil {
				problem(w, 500, "internal_error")
			}
			s.cfg.Logger.Info("request completed", "method", r.Method, "duration_ms", time.Since(start).Milliseconds())
		}()
		s.mux.ServeHTTP(w, r.WithContext(ctx))
	})
}
func HTTPServer(addr string, h http.Handler) *http.Server {
	return &http.Server{Addr: addr, Handler: h, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 20 * time.Second, WriteTimeout: 25 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 * 1024}
}
func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		return "", e
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
func equal(a, b string) bool { return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1 }
func cookieValue(r *http.Request, name string) string {
	cookies := r.CookiesNamed(name)
	if len(cookies) != 1 {
		return ""
	}
	return cookies[0].Value
}
func setCookie(w http.ResponseWriter, name, value string, seconds int) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: value, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: seconds})
}
func reply(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func problem(w http.ResponseWriter, status int, code string) {
	reply(w, status, map[string]string{"error": code})
}
func body(w http.ResponseWriter, r *http.Request, max int64, keys ...string) (map[string]json.RawMessage, bool) {
	media, _, e := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if e != nil || media != "application/json" {
		problem(w, 415, "json_required")
		return nil, false
	}
	raw, e := io.ReadAll(http.MaxBytesReader(w, r.Body, max))
	if e != nil {
		problem(w, 413, "body_too_large")
		return nil, false
	}
	v, e := object(raw, keys...)
	if e != nil {
		problem(w, 400, "invalid_request")
		return nil, false
	}
	return v, true
}
func (s *Server) start(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Provider == nil {
		problem(w, 503, "accounts_disabled")
		return
	}
	if !s.limit.allow(r, s.cfg.Now()) {
		problem(w, 429, "try_later")
		return
	}
	raw, e := io.ReadAll(http.MaxBytesReader(w, r.Body, 1))
	if e != nil || len(raw) != 0 {
		problem(w, 400, "empty_body_required")
		return
	}
	values := make([]string, 4)
	for i := range values {
		values[i], e = randomToken()
		if e != nil {
			problem(w, 503, "unavailable")
			return
		}
	}
	state, browser, nonce, verifier := values[0], values[1], values[2], values[3]
	if e = s.cfg.Store.CreateLogin(r.Context(), state, browser, LoginAttempt{Nonce: nonce, Verifier: verifier, Expires: s.cfg.Now().Add(5 * time.Minute).Unix()}, s.cfg.Now()); e != nil {
		problem(w, 503, "unavailable")
		return
	}
	setCookie(w, loginCookie, browser, 300)
	reply(w, 200, map[string]string{"url": s.cfg.Provider.AuthURL(state, nonce, verifier)})
}
func (s *Server) callback(w http.ResponseWriter, r *http.Request) {
	q, e := url.ParseQuery(r.URL.RawQuery)
	if e != nil || len(q["state"]) != 1 || len(q.Get("state")) != 43 || len(cookieValue(r, loginCookie)) != 43 || s.cfg.Provider == nil {
		problem(w, 400, "invalid_login")
		return
	}
	a, e := s.cfg.Store.ConsumeLogin(r.Context(), q.Get("state"), cookieValue(r, loginCookie), s.cfg.Now())
	setCookie(w, loginCookie, "", -1)
	if e != nil {
		problem(w, 400, "invalid_login")
		return
	}
	if len(q["error"]) > 0 {
		http.Redirect(w, r, "/battle?account=cancelled", http.StatusSeeOther)
		return
	}
	if len(q["code"]) != 1 || len(q.Get("code")) == 0 || len(q.Get("code")) > 4096 {
		problem(w, 400, "invalid_login")
		return
	}
	identity, e := s.cfg.Provider.Exchange(r.Context(), q.Get("code"), a.Verifier, a.Nonce)
	if e != nil || identity.Issuer == "" || identity.Subject == "" {
		problem(w, 400, "invalid_login")
		return
	}
	token, e := randomToken()
	if e != nil {
		problem(w, 503, "unavailable")
		return
	}
	csrf, e := randomToken()
	if e != nil {
		problem(w, 503, "unavailable")
		return
	}
	id, e := randomToken()
	if e != nil {
		problem(w, 503, "unavailable")
		return
	}
	if _, e = s.cfg.Store.SignIn(r.Context(), identity.Issuer, identity.Subject, token, csrf, id, cookieValue(r, sessionCookie), s.cfg.Now()); e != nil {
		problem(w, 503, "unavailable")
		return
	}
	setCookie(w, sessionCookie, token, 12*60*60)
	http.Redirect(w, r, "/battle?account=connected", http.StatusSeeOther)
}
func (s *Server) auth(w http.ResponseWriter, r *http.Request, bound bool) (Session, bool) {
	token := cookieValue(r, sessionCookie)
	if len(token) != 43 {
		problem(w, 401, "sign_in_required")
		return Session{}, false
	}
	v, e := s.cfg.Store.Session(r.Context(), token, s.cfg.Now())
	if e != nil {
		status := 503
		code := "unavailable"
		if errors.Is(e, ErrNotFound) {
			status = 401
			code = "sign_in_required"
		}
		problem(w, status, code)
		return v, false
	}
	if bound && (len(r.Header.Values("X-CSRF-Token")) != 1 || !equal(v.CSRF, r.Header.Get("X-CSRF-Token"))) {
		problem(w, 403, "account_changed")
		return v, false
	}
	return v, true
}
func (s *Server) account(w http.ResponseWriter, r *http.Request) {
	v, ok := s.auth(w, r, false)
	if ok {
		reply(w, 200, v)
	}
}
func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	_, ok := s.auth(w, r, true)
	if !ok {
		return
	}
	if e := s.cfg.Store.Logout(r.Context(), cookieValue(r, sessionCookie)); e != nil {
		problem(w, 503, "unavailable")
		return
	}
	setCookie(w, sessionCookie, "", -1)
	w.WriteHeader(204)
}
func (s *Server) deleteAccount(w http.ResponseWriter, r *http.Request) {
	v, ok := s.auth(w, r, true)
	if !ok {
		return
	}
	data, ok := body(w, r, 128, "confirm")
	if !ok {
		return
	}
	if str(data["confirm"]) != "DELETE MY ACCOUNT" {
		problem(w, 400, "confirmation_required")
		return
	}
	if e := s.cfg.Store.DeleteAccount(r.Context(), v.AccountID); e != nil {
		problem(w, 503, "unavailable")
		return
	}
	setCookie(w, sessionCookie, "", -1)
	w.WriteHeader(204)
}
func savePath(w http.ResponseWriter, r *http.Request) (string, int, bool) {
	kind := r.PathValue("kind")
	slot, e := strconv.Atoi(r.PathValue("slot"))
	if e != nil || slot < 1 || slot > 3 || strconv.Itoa(slot) != r.PathValue("slot") || (kind != "crownroad" && kind != "wayfarer" && kind != "decks") {
		problem(w, 404, "not_found")
		return "", 0, false
	}
	return kind, slot, true
}
func (s *Server) list(w http.ResponseWriter, r *http.Request) {
	v, ok := s.auth(w, r, true)
	if !ok {
		return
	}
	saves, e := s.cfg.Store.ListSaves(r.Context(), v.AccountID)
	if e != nil {
		problem(w, 503, "unavailable")
		return
	}
	reply(w, 200, map[string]any{"saves": saves})
}
func (s *Server) get(w http.ResponseWriter, r *http.Request) {
	v, ok := s.auth(w, r, true)
	if !ok {
		return
	}
	kind, slot, ok := savePath(w, r)
	if !ok {
		return
	}
	save, e := s.cfg.Store.GetSave(r.Context(), v.AccountID, kind, slot)
	if e != nil {
		if errors.Is(e, ErrNotFound) {
			problem(w, 404, "not_found")
		} else {
			problem(w, 503, "unavailable")
		}
		return
	}
	w.Header().Set("ETag", `"`+strconv.FormatInt(save.Revision, 10)+`"`)
	reply(w, 200, save)
}
func (s *Server) put(w http.ResponseWriter, r *http.Request) {
	v, ok := s.auth(w, r, true)
	if !ok {
		return
	}
	kind, slot, ok := savePath(w, r)
	if !ok {
		return
	}
	match := r.Header.Get("If-Match")
	expected, e := strconv.ParseInt(strings.Trim(match, `"`), 10, 64)
	if len(r.Header.Values("If-Match")) != 1 || e != nil || expected < 0 || expected >= 9007199254740991 || match != `"`+strconv.FormatInt(expected, 10)+`"` {
		problem(w, 428, "revision_required")
		return
	}
	data, ok := body(w, r, 6*MaxDocument+128, "document")
	if !ok {
		return
	}
	document := str(data["document"])
	if ValidateDocument(kind, document) != nil {
		problem(w, 400, "invalid_document")
		return
	}
	// A newer writer may have left data this binary cannot interpret. Preserve
	// it until a capable reader can review it; CAS alone does not detect that.
	if expected > 0 {
		prior, err := s.cfg.Store.GetSave(r.Context(), v.AccountID, kind, slot)
		if errors.Is(err, ErrNotFound) || err == nil && prior.Revision != expected {
			problem(w, 409, "revision_conflict")
			return
		}
		if err != nil {
			problem(w, 503, "unavailable")
			return
		}
		if ValidateDocument(kind, prior.Document) != nil {
			problem(w, 409, "stored_document_unsupported")
			return
		}
	}
	save, e := s.cfg.Store.PutSave(r.Context(), v.AccountID, kind, slot, expected, document, s.cfg.Now())
	if e != nil {
		if errors.Is(e, ErrConflict) {
			s.conflicts.Add(1)
			problem(w, 409, "revision_conflict")
		} else {
			problem(w, 503, "unavailable")
		}
		return
	}
	w.Header().Set("ETag", `"`+strconv.FormatInt(save.Revision, 10)+`"`)
	reply(w, 200, save)
}
