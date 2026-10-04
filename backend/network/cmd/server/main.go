package main

import (
	"context"
	"errors"
	"github.com/jaydensouthworth/castledecks/backend/internal/accounts"
	"github.com/jaydensouthworth/castledecks/backend/internal/rooms"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

func run() error {
	origin := os.Getenv("PUBLIC_ORIGIN")
	if origin == "" {
		return errors.New("PUBLIC_ORIGIN required")
	}
	path := os.Getenv("DATABASE_PATH")
	if path == "" {
		path = "./data/accounts.sqlite"
	}
	if e := os.MkdirAll(filepath.Dir(path), 0700); e != nil {
		return e
	}
	f, e := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0600)
	if e != nil {
		return e
	}
	if e = f.Close(); e != nil {
		return e
	}
	store, e := accounts.OpenStore(path)
	if e != nil {
		return e
	}
	defer store.Close()
	journalPath := os.Getenv("DELETION_JOURNAL_PATH")
	if journalPath != "" {
		policy, e := accounts.LoadRecoveryPolicy(os.Getenv("RECOVERY_POLICY_FILE"))
		if e != nil {
			return errors.New("valid recovery policy file required")
		}
		j, e := accounts.OpenDeletionJournal(journalPath, policy)
		if e != nil {
			return errors.New("deletion journal unavailable")
		}
		defer j.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		e = store.ConfigureDeletionJournal(ctx, j)
		cancel()
		if e != nil {
			return errors.New("deletion journal reconciliation failed")
		}
	}

	var provider accounts.IdentityProvider
	id, secret := os.Getenv("GOOGLE_CLIENT_ID"), os.Getenv("GOOGLE_CLIENT_SECRET")
	if (id == "") != (secret == "") {
		return errors.New("both Google settings required together")
	}
	if id != "" {
		if journalPath == "" {
			return errors.New("configured deletion journal required before accounts")
		}
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		provider, e = accounts.NewGoogleProvider(ctx, id, secret, origin+"/api/auth/google/callback")
		if e != nil {
			return errors.New("Google discovery unavailable")
		}
	}
	var trusted []string
	if raw := os.Getenv("TRUSTED_PROXY_CIDRS"); raw != "" {
		trusted = strings.Split(raw, ",")
	}
	service, e := accounts.NewServer(accounts.Config{Origin: origin, Store: store, Provider: provider, TrustedProxyCIDRs: trusted, Logger: slog.Default()})
	if e != nil {
		return e
	}
	addr := os.Getenv("LISTEN_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	handler := service.Handler()
	var manager *rooms.Manager
	if os.Getenv("ENABLE_PRIVATE_ROOMS") == "true" {
		if provider == nil {
			return errors.New("private rooms require configured account provider")
		}
		manager, e = rooms.New(origin, store)
		if e != nil {
			return e
		}
		defer manager.Close()
		mux := http.NewServeMux()
		mux.Handle("/api/rooms", manager)
		mux.Handle("/api/rooms/", manager)
		mux.Handle("/api/lobby/", manager)
		mux.Handle("/", handler)
		handler = mux
	}
	server := accounts.HTTPServer(addr, handler)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	done := make(chan error, 1)
	go func() { done <- server.ListenAndServe() }()
	select {
	case e = <-done:
		if errors.Is(e, http.ErrServerClosed) {
			return nil
		}
		return e
	case <-ctx.Done():
	}
	if manager != nil {
		manager.Close()
	} // Close hijacked sockets before HTTP shutdown.
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if e = server.Shutdown(shutdown); e != nil {
		_ = server.Close()
	}
	return e
}
func main() {
	if e := run(); e != nil {
		slog.Error("server stopped", "error", e)
		os.Exit(1)
	}
}
