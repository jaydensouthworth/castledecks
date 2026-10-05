package accounts

import (
	"context"
	"crypto/subtle"
	"errors"
	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
	"net/http"
	"time"
)

type Identity struct{ Issuer, Subject string }
type IdentityProvider interface {
	AuthURL(state, nonce, verifier string) string
	Exchange(context.Context, string, string, string) (Identity, error)
}
type GoogleProvider struct {
	config   oauth2.Config
	verifier *oidc.IDTokenVerifier
	client   *http.Client
	now      func() time.Time
}

func NewGoogleProvider(ctx context.Context, id, secret, redirect string) (*GoogleProvider, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	ctx = oidc.ClientContext(ctx, client)
	provider, err := oidc.NewProvider(ctx, "https://accounts.google.com")
	if err != nil {
		return nil, err
	}
	return &GoogleProvider{config: oauth2.Config{ClientID: id, ClientSecret: secret, RedirectURL: redirect, Endpoint: provider.Endpoint(), Scopes: []string{oidc.ScopeOpenID}}, verifier: provider.Verifier(&oidc.Config{ClientID: id}), client: client, now: time.Now}, nil
}
func (p *GoogleProvider) AuthURL(state, nonce, verifier string) string {
	return p.config.AuthCodeURL(state, oidc.Nonce(nonce), oauth2.S256ChallengeOption(verifier), oauth2.SetAuthURLParam("prompt", "select_account"))
}
func (p *GoogleProvider) Exchange(ctx context.Context, code, verifier, nonce string) (Identity, error) {
	ctx = oidc.ClientContext(ctx, p.client)
	token, err := p.config.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return Identity{}, errors.New("provider exchange failed")
	}
	raw, ok := token.Extra("id_token").(string)
	if !ok || len(raw) > 32768 {
		return Identity{}, errors.New("missing identity token")
	}
	id, err := verifyIdentity(ctx, p.verifier, raw, p.config.ClientID, nonce, p.now())
	if err != nil {
		return Identity{}, err
	}
	return Identity{Issuer: "https://accounts.google.com", Subject: id.Subject}, nil
}

// Token crypto, issuer, audience and expiry checks stay in maintained go-oidc.
func verifyIdentity(ctx context.Context, verifier *oidc.IDTokenVerifier, raw, clientID, nonce string, now time.Time) (*oidc.IDToken, error) {
	id, err := verifier.Verify(ctx, raw)
	if err != nil {
		return nil, errors.New("invalid identity token")
	}
	var claims struct {
		AuthorizedParty string `json:"azp"`
		IssuedAt        int64  `json:"iat"`
	}
	if err = id.Claims(&claims); err != nil {
		return nil, errors.New("invalid claims")
	}
	if id.Subject == "" || len(id.Subject) > 255 || len(nonce) != 43 || subtle.ConstantTimeCompare([]byte(id.Nonce), []byte(nonce)) != 1 || claims.IssuedAt <= 0 || claims.IssuedAt > now.Add(time.Minute).Unix() || (!id.Expiry.After(now)) || (claims.AuthorizedParty != "" && claims.AuthorizedParty != clientID) || (len(id.Audience) > 1 && claims.AuthorizedParty != clientID) {
		return nil, errors.New("identity claims rejected")
	}
	return id, nil
}
