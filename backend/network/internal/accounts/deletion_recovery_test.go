package accounts

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestRecoveryDefaultsAndLostJournalFailClosed(t *testing.T) {
	ctx := context.Background()
	s, e := OpenStore(filepath.Join(t.TempDir(), "main"))
	if e != nil {
		t.Fatal(e)
	}
	defer s.Close()
	if _, e = s.SignIn(ctx, "issuer", "subject", "token", "csrf", "id", "", time.Now()); !errors.Is(e, ErrRecoveryUnavailable) {
		t.Fatal(e)
	}
	if e = s.DeleteAccount(ctx, "id"); !errors.Is(e, ErrRecoveryUnavailable) {
		t.Fatal(e)
	}
	if _, e = InitializeDeletionJournal(filepath.Join(t.TempDir(), "j"), RecoveryPolicy{}); !errors.Is(e, ErrRetention) {
		t.Fatal(e)
	}
	missing := filepath.Join(t.TempDir(), "lost")
	if j, e := OpenDeletionJournal(missing, RecoveryPolicy{24, 48, 100}); e == nil {
		j.Close()
		t.Fatal("recreated journal")
	}
	if _, e = os.Stat(missing); !os.IsNotExist(e) {
		t.Fatal("missing journal created")
	}
}
func TestDeleteAfterBackupCannotReturnOnRestore(t *testing.T) {
	ctx := context.Background()
	s := storeFor(t)
	a, token := signIn(t, s, "old-A")
	signIn(t, s, "later-B")
	if _, e := s.PutSave(ctx, a.AccountID, "decks", 1, 0, fixture(t, "decks"), time.Now()); e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(t.TempDir(), "backup")
	m, e := s.CreateRecoveryBackup(ctx, path, time.Now())
	if e != nil {
		t.Fatal(e)
	}
	before, _ := fileHash(path)
	if e = s.DeleteAccount(ctx, a.AccountID); e != nil {
		t.Fatal(e)
	}
	if _, e = s.Session(ctx, token, time.Now()); !errors.Is(e, ErrNotFound) {
		t.Fatal(e)
	}
	anchor, e := s.journal.Anchor(ctx)
	if e != nil {
		t.Fatal(e)
	}
	candidate := filepath.Join(t.TempDir(), "candidate")
	result, e := s.journal.RestoreQuarantine(ctx, path, candidate, m, anchor, time.Now())
	if e != nil || result.Status != "RECONCILED_QUARANTINE" {
		t.Fatal(result, e)
	}
	if blocked, e := OpenStore(candidate); e == nil {
		blocked.Close()
		t.Fatal("quarantine served directly")
	}
	prepared := filepath.Join(t.TempDir(), "prepared")
	if _, e = s.journal.PrepareRecoveryActivation(ctx, candidate, prepared, result, anchor, time.Now()); e != nil {
		t.Fatal(e)
	}
	if e = s.DeleteAccount(ctx, "later-B"); e != nil {
		t.Fatal(e)
	}
	restored, e := OpenStore(prepared)
	if e != nil {
		t.Fatal(e)
	}
	defer restored.Close()
	if e = restored.ConfigureDeletionJournal(ctx, s.journal); e != nil {
		t.Fatal(e)
	}
	var n int
	restored.db.QueryRow("SELECT count(*) FROM accounts").Scan(&n)
	if n != 0 {
		t.Fatal("deleted account restored")
	}
	restored.db.QueryRow("SELECT count(*) FROM sessions").Scan(&n)
	if n != 0 {
		t.Fatal("session restored")
	}
	after, _ := fileHash(path)
	if before != after {
		t.Fatal("backup mutated")
	}
	newer, e := restored.SignIn(ctx, "https://issuer.invalid", "old-A", "new-token", "new-csrf", "new-A", "", time.Now())
	if e != nil || newer.AccountID != "new-A" {
		t.Fatal(newer, e)
	}
	saves, e := restored.ListSaves(ctx, newer.AccountID)
	if e != nil || len(saves) != 0 {
		t.Fatal(saves, e)
	}
}
func TestCommittedJournalBeforeFailedDeleteReplays(t *testing.T) {
	ctx := context.Background()
	s := storeFor(t)
	a, token := signIn(t, s, "crash-A")
	if _, e := s.db.Exec("CREATE TRIGGER block_delete BEFORE DELETE ON accounts BEGIN SELECT RAISE(FAIL,'injected failure'); END;"); e != nil {
		t.Fatal(e)
	}
	if e := s.DeleteAccount(ctx, a.AccountID); e == nil {
		t.Fatal("primary failure ignored")
	}
	deleted, e := s.journal.Deleted(ctx, a.AccountID)
	if e != nil || !deleted {
		t.Fatal("intent not durable", e)
	}
	if _, e = s.Session(ctx, token, time.Now()); !errors.Is(e, ErrNotFound) {
		t.Fatal("session usable", e)
	}
	s.db.Exec("DROP TRIGGER block_delete")
	path, policy := s.journal.path, s.journal.policy
	s.journal.Close()
	var mainName, mainPath string
	var mainSeq int
	if e = s.db.QueryRow("PRAGMA database_list").Scan(&mainSeq, &mainName, &mainPath); e != nil {
		t.Fatal(e)
	}
	s.Close()
	s, e = OpenStore(mainPath)
	if e != nil {
		t.Fatal(e)
	}
	defer s.Close()
	j, e := OpenDeletionJournal(path, policy)
	if e != nil {
		t.Fatal(e)
	}
	defer j.Close()
	if e = s.ConfigureDeletionJournal(ctx, j); e != nil {
		t.Fatal(e)
	}
	var n int
	s.db.QueryRow("SELECT count(*) FROM accounts").Scan(&n)
	if n != 0 {
		t.Fatal("intent not replayed")
	}
}
func TestUnavailableJournalNeverAcknowledgesDeletion(t *testing.T) {
	s := storeFor(t)
	a, _ := signIn(t, s, "A")
	s.journal.Close()
	if e := s.DeleteAccount(context.Background(), a.AccountID); e == nil {
		t.Fatal("acknowledged")
	}
	var n int
	s.db.QueryRow("SELECT count(*) FROM accounts").Scan(&n)
	if n != 1 {
		t.Fatal("primary mutated")
	}
}
func TestRestoreRejectsExpiredFutureWrongOrStaleContext(t *testing.T) {
	ctx := context.Background()
	s := storeFor(t)
	signIn(t, s, "A")
	backup := filepath.Join(t.TempDir(), "backup")
	m, e := s.CreateRecoveryBackup(ctx, backup, time.Now())
	if e != nil {
		t.Fatal(e)
	}
	a, _ := s.journal.Anchor(ctx)
	for _, name := range []string{"expired", "future", "hash", "journal", "schema"} {
		t.Run(name, func(t *testing.T) {
			v := m
			now := time.Now()
			switch name {
			case "expired":
				now = now.Add(25 * time.Hour)
			case "future":
				now = time.Unix(m.CreatedAt-1, 0)
			case "hash":
				v.SHA256 = "changed"
			case "journal":
				v.JournalID = "other"
			case "schema":
				v.Schema = 99
			}
			dst := filepath.Join(t.TempDir(), "candidate")
			if _, e := s.journal.RestoreQuarantine(ctx, backup, dst, v, a, now); e == nil {
				t.Fatal("accepted")
			}
			if _, e := os.Stat(dst); !os.IsNotExist(e) {
				t.Fatal("published")
			}
		})
	}
	if e = s.DeleteAccount(ctx, "A"); e != nil {
		t.Fatal(e)
	}
	if _, e = s.journal.RestoreQuarantine(ctx, backup, filepath.Join(t.TempDir(), "stale"), m, a, time.Now()); !errors.Is(e, ErrRetention) {
		t.Fatal("stale anchor", e)
	}
}
func TestConcurrentDeleteAndBackupReconcile(t *testing.T) {
	ctx := context.Background()
	s := storeFor(t)
	signIn(t, s, "A")
	type outcome struct {
		path string
		m    RecoveryBackup
		e    error
	}
	out := make(chan outcome, 8)
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		path := filepath.Join(t.TempDir(), "backup")
		wg.Add(1)
		go func() {
			defer wg.Done()
			m, e := s.CreateRecoveryBackup(ctx, path, time.Now().Add(time.Minute))
			out <- outcome{path, m, e}
		}()
	}
	wg.Add(1)
	go func() {
		defer wg.Done()
		if e := s.DeleteAccount(ctx, "A"); e != nil {
			t.Error(e)
		}
	}()
	wg.Wait()
	close(out)
	a, _ := s.journal.Anchor(ctx)
	for v := range out {
		if v.e != nil {
			t.Fatal(v.e)
		}
		dst := filepath.Join(t.TempDir(), "candidate")
		if _, e := s.journal.RestoreQuarantine(ctx, v.path, dst, v.m, a, time.Now().Add(2*time.Minute)); e != nil {
			t.Fatal(e)
		}
		db, e := readOnlyRecoveryDB(dst)
		if e != nil {
			t.Fatal(e)
		}
		var n int
		db.QueryRow("SELECT count(*) FROM accounts").Scan(&n)
		db.Close()
		if n != 0 {
			t.Fatal("deleted row returned")
		}
	}
}
func TestCapacityPruningAndExpiredBackupBoundary(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	s, e := OpenStore(filepath.Join(dir, "main"))
	if e != nil {
		t.Fatal(e)
	}
	defer s.Close()
	j, e := InitializeDeletionJournal(filepath.Join(dir, "journal"), RecoveryPolicy{1, 25, 1})
	if e != nil {
		t.Fatal(e)
	}
	defer j.Close()
	if e = s.ConfigureDeletionJournal(ctx, j); e != nil {
		t.Fatal(e)
	}
	now := time.Now()
	if e = j.append(ctx, "old", now.Add(-26*time.Hour)); e != nil {
		t.Fatal(e)
	}
	if e = j.append(ctx, "next", now); !errors.Is(e, ErrCapacity) {
		t.Fatal(e)
	}
	a, _ := j.Anchor(ctx)
	next, e := s.PruneDeletionJournal(ctx, now, a)
	if e != nil || next.Floor != 1 {
		t.Fatal(next, e)
	}
	if e = j.append(ctx, "next", now); e != nil {
		t.Fatal(e)
	}
	if _, e = j.Anchor(ctx); e != nil {
		t.Fatal(e)
	}
	if _, e = s.PruneDeletionJournal(ctx, now, a); !errors.Is(e, ErrRetention) {
		t.Fatal("old prune anchor", e)
	}
}
func TestJournalCorruptionAndBindingMismatchRejected(t *testing.T) {
	ctx := context.Background()
	s := storeFor(t)
	other, e := InitializeDeletionJournal(filepath.Join(t.TempDir(), "other"), RecoveryPolicy{24, 48, 1000})
	if e != nil {
		t.Fatal(e)
	}
	defer other.Close()
	if e = s.ConfigureDeletionJournal(ctx, other); !errors.Is(e, ErrRecoveryUnavailable) {
		t.Fatal("rebound", e)
	}
	if e = s.journal.append(ctx, "A", time.Now()); e != nil {
		t.Fatal(e)
	}
	s.journal.db.Exec("UPDATE deletions SET hash='broken'")
	if _, e = s.journal.Anchor(ctx); !errors.Is(e, ErrRecoveryUnavailable) {
		t.Fatal("broken chain", e)
	}
}

func TestCancelledDeleteAndRolledBackJournal(t *testing.T) {
	ctx := context.Background()
	s := storeFor(t)
	signIn(t, s, "A")
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if e := s.DeleteAccount(cancelled, "A"); e == nil {
		t.Fatal("cancelled deletion acknowledged")
	}
	a, e := s.journal.Anchor(ctx)
	if e != nil || a.Sequence != 0 {
		t.Fatal(a, e)
	}
	oldPath := filepath.Join(t.TempDir(), "old-journal")
	if _, e = s.journal.db.Exec("VACUUM INTO ?", oldPath); e != nil {
		t.Fatal(e)
	}
	backup := filepath.Join(t.TempDir(), "backup")
	m, e := s.CreateRecoveryBackup(ctx, backup, time.Now())
	if e != nil {
		t.Fatal(e)
	}
	if e = s.DeleteAccount(ctx, "A"); e != nil {
		t.Fatal(e)
	}
	current, e := s.journal.Anchor(ctx)
	if e != nil {
		t.Fatal(e)
	}
	old, e := OpenDeletionJournal(oldPath, s.journal.policy)
	if e != nil {
		t.Fatal(e)
	}
	defer old.Close()
	if _, e = old.RestoreQuarantine(ctx, backup, filepath.Join(t.TempDir(), "candidate"), m, current, time.Now()); !errors.Is(e, ErrRetention) {
		t.Fatal("rolled back journal accepted", e)
	}
}

func TestRemovedJournalAndStrictPolicy(t *testing.T) {
	s := storeFor(t)
	signIn(t, s, "A")
	if e := os.Rename(s.journal.path, s.journal.path+".moved"); e != nil {
		t.Fatal(e)
	}
	if e := s.DeleteAccount(context.Background(), "A"); !errors.Is(e, ErrRecoveryUnavailable) {
		t.Fatal("missing journal path usable", e)
	}
	for _, raw := range []string{`{}`, `{"backupHours":24,"tombstoneHours":24,"maxRecords":100}`, `{"backupHours":24,"tombstoneHours":48,"maxRecords":100,"future":true}`, `{"backupHours":24,"tombstoneHours":48,"maxRecords":100} {}`} {
		path := filepath.Join(t.TempDir(), "policy")
		os.WriteFile(path, []byte(raw), 0600)
		if _, e := LoadRecoveryPolicy(path); e == nil {
			t.Fatal("invalid policy accepted")
		}
	}
	missing := filepath.Join(t.TempDir(), "missing")
	if v, e := OpenRecoverySource(missing); e == nil {
		v.Close()
		t.Fatal("created missing source")
	}
	if _, e := os.Stat(missing); !os.IsNotExist(e) {
		t.Fatal("created missing database")
	}
}
