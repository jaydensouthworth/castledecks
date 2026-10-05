package accounts

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"github.com/coreos/go-oidc/v3/oidc"
	jose "github.com/go-jose/go-jose/v4"
	"golang.org/x/oauth2"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestMaintainedVerifierClaims(t *testing.T) {
	key, e := rsa.GenerateKey(rand.Reader, 2048)
	if e != nil {
		t.Fatal(e)
	}
	other, e := rsa.GenerateKey(rand.Reader, 2048)
	if e != nil {
		t.Fatal(e)
	}
	keys := jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, KeyID: "synthetic", Algorithm: "RS256", Use: "sig"}}}
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _ = json.NewEncoder(w).Encode(keys) }))
	defer server.Close()
	ctx := oidc.ClientContext(context.Background(), server.Client())
	now := time.Now()
	nonce := strings.Repeat("n", 43)
	verifier := oidc.NewVerifier(server.URL, oidc.NewRemoteKeySet(ctx, server.URL+"/keys"), &oidc.Config{ClientID: "test-client", Now: func() time.Time { return now }})
	cases := []struct {
		name    string
		change  func(map[string]any)
		signing *rsa.PrivateKey
		valid   bool
	}{
		{"valid", func(map[string]any) {}, key, true}, {"issuer", func(v map[string]any) { v["iss"] = "https://other.invalid" }, key, false}, {"audience", func(v map[string]any) { v["aud"] = "other-client" }, key, false}, {"expiry", func(v map[string]any) { v["exp"] = now.Add(-time.Minute).Unix() }, key, false}, {"nonce", func(v map[string]any) { v["nonce"] = "wrong" }, key, false}, {"subject", func(v map[string]any) { v["sub"] = "" }, key, false}, {"future-issued", func(v map[string]any) { v["iat"] = now.Add(time.Hour).Unix() }, key, false}, {"multi-audience-no-azp", func(v map[string]any) { v["aud"] = []string{"test-client", "other"} }, key, false}, {"wrong-azp", func(v map[string]any) { v["azp"] = "other" }, key, false}, {"multi-audience-valid", func(v map[string]any) { v["aud"] = []string{"test-client", "other"}; v["azp"] = "test-client" }, key, true}, {"signature", func(map[string]any) {}, other, false}}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			claims := map[string]any{"iss": server.URL, "aud": "test-client", "sub": "synthetic-subject", "exp": now.Add(time.Hour).Unix(), "iat": now.Unix(), "nonce": nonce}
			c.change(claims)
			raw, _ := json.Marshal(claims)
			signer, e := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: jose.JSONWebKey{Key: c.signing, KeyID: "synthetic"}}, nil)
			if e != nil {
				t.Fatal(e)
			}
			signed, e := signer.Sign(raw)
			if e != nil {
				t.Fatal(e)
			}
			compact, e := signed.CompactSerialize()
			if e != nil {
				t.Fatal(e)
			}
			_, e = verifyIdentity(ctx, verifier, compact, "test-client", nonce, now)
			if (e == nil) != c.valid {
				t.Fatal("claim outcome", e)
			}
		})
	}
}
func TestGoogleAuthorizationPKCEAndScope(t *testing.T) {
	p := &GoogleProvider{config: oauth2.Config{ClientID: "synthetic-client", RedirectURL: "https://game.invalid/api/auth/google/callback", Scopes: []string{oidc.ScopeOpenID}, Endpoint: oauth2.Endpoint{AuthURL: "https://accounts.google.com/o/oauth2/v2/auth"}}}
	verifier := strings.Repeat("v", 43)
	u, e := url.Parse(p.AuthURL("state", "nonce", verifier))
	if e != nil {
		t.Fatal(e)
	}
	q := u.Query()
	if q.Get("scope") != "openid" || q.Get("code_challenge_method") != "S256" || q.Get("code_challenge") == verifier || q.Get("code_challenge") == "" || q.Get("nonce") != "nonce" || q.Get("state") != "state" || q.Get("prompt") != "select_account" || q.Get("access_type") == "offline" {
		t.Fatal("authorization contract", q)
	}
}
func TestLocalTLSCodeExchangeUsesPKCEAndVerifiedIDToken(t *testing.T) {
	key, e := rsa.GenerateKey(rand.Reader, 2048)
	if e != nil {
		t.Fatal(e)
	}
	nonce := strings.Repeat("n", 43)
	pkce := strings.Repeat("v", 43)
	var rawToken string
	called := false
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/keys" {
			_ = json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, KeyID: "synthetic", Algorithm: "RS256", Use: "sig"}}})
			return
		}
		if r.URL.Path != "/token" {
			http.NotFound(w, r)
			return
		}
		_ = r.ParseForm()
		if r.Form.Get("code_verifier") != pkce || r.Form.Get("code") != "test-code" || r.Form.Get("grant_type") != "authorization_code" {
			http.Error(w, "bad exchange", 400)
			return
		}
		called = true
		_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "synthetic-unused-token", "token_type": "Bearer", "expires_in": 300, "id_token": rawToken})
	}))
	defer server.Close()
	now := time.Now()
	claims, _ := json.Marshal(map[string]any{"iss": server.URL, "aud": "test-client", "sub": "synthetic", "exp": now.Add(time.Hour).Unix(), "iat": now.Unix(), "nonce": nonce})
	signer, _ := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: jose.JSONWebKey{Key: key, KeyID: "synthetic"}}, nil)
	signed, _ := signer.Sign(claims)
	rawToken, _ = signed.CompactSerialize()
	ctx := oidc.ClientContext(context.Background(), server.Client())
	p := &GoogleProvider{config: oauth2.Config{ClientID: "test-client", ClientSecret: "fake-test-secret", RedirectURL: "https://game.invalid/api/auth/google/callback", Endpoint: oauth2.Endpoint{TokenURL: server.URL + "/token"}}, verifier: oidc.NewVerifier(server.URL, oidc.NewRemoteKeySet(ctx, server.URL+"/keys"), &oidc.Config{ClientID: "test-client"}), client: server.Client(), now: time.Now}
	id, e := p.Exchange(ctx, "test-code", pkce, nonce)
	if e != nil || !called || id.Subject != "synthetic" {
		t.Fatal("exchange", id, e)
	}
	if _, e = p.Exchange(ctx, "test-code", pkce, strings.Repeat("x", 43)); e == nil {
		t.Fatal("mismatched nonce accepted")
	}
}
