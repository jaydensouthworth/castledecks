package lobby

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"sync"
	"testing"
	"time"
)

func roomFor(t *testing.T) *Room {
	t.Helper()
	r, e := NewRoom("synthetic-room", "account-a", []string{"account-b"}, Options{})
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(r.Close)
	return r
}
func join(t *testing.T, r *Room, account string) *Connection {
	t.Helper()
	c, e := r.Join(context.Background(), account)
	if e != nil {
		t.Fatal(e)
	}
	return c
}
func snapshot(t *testing.T, c *Connection) Snapshot {
	t.Helper()
	select {
	case s, ok := <-c.Snapshots():
		if !ok {
			t.Fatal("snapshots closed")
		}
		return s
	case <-time.After(time.Second):
		t.Fatal("snapshot missing")
	}
	return Snapshot{}
}
func ready(sequence, revision uint64, id string, value bool) Command {
	return Command{Version: 1, ID: id, Sequence: sequence, ExpectedRevision: revision, Type: "ready", Ready: &value}
}
func command(t *testing.T, c *Connection, v Command) Ack {
	t.Helper()
	ack, e := c.Command(context.Background(), v)
	if e != nil {
		t.Fatal(e)
	}
	select {
	case queued := <-c.Acks():
		if queued != ack {
			t.Fatal("ack mismatch")
		}
	case <-time.After(time.Second):
		t.Fatal("ack missing")
	}
	return ack
}
func TestReadyStartAndScopedIdentity(t *testing.T) {
	r := roomFor(t)
	a := join(t, r, "account-a")
	b := join(t, r, "account-b")
	s := snapshot(t, a)
	if len(s.Participants) != 2 || s.You != "p1" || s.Participants[1].ID != "p2" {
		t.Fatal("wire identity", s)
	}
	first := command(t, a, ready(1, s.Revision, "a-ready", true))
	second := command(t, b, ready(1, first.Revision, "b-ready", true))
	start := command(t, a, Command{Version: 1, ID: "start", Sequence: 2, ExpectedRevision: second.Revision, Type: "start"})
	if start.Code != "ok" || snapshot(t, a).Phase != "started" {
		t.Fatal("start", start)
	}
}
func TestMembershipOwnerAndDisconnectedReadiness(t *testing.T) {
	r := roomFor(t)
	if _, e := r.Join(context.Background(), "outsider"); !errors.Is(e, ErrForbidden) {
		t.Fatal(e)
	}
	a := join(t, r, "account-a")
	b := join(t, r, "account-b")
	s := snapshot(t, a)
	ack := command(t, b, Command{Version: 1, ID: "nonowner", Sequence: 1, ExpectedRevision: s.Revision, Type: "start"})
	if ack.Code != "owner_required" {
		t.Fatal(ack)
	}
	ack = command(t, a, ready(1, ack.Revision, "a-ready", true))
	ack = command(t, b, ready(2, ack.Revision, "b-ready", true))
	b.Close()
	ack = command(t, a, Command{Version: 1, ID: "start-after-leave", Sequence: 2, ExpectedRevision: ack.Revision, Type: "start"})
	if ack.Code == "ok" {
		t.Fatal("started after known disconnect")
	}
	s = snapshot(t, a)
	if s.Phase != "waiting" || s.Participants[1].Ready || s.Participants[1].Connected {
		t.Fatal(s)
	}
}
func TestOrderingDeduplicationAndReconnect(t *testing.T) {
	r := roomFor(t)
	c := join(t, r, "account-a")
	s := snapshot(t, c)
	cmd := ready(1, s.Revision, "one", true)
	a := command(t, c, cmd)
	if a.Code != "ok" {
		t.Fatal(a)
	}
	if duplicate := command(t, c, cmd); duplicate != a {
		t.Fatal("duplicate differs")
	}
	altered := cmd
	v := false
	altered.Ready = &v
	if got := command(t, c, altered); got.Code != "id_reused" {
		t.Fatal(got)
	}
	if got := command(t, c, ready(99, a.Revision, "gap", false)); got.Code != "out_of_order" || got.NextSequence != 2 {
		t.Fatal(got)
	}
	if got := command(t, c, ready(2, 999, "conflict", false)); got.Code != "revision_conflict" || got.NextSequence != 3 {
		t.Fatal(got)
	}
	replacement := join(t, r, "account-a")
	recovered := snapshot(t, replacement)
	if recovered.NextSequence != 3 || recovered.Participants[0].Ready {
		t.Fatal(recovered)
	}
	if replay := command(t, replacement, cmd); replay != a {
		t.Fatal("lost ack recovery")
	}
	if _, e := c.Command(context.Background(), ready(3, recovered.Revision, "old-connection", true)); !errors.Is(e, ErrClosed) {
		t.Fatal("old connection authority", e)
	}
}
func TestSlowAcknowledgementReceiverAndSnapshotBound(t *testing.T) {
	r := roomFor(t)
	a := join(t, r, "account-a")
	b := join(t, r, "account-b")
	s := snapshot(t, a)
	revision := s.Revision
	for i := 1; i <= 9; i++ {
		ack, e := a.Command(context.Background(), ready(uint64(i), revision, fmt.Sprint("slow", i), true))
		if e != nil {
			t.Fatal(e)
		}
		revision = ack.Revision
	}
	select {
	case <-a.Done():
	case <-time.After(time.Second):
		t.Fatal("slow consumer not disconnected")
	}
	if len(b.snapshots) != 1 {
		t.Fatal("snapshot queue unbounded")
	}
	latest := snapshot(t, b)
	if latest.Participants[0].Connected || latest.Participants[0].Ready {
		t.Fatal(latest)
	}
}
func TestReplayWindowNeverReexecutesOldSequence(t *testing.T) {
	r := roomFor(t)
	c := join(t, r, "account-a")
	s := snapshot(t, c)
	first := ready(1, s.Revision, "r1", true)
	revision := s.Revision
	for i := 1; i <= ReplayWindow+2; i++ {
		ack := command(t, c, ready(uint64(i), revision, fmt.Sprint("r", i), i%2 == 1))
		if ack.Code != "ok" {
			t.Fatal(ack)
		}
		revision = ack.Revision
	}
	ack := command(t, c, first)
	if ack.Code != "stale_sequence" || ack.Revision != revision {
		t.Fatal("old sequence reexecuted", ack)
	}
}
func TestConcurrentIntentsHaveOneWinner(t *testing.T) {
	r := roomFor(t)
	c := join(t, r, "account-a")
	s := snapshot(t, c)
	var wg sync.WaitGroup
	results := make(chan Ack, 6)
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			a, e := c.Command(context.Background(), ready(1, s.Revision, fmt.Sprint(i), true))
			if e != nil {
				t.Error(e)
			}
			results <- a
		}(i)
	}
	wg.Wait()
	close(results)
	won := 0
	for a := range results {
		if a.Code == "ok" {
			won++
		}
	}
	if won != 1 {
		t.Fatal("winners", won)
	}
}
func TestCancelledQueuedJoinHasNoGhost(t *testing.T) {
	r := roomFor(t)
	block := &gate{}
	block.mu.Lock()
	op := operation{kind: "join", account: "account-a", ctx: context.Background(), gate: block, reply: make(chan result, 1)}
	r.operations <- op
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if c, e := r.Join(ctx, "account-b"); c != nil || !errors.Is(e, context.Canceled) {
		t.Fatal(c, e)
	}
	block.mu.Unlock()
	owner := <-op.reply
	s := snapshot(t, owner.connection)
	if len(s.Participants) != 1 {
		t.Fatal("ghost", s)
	}
}
func TestAdmittedJoinCancellationDoesNotAllocate(t *testing.T) {
	r := roomFor(t)
	block := &gate{}
	block.mu.Lock()
	r.operations <- operation{kind: "join", account: "account-a", ctx: context.Background(), gate: block, reply: make(chan result, 1)}
	deadline := time.Now().Add(time.Second)
	for len(r.operations) > 0 && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan result, 1)
	go func() { c, e := r.Join(ctx, "account-b"); done <- result{connection: c, err: e} }()
	deadline = time.Now().Add(time.Second)
	for len(r.operations) == 0 && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	cancel()
	out := <-done
	if out.connection != nil || !errors.Is(out.err, context.Canceled) {
		t.Fatal(out)
	}
	block.mu.Unlock()
	b := join(t, r, "account-b")
	s := snapshot(t, b)
	if len(s.Participants) != 2 || s.NextSequence != 1 {
		t.Fatal(s)
	}
}
func TestRoomLifetimeAndShutdown(t *testing.T) {
	r, e := NewRoom("ttl", "a", nil, Options{Lifetime: 30 * time.Millisecond})
	if e != nil {
		t.Fatal(e)
	}
	c := join(t, r, "a")
	select {
	case <-c.Done():
	case <-time.After(time.Second):
		t.Fatal("TTL not enforced")
	}
	r.Close()
	if _, e = r.Join(context.Background(), "a"); !errors.Is(e, ErrClosed) {
		t.Fatal(e)
	}
	for _, o := range []Options{{QueueSize: 65}, {Lifetime: 2 * time.Hour}, {Grace: 2 * time.Minute}} {
		if r, e = NewRoom("invalid", "a", nil, o); e == nil {
			r.Close()
			t.Fatal("unbounded options")
		}
	}
}
func TestSeededLossDuplicateAndReconnectExercise(t *testing.T) {
	r := roomFor(t)
	c := join(t, r, "account-a")
	rng := rand.New(rand.NewSource(20261004))
	duplicates := 0
	s := snapshot(t, c)
	for i := 0; i < 80; i++ {
		cmd := ready(s.NextSequence, s.Revision, fmt.Sprint("intent", i), i%2 == 0)
		ack := command(t, c, cmd)
		if ack.Code != "ok" {
			t.Fatal(ack)
		}
		s = snapshot(t, c)
		if rng.Intn(5) == 0 {
			c = join(t, r, "account-a")
			s = snapshot(t, c)
			if s.NextSequence != cmd.Sequence+1 {
				t.Fatal("recovery sequence")
			}
			if replay := command(t, c, cmd); replay != ack {
				t.Fatal("duplicate result")
			}
			duplicates++
		}
	}
	t.Logf("seed 20261004, 80 intents, %d lost-ack/reconnect duplicate recoveries", duplicates)
}

func FuzzWireDecoder(f *testing.F) {
	f.Add(`{"v":1,"id":"x","sequence":1,"expectedRevision":1,"type":"ready","ready":true}`)
	f.Add(`{"id":null}`)
	f.Fuzz(func(t *testing.T, s string) {
		if len(s) > 4096 {
			return
		}
		var c Command
		_ = decodeCommand([]byte(s), &c)
	})
}
func TestQueueRejectionDiffersFromAdmittedUncertainty(t *testing.T) {
	r, e := NewRoom("queue", "a", []string{"b"}, Options{QueueSize: 1})
	if e != nil {
		t.Fatal(e)
	}
	defer r.Close()
	a := join(t, r, "a")
	s := snapshot(t, a)
	g := &gate{}
	g.mu.Lock()
	released := false
	defer func() {
		if !released {
			g.mu.Unlock()
		}
	}()
	r.operations <- operation{kind: "join", account: "b", ctx: context.Background(), gate: g, reply: make(chan result, 1)}
	deadline := time.Now().Add(time.Second)
	for len(r.operations) > 0 && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { _, e := a.Command(ctx, ready(1, s.Revision, "queued", true)); done <- e }()
	deadline = time.Now().Add(time.Second)
	for len(r.operations) == 0 && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if e = r.Authorize(context.Background(), "a"); !errors.Is(e, ErrBusy) {
		t.Fatal("expected admission rejection", e)
	}
	cancel()
	if e = <-done; !errors.Is(e, ErrUncertain) {
		t.Fatal("expected uncertain admitted command", e)
	}
	g.mu.Unlock()
	released = true
	select {
	case ack := <-a.Acks():
		if ack.NextSequence != 2 {
			t.Fatal("admitted operation did not resolve", ack)
		}
	case <-time.After(time.Second):
		t.Fatal("missing eventual result")
	}
}
