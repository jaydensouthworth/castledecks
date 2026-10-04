package accounts

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"time"
)

type RecoveryBackup struct {
	Status    string         `json:"status"`
	JournalID string         `json:"journalId"`
	CreatedAt int64          `json:"createdAt"`
	SHA256    string         `json:"sha256"`
	Schema    int            `json:"schema"`
	Policy    RecoveryPolicy `json:"policy"`
}

func fileHash(path string) (string, error) {
	f, e := os.Open(path)
	if e != nil {
		return "", e
	}
	defer f.Close()
	h := sha256.New()
	if _, e = io.Copy(h, f); e != nil {
		return "", e
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func tempCopyPath(destination string) (string, error) {
	if _, e := os.Lstat(destination); !os.IsNotExist(e) {
		return "", errors.New("destination must be new")
	}
	f, e := os.CreateTemp(filepath.Dir(destination), ".recovery-*")
	if e != nil {
		return "", e
	}
	name := f.Name()
	e = f.Close()
	return name, e
}
func publishCopy(temporary, destination string) error {
	f, e := os.Open(temporary)
	if e != nil {
		return e
	}
	e = f.Sync()
	f.Close()
	if e != nil {
		return e
	}
	if e = os.Link(temporary, destination); e != nil {
		return e
	}
	d, e := os.Open(filepath.Dir(destination))
	if e != nil {
		return e
	}
	defer d.Close()
	return d.Sync()
}
func scrubCopy(ctx context.Context, path, journalID string, records []deletionRecord) error {
	db, e := journalDB(path, false)
	if e != nil {
		return e
	}
	defer db.Close()
	var version int
	if e = db.QueryRowContext(ctx, "SELECT max(version) FROM schema_migrations").Scan(&version); e != nil || version != 2 {
		return ErrRecoveryUnavailable
	}
	var bound string
	if e = db.QueryRowContext(ctx, "SELECT journal_id FROM deletion_binding WHERE singleton=1").Scan(&bound); e != nil || bound != journalID {
		return ErrRecoveryUnavailable
	}
	if _, e = db.ExecContext(ctx, "PRAGMA foreign_keys=ON;PRAGMA secure_delete=ON"); e != nil {
		return e
	}
	tx, e := db.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	for _, r := range records {
		if _, e = tx.ExecContext(ctx, "DELETE FROM accounts WHERE id=?", r.account); e != nil {
			return e
		}
	}
	if _, e = tx.ExecContext(ctx, "DELETE FROM sessions;DELETE FROM login_attempts;CREATE TABLE IF NOT EXISTS recovery_quarantine(status TEXT NOT NULL);DELETE FROM recovery_quarantine;INSERT INTO recovery_quarantine VALUES('QUARANTINED')"); e != nil {
		return e
	}
	if e = tx.Commit(); e != nil {
		return e
	}
	if _, e = db.ExecContext(ctx, "VACUUM"); e != nil {
		return e
	}
	var integrity string
	if e = db.QueryRowContext(ctx, "PRAGMA integrity_check").Scan(&integrity); e != nil || integrity != "ok" {
		return ErrRecoveryUnavailable
	}
	rows, e := db.QueryContext(ctx, "PRAGMA foreign_key_check")
	if e != nil {
		return e
	}
	defer rows.Close()
	if rows.Next() {
		return ErrRecoveryUnavailable
	}
	return rows.Err()
}
func (s *Store) CreateRecoveryBackup(ctx context.Context, destination string, now time.Time) (RecoveryBackup, error) {
	s.recoveryMu.Lock()
	defer s.recoveryMu.Unlock()
	var result RecoveryBackup
	j := s.journal
	if j == nil {
		return result, ErrRecoveryUnavailable
	}
	j.mu.Lock()
	defer j.mu.Unlock()
	a, records, e := j.inspect(ctx)
	if e != nil {
		return result, e
	}
	last := a.FloorTime
	if len(records) > 0 {
		last = records[len(records)-1].at
	}
	if now.Unix() < last {
		return result, ErrRetention
	}
	temporary, e := tempCopyPath(destination)
	if e != nil {
		return result, e
	}
	defer os.Remove(temporary)
	if _, e = s.db.ExecContext(ctx, "VACUUM INTO ?", temporary); e != nil {
		return result, e
	}
	if e = scrubCopy(ctx, temporary, a.ID, records); e != nil {
		return result, e
	}
	hash, e := fileHash(temporary)
	if e != nil {
		return result, e
	}
	if e = publishCopy(temporary, destination); e != nil {
		return result, e
	}
	return RecoveryBackup{"QUARANTINED", a.ID, now.Unix(), hash, 2, j.policy}, nil
}

// Restore produces a NEW quarantined candidate. Startup must reconcile again:
// deletion may occur after this function returns and before operator activation.
func (j *DeletionJournal) restoreCopy(ctx context.Context, backup, destination string, m RecoveryBackup, expected JournalAnchor, now time.Time, prepare bool) (RecoveryBackup, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	a, records, e := j.inspect(ctx)
	if e != nil {
		return RecoveryBackup{}, e
	}
	if a != expected || m.Status != map[bool]string{false: "QUARANTINED", true: "RECONCILED_QUARANTINE"}[prepare] || m.JournalID != a.ID || m.Policy != j.policy || m.Schema != 2 || m.CreatedAt > now.Unix() || m.CreatedAt < now.Add(-time.Duration(j.policy.BackupHours)*time.Hour).Unix() || m.CreatedAt < a.FloorTime {
		return RecoveryBackup{}, ErrRetention
	}
	hash, e := fileHash(backup)
	if e != nil || hash != m.SHA256 {
		return RecoveryBackup{}, ErrRecoveryUnavailable
	}
	temporary, e := tempCopyPath(destination)
	if e != nil {
		return RecoveryBackup{}, e
	}
	defer os.Remove(temporary)
	// Read-only open: never repair, migrate or rewrite the backup being restored.
	db, e := readOnlyRecoveryDB(backup)
	if e != nil {
		return RecoveryBackup{}, e
	}
	_, e = db.ExecContext(ctx, "VACUUM INTO ?", temporary)
	db.Close()
	if e != nil {
		return RecoveryBackup{}, e
	}
	if e = scrubCopy(ctx, temporary, a.ID, records); e != nil {
		return RecoveryBackup{}, e
	}
	if prepare {
		db, e := journalDB(temporary, false)
		if e != nil {
			return RecoveryBackup{}, e
		}
		_, e = db.ExecContext(ctx, "DROP TABLE recovery_quarantine")
		db.Close()
		if e != nil {
			return RecoveryBackup{}, e
		}
	}
	hash, e = fileHash(temporary)
	if e != nil {
		return RecoveryBackup{}, e
	}
	if e = publishCopy(temporary, destination); e != nil {
		return RecoveryBackup{}, e
	}
	status := "RECONCILED_QUARANTINE"
	if prepare {
		status = "PREPARED_FOR_STARTUP"
	}
	return RecoveryBackup{status, a.ID, m.CreatedAt, hash, 2, j.policy}, nil
}

func readOnlyRecoveryDB(path string) (*sql.DB, error) {
	absolute, e := filepath.Abs(path)
	if e != nil {
		return nil, e
	}
	u := url.URL{Scheme: "file", Path: absolute}
	q := u.Query()
	q.Set("mode", "ro")
	q.Set("_busy_timeout", "3000")
	u.RawQuery = q.Encode()
	db, e := sql.Open("sqlite3", u.String())
	if e == nil {
		db.SetMaxOpenConns(1)
	}
	return db, e
}

func (j *DeletionJournal) RestoreQuarantine(ctx context.Context, backup, destination string, m RecoveryBackup, expected JournalAnchor, now time.Time) (RecoveryBackup, error) {
	return j.restoreCopy(ctx, backup, destination, m, expected, now, false)
}

// Prepare creates another NEW file; it never replaces a live volume. Startup
// still requires the original independent journal and replays newer deletions.
func (j *DeletionJournal) PrepareRecoveryActivation(ctx context.Context, candidate, destination string, m RecoveryBackup, expected JournalAnchor, now time.Time) (RecoveryBackup, error) {
	return j.restoreCopy(ctx, candidate, destination, m, expected, now, true)
}

// Operational commands refuse a typo/new path or a schema migration as a side effect.
func OpenRecoverySource(path string) (*Store, error) {
	db, e := readOnlyRecoveryDB(path)
	if e != nil {
		return nil, e
	}
	var version int
	e = db.QueryRow("SELECT max(version) FROM schema_migrations").Scan(&version)
	db.Close()
	if e != nil || version != 2 {
		return nil, ErrRecoveryUnavailable
	}
	return OpenStore(path)
}
