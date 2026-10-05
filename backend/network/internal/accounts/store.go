package accounts

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	_ "github.com/mattn/go-sqlite3"
	"net/url"
	"path/filepath"
	"sync"
	"time"
)

var ErrConflict = errors.New("revision conflict")
var ErrCapacity = errors.New("capacity reached")
var ErrNotFound = sql.ErrNoRows

const migration = `CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,issuer TEXT NOT NULL,subject TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(issuer,subject));
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
CREATE TABLE IF NOT EXISTS login_attempts(state_hash TEXT PRIMARY KEY,browser_hash TEXT NOT NULL,nonce TEXT NOT NULL,verifier TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS saves(account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,kind TEXT NOT NULL,slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 3),revision INTEGER NOT NULL CHECK(revision>0),document TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(account_id,kind,slot));
CREATE TABLE IF NOT EXISTS deletion_binding(singleton INTEGER PRIMARY KEY CHECK(singleton=1),journal_id TEXT NOT NULL);
INSERT OR IGNORE INTO schema_migrations VALUES(1);
INSERT OR IGNORE INTO schema_migrations VALUES(2);`

type Store struct {
	db         *sql.DB
	recoveryMu sync.Mutex
	journal    *DeletionJournal
}
type Session struct {
	AccountID string `json:"id"`
	CSRF      string `json:"csrfToken"`
	Expires   int64  `json:"expiresAt"`
}
type LoginAttempt struct {
	Nonce, Verifier string
	Expires         int64
}
type Save struct {
	Kind      string `json:"kind"`
	Slot      int    `json:"slot"`
	Revision  int64  `json:"revision"`
	Document  string `json:"document,omitempty"`
	UpdatedAt int64  `json:"updatedAt"`
	Trust     string `json:"trust"`
}

func OpenStore(path string) (*Store, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	u := url.URL{Scheme: "file", Path: absolute}
	q := u.Query()
	q.Set("_foreign_keys", "on")
	q.Set("_busy_timeout", "3000")
	u.RawQuery = q.Encode()
	db, err := sql.Open("sqlite3", u.String())
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	fail := func(e error) (*Store, error) { db.Close(); return nil, e }
	var quarantined int
	if err = db.QueryRow("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='recovery_quarantine'").Scan(&quarantined); err != nil {
		return fail(err)
	}
	if quarantined != 0 {
		return fail(errors.New("quarantined recovery file cannot serve accounts"))
	}
	var exists, version int
	if err = db.QueryRow(`SELECT count(*) FROM sqlite_master WHERE type='table' AND name='schema_migrations'`).Scan(&exists); err != nil {
		return fail(err)
	}
	if exists > 0 {
		if err = db.QueryRow(`SELECT COALESCE(MAX(version),0) FROM schema_migrations`).Scan(&version); err != nil {
			return fail(err)
		}
		if version > 2 {
			return fail(errors.New("newer database schema"))
		}
	}
	if _, err = db.Exec(`PRAGMA journal_mode=WAL`); err != nil {
		return fail(err)
	}
	tx, err := db.Begin()
	if err != nil {
		return fail(err)
	}
	if _, err = tx.Exec(migration); err != nil {
		tx.Rollback()
		return fail(err)
	}
	if err = tx.Commit(); err != nil {
		return fail(err)
	}
	return &Store{db: db}, nil
}
func (s *Store) Close() error { return s.db.Close() }
func digest(v string) string  { h := sha256.Sum256([]byte(v)); return hex.EncodeToString(h[:]) }
func (s *Store) CreateLogin(ctx context.Context, state, browser string, a LoginAttempt, now time.Time) error {
	tx, e := s.db.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	if _, e = tx.ExecContext(ctx, `DELETE FROM login_attempts WHERE expires_at<=?`, now.Unix()); e != nil {
		return e
	}
	var n int
	if e = tx.QueryRowContext(ctx, `SELECT count(*) FROM login_attempts`).Scan(&n); e != nil {
		return e
	}
	if n >= 256 {
		return ErrCapacity
	}
	if _, e = tx.ExecContext(ctx, `INSERT INTO login_attempts VALUES(?,?,?,?,?)`, digest(state), digest(browser), a.Nonce, a.Verifier, a.Expires); e != nil {
		return e
	}
	return tx.Commit()
}
func (s *Store) ConsumeLogin(ctx context.Context, state, browser string, now time.Time) (LoginAttempt, error) {
	var a LoginAttempt
	e := s.db.QueryRowContext(ctx, `DELETE FROM login_attempts WHERE state_hash=? AND browser_hash=? RETURNING nonce,verifier,expires_at`, digest(state), digest(browser)).Scan(&a.Nonce, &a.Verifier, &a.Expires)
	if e == nil && a.Expires <= now.Unix() {
		e = ErrNotFound
	}
	return a, e
}
func (s *Store) SignIn(ctx context.Context, issuer, subject, token, csrf, newID, oldToken string, now time.Time) (Session, error) {
	v := Session{Expires: now.Add(12 * time.Hour).Unix(), CSRF: csrf}
	s.recoveryMu.Lock()
	defer s.recoveryMu.Unlock()
	if s.journal == nil {
		return v, ErrRecoveryUnavailable
	}
	s.journal.mu.Lock()
	_, records, inspectErr := s.journal.inspect(ctx)
	s.journal.mu.Unlock()
	if inspectErr != nil {
		return v, ErrRecoveryUnavailable
	}
	for _, r := range records {
		if r.account == newID {
			return v, ErrRecoveryUnavailable
		}
	}
	tx, e := s.db.BeginTx(ctx, nil)
	if e != nil {
		return v, e
	}
	defer tx.Rollback()
	for _, r := range records {
		if _, e = tx.ExecContext(ctx, "DELETE FROM accounts WHERE id=?", r.account); e != nil {
			return v, e
		}
	}
	if _, e = tx.ExecContext(ctx, `INSERT OR IGNORE INTO accounts VALUES(?,?,?,?)`, newID, issuer, subject, now.Unix()); e != nil {
		return v, e
	}
	if e = tx.QueryRowContext(ctx, `SELECT id FROM accounts WHERE issuer=? AND subject=?`, issuer, subject).Scan(&v.AccountID); e != nil {
		return v, e
	}
	if _, e = tx.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash=? OR expires_at<=?`, digest(oldToken), now.Unix()); e != nil {
		return v, e
	}
	if _, e = tx.ExecContext(ctx, `INSERT INTO sessions VALUES(?,?,?,?)`, digest(token), v.AccountID, csrf, v.Expires); e != nil {
		return v, e
	}
	if _, e = tx.ExecContext(ctx, `DELETE FROM sessions WHERE account_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE account_id=? ORDER BY expires_at DESC,rowid DESC LIMIT 5)`, v.AccountID, v.AccountID); e != nil {
		return v, e
	}
	return v, tx.Commit()
}
func (s *Store) Session(ctx context.Context, token string, now time.Time) (Session, error) {
	var v Session
	e := s.db.QueryRowContext(ctx, `SELECT account_id,csrf,expires_at FROM sessions WHERE token_hash=? AND expires_at>?`, digest(token), now.Unix()).Scan(&v.AccountID, &v.CSRF, &v.Expires)
	if e == nil {
		e = s.journalState(ctx, v.AccountID)
	}
	return v, e
}
func (s *Store) Logout(ctx context.Context, token string) error {
	_, e := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash=?`, digest(token))
	return e
}
func (s *Store) DeleteAccount(ctx context.Context, id string) error {
	s.recoveryMu.Lock()
	defer s.recoveryMu.Unlock()
	if s.journal == nil {
		return ErrRecoveryUnavailable
	}
	if e := s.journal.append(ctx, id, time.Now()); e != nil {
		return e
	}
	_, e := s.db.ExecContext(ctx, `DELETE FROM accounts WHERE id=?`, id)
	return e
}
func (s *Store) GetSave(ctx context.Context, id, kind string, slot int) (Save, error) {
	v := Save{Kind: kind, Slot: slot, Trust: "client-reported"}
	if e := s.journalState(ctx, id); e != nil {
		return v, e
	}
	e := s.db.QueryRowContext(ctx, `SELECT revision,document,updated_at FROM saves WHERE account_id=? AND kind=? AND slot=?`, id, kind, slot).Scan(&v.Revision, &v.Document, &v.UpdatedAt)
	return v, e
}
func (s *Store) PutSave(ctx context.Context, id, kind string, slot int, expected int64, document string, now time.Time) (Save, error) {
	v := Save{Kind: kind, Slot: slot, Revision: expected + 1, Document: document, UpdatedAt: now.Unix(), Trust: "client-reported"}
	if e := s.journalState(ctx, id); e != nil {
		return v, e
	}
	var result sql.Result
	var e error
	if expected == 0 {
		result, e = s.db.ExecContext(ctx, `INSERT INTO saves VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,kind,slot) DO NOTHING`, id, kind, slot, v.Revision, document, v.UpdatedAt)
	} else {
		result, e = s.db.ExecContext(ctx, `UPDATE saves SET revision=revision+1,document=?,updated_at=? WHERE account_id=? AND kind=? AND slot=? AND revision=?`, document, v.UpdatedAt, id, kind, slot, expected)
	}
	if e != nil {
		return v, e
	}
	n, e := result.RowsAffected()
	if e == nil && n != 1 {
		e = ErrConflict
	}
	return v, e
}
func (s *Store) ListSaves(ctx context.Context, id string) ([]Save, error) {
	if e := s.journalState(ctx, id); e != nil {
		return nil, e
	}
	rows, e := s.db.QueryContext(ctx, `SELECT kind,slot,revision,updated_at FROM saves WHERE account_id=? ORDER BY kind,slot`, id)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	result := []Save{}
	for rows.Next() {
		v := Save{Trust: "client-reported"}
		if e = rows.Scan(&v.Kind, &v.Slot, &v.Revision, &v.UpdatedAt); e != nil {
			return nil, e
		}
		result = append(result, v)
	}
	return result, rows.Err()
}
