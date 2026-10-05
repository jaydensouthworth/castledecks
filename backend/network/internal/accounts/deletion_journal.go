package accounts

// The independent journal commits before primary deletion. Hash links detect
// accidental corruption; a separately retained current Anchor detects rollback.
// They are not signatures and cannot authenticate a maliciously replaced journal.
import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"time"
)

var ErrRecoveryUnavailable = errors.New("deletion recovery unavailable")
var ErrRetention = errors.New("recovery retention or checkpoint rejected")

type RecoveryPolicy struct {
	BackupHours    int `json:"backupHours"`
	TombstoneHours int `json:"tombstoneHours"`
	MaxRecords     int `json:"maxRecords"`
}

func (p RecoveryPolicy) valid() bool {
	return p.BackupHours >= 1 && p.BackupHours <= 8760 && p.TombstoneHours >= p.BackupHours+24 && p.TombstoneHours <= 17520 && p.MaxRecords >= 1 && p.MaxRecords <= 100000
}

type JournalAnchor struct {
	ID        string         `json:"id"`
	Sequence  int64          `json:"sequence"`
	Head      string         `json:"head"`
	Floor     int64          `json:"floor"`
	FloorHash string         `json:"floorHash"`
	FloorTime int64          `json:"floorTime"`
	Policy    RecoveryPolicy `json:"policy"`
}
type deletionRecord struct {
	seq     int64
	account string
	at      int64
	hash    string
}
type DeletionJournal struct {
	mu       sync.Mutex
	db       *sql.DB
	policy   RecoveryPolicy
	path     string
	identity os.FileInfo
}

const journalSchema = `CREATE TABLE journal_meta(id TEXT NOT NULL, seq INTEGER NOT NULL,head TEXT NOT NULL,floor INTEGER NOT NULL,floor_hash TEXT NOT NULL,floor_time INTEGER NOT NULL,policy TEXT NOT NULL);CREATE TABLE deletions(seq INTEGER PRIMARY KEY,account_id TEXT NOT NULL UNIQUE,deleted_at INTEGER NOT NULL,hash TEXT NOT NULL);PRAGMA user_version=1;`

func journalDB(path string, create bool) (*sql.DB, error) {
	absolute, e := filepath.Abs(path)
	if e != nil {
		return nil, e
	}
	u := url.URL{Scheme: "file", Path: absolute}
	q := u.Query()
	if !create {
		q.Set("mode", "rw")
	}
	q.Set("_busy_timeout", "3000")
	q.Set("_journal_mode", "DELETE")
	q.Set("_synchronous", "FULL")
	u.RawQuery = q.Encode()
	db, e := sql.Open("sqlite3", u.String())
	if e != nil {
		return nil, e
	}
	db.SetMaxOpenConns(1)
	return db, nil
}

// Initialize is explicit. Open never silently recreates a lost journal.
func InitializeDeletionJournal(path string, p RecoveryPolicy) (*DeletionJournal, error) {
	if !p.valid() {
		return nil, ErrRetention
	}
	f, e := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if e != nil {
		return nil, e
	}
	f.Close()
	db, e := journalDB(path, true)
	if e != nil {
		return nil, e
	}
	fail := func(e error) (*DeletionJournal, error) { db.Close(); return nil, e }
	id, e := randomToken()
	if e != nil {
		return fail(e)
	}
	raw, _ := json.Marshal(p)
	tx, e := db.Begin()
	if e != nil {
		return fail(e)
	}
	defer tx.Rollback()
	if _, e = tx.Exec(journalSchema); e != nil {
		return fail(e)
	}
	if _, e = tx.Exec(`INSERT INTO journal_meta VALUES(?,0,'',0,'',0,?)`, id, string(raw)); e != nil {
		return fail(e)
	}
	if e = tx.Commit(); e != nil {
		return fail(e)
	}
	// SQLite syncs the database; also persist its newly created directory entry.
	dir, e := os.Open(filepath.Dir(path))
	if e != nil {
		return fail(e)
	}
	e = dir.Sync()
	dir.Close()
	if e != nil {
		return fail(e)
	}
	identity, e := os.Stat(path)
	if e != nil {
		return fail(e)
	}
	return &DeletionJournal{db: db, policy: p, path: path, identity: identity}, nil
}
func OpenDeletionJournal(path string, p RecoveryPolicy) (*DeletionJournal, error) {
	if !p.valid() {
		return nil, ErrRetention
	}
	db, e := journalDB(path, false)
	if e != nil {
		return nil, e
	}
	identity, e := os.Stat(path)
	if e != nil {
		db.Close()
		return nil, e
	}
	j := &DeletionJournal{db: db, policy: p, path: path, identity: identity}
	if _, _, e = j.inspect(context.Background()); e != nil {
		db.Close()
		return nil, e
	}
	return j, nil
}
func (j *DeletionJournal) Close() error { return j.db.Close() }
func deletionHash(id, previous string, r deletionRecord) string {
	raw, _ := json.Marshal([]any{id, previous, r.seq, r.account, r.at})
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}
func (j *DeletionJournal) inspect(ctx context.Context) (JournalAnchor, []deletionRecord, error) {
	var a JournalAnchor
	if e := j.checkPath(); e != nil {
		return a, nil, e
	}
	var policy string
	var version int
	if e := j.db.QueryRowContext(ctx, "PRAGMA user_version").Scan(&version); e != nil || version != 1 {
		return a, nil, ErrRecoveryUnavailable
	}
	var count int
	if e := j.db.QueryRowContext(ctx, "SELECT count(*) FROM journal_meta").Scan(&count); e != nil || count != 1 {
		return a, nil, ErrRecoveryUnavailable
	}
	if e := j.db.QueryRowContext(ctx, "SELECT id,seq,head,floor,floor_hash,floor_time,policy FROM journal_meta").Scan(&a.ID, &a.Sequence, &a.Head, &a.Floor, &a.FloorHash, &a.FloorTime, &policy); e != nil {
		return a, nil, e
	}
	if json.Unmarshal([]byte(policy), &a.Policy) != nil || a.Policy != j.policy || !a.Policy.valid() || len(a.ID) != 43 || a.Sequence < a.Floor || a.Floor < 0 {
		return a, nil, ErrRecoveryUnavailable
	}
	rows, e := j.db.QueryContext(ctx, "SELECT seq,account_id,deleted_at,hash FROM deletions ORDER BY seq")
	if e != nil {
		return a, nil, e
	}
	defer rows.Close()
	records := []deletionRecord{}
	seq, head, last := a.Floor, a.FloorHash, a.FloorTime
	for rows.Next() {
		var r deletionRecord
		if e = rows.Scan(&r.seq, &r.account, &r.at, &r.hash); e != nil {
			return a, nil, e
		}
		if len(records) >= j.policy.MaxRecords || r.seq != seq+1 || r.account == "" || len(r.account) > 128 || r.at < last || r.hash != deletionHash(a.ID, head, r) {
			return a, nil, ErrRecoveryUnavailable
		}
		records = append(records, r)
		seq, head, last = r.seq, r.hash, r.at
	}
	if rows.Err() != nil || seq != a.Sequence || head != a.Head {
		return a, nil, ErrRecoveryUnavailable
	}
	return a, records, nil
}
func (j *DeletionJournal) Anchor(ctx context.Context) (JournalAnchor, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	a, _, e := j.inspect(ctx)
	return a, e
}
func (j *DeletionJournal) Deleted(ctx context.Context, id string) (bool, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if e := j.checkPath(); e != nil {
		return false, e
	}
	var n int
	e := j.db.QueryRowContext(ctx, "SELECT count(*) FROM deletions WHERE account_id=?", id).Scan(&n)
	return n > 0, e
}
func (j *DeletionJournal) append(ctx context.Context, id string, now time.Time) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	a, records, e := j.inspect(ctx)
	if e != nil {
		return e
	}
	for _, r := range records {
		if r.account == id {
			return nil
		}
	}
	if len(records) >= j.policy.MaxRecords {
		return ErrCapacity
	}
	if id == "" || len(id) > 128 {
		return ErrRecoveryUnavailable
	}
	last := a.FloorTime
	if len(records) > 0 {
		last = records[len(records)-1].at
	}
	if now.Unix() < last {
		return ErrRetention
	}
	r := deletionRecord{seq: a.Sequence + 1, account: id, at: now.Unix()}
	r.hash = deletionHash(a.ID, a.Head, r)
	tx, e := j.db.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	if _, e = tx.ExecContext(ctx, "INSERT INTO deletions VALUES(?,?,?,?)", r.seq, r.account, r.at, r.hash); e != nil {
		return e
	}
	if _, e = tx.ExecContext(ctx, "UPDATE journal_meta SET seq=?,head=?", r.seq, r.hash); e != nil {
		return e
	}
	return tx.Commit()
}
func (s *Store) ConfigureDeletionJournal(ctx context.Context, j *DeletionJournal) error {
	if j == nil {
		return ErrRecoveryUnavailable
	}
	s.recoveryMu.Lock()
	defer s.recoveryMu.Unlock()
	j.mu.Lock()
	defer j.mu.Unlock()
	a, records, e := j.inspect(ctx)
	if e != nil {
		return e
	}
	tx, e := s.db.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	var bound string
	e = tx.QueryRowContext(ctx, "SELECT journal_id FROM deletion_binding WHERE singleton=1").Scan(&bound)
	if e != nil && !errors.Is(e, sql.ErrNoRows) {
		return e
	}
	if bound != "" && bound != a.ID {
		return ErrRecoveryUnavailable
	}
	if _, e = tx.ExecContext(ctx, "INSERT OR IGNORE INTO deletion_binding VALUES(1,?)", a.ID); e != nil {
		return e
	}
	for _, r := range records {
		if _, e = tx.ExecContext(ctx, "DELETE FROM accounts WHERE id=?", r.account); e != nil {
			return e
		}
	}
	if e = tx.Commit(); e != nil {
		return e
	}
	s.journal = j
	return nil
}
func (s *Store) journalState(ctx context.Context, id string) error {
	s.recoveryMu.Lock()
	defer s.recoveryMu.Unlock()
	if s.journal == nil {
		return ErrRecoveryUnavailable
	}
	deleted, e := s.journal.Deleted(ctx, id)
	if e != nil {
		return ErrRecoveryUnavailable
	}
	if deleted {
		return ErrNotFound
	}
	return nil
}

// Explicit pruning is bounded by the configured retention horizon. Reconcile
// the live store first, so a crash-delayed physical deletion cannot be forgotten.
func (s *Store) PruneDeletionJournal(ctx context.Context, now time.Time, expected JournalAnchor) (JournalAnchor, error) {
	s.recoveryMu.Lock()
	defer s.recoveryMu.Unlock()
	j := s.journal
	if j == nil {
		return JournalAnchor{}, ErrRecoveryUnavailable
	}
	j.mu.Lock()
	defer j.mu.Unlock()
	a, records, e := j.inspect(ctx)
	if e != nil {
		return a, e
	}
	if a != expected {
		return a, ErrRetention
	}
	cutoff := now.Add(-time.Duration(j.policy.TombstoneHours) * time.Hour).Unix()
	prune := []deletionRecord{}
	for _, r := range records {
		if r.at > cutoff {
			break
		}
		prune = append(prune, r)
	}
	if len(prune) == 0 {
		return a, nil
	}
	tx, e := s.db.BeginTx(ctx, nil)
	if e != nil {
		return a, e
	}
	defer tx.Rollback()
	for _, r := range records {
		if _, e = tx.ExecContext(ctx, "DELETE FROM accounts WHERE id=?", r.account); e != nil {
			return a, e
		}
	}
	if e = tx.Commit(); e != nil {
		return a, e
	}
	last := prune[len(prune)-1]
	jt, e := j.db.BeginTx(ctx, nil)
	if e != nil {
		return a, e
	}
	defer jt.Rollback()
	if _, e = jt.ExecContext(ctx, "DELETE FROM deletions WHERE seq<=?", last.seq); e != nil {
		return a, e
	}
	if _, e = jt.ExecContext(ctx, "UPDATE journal_meta SET floor=?,floor_hash=?,floor_time=?", last.seq, last.hash, last.at); e != nil {
		return a, e
	}
	if e = jt.Commit(); e != nil {
		return a, e
	}
	a.Floor, a.FloorHash, a.FloorTime = last.seq, last.hash, last.at
	return a, nil
}
func recoveryError(e error) error {
	if e == nil {
		return nil
	}
	return fmt.Errorf("recovery operation failed: %w", e)
}

func LoadRecoveryPolicy(path string) (RecoveryPolicy, error) {
	var p RecoveryPolicy
	f, e := os.Open(path)
	if e != nil {
		return p, e
	}
	defer f.Close()
	raw, e := io.ReadAll(io.LimitReader(f, 4097))
	if e != nil || len(raw) > 4096 {
		return p, ErrRetention
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if e = d.Decode(&p); e != nil || !p.valid() {
		return p, ErrRetention
	}
	var extra any
	if d.Decode(&extra) != io.EOF {
		return p, ErrRetention
	}
	return p, nil
}

func (j *DeletionJournal) checkPath() error {
	current, e := os.Stat(j.path)
	if e != nil || j.identity == nil || !os.SameFile(current, j.identity) {
		return ErrRecoveryUnavailable
	}
	return nil
}
