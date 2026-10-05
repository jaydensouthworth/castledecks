// Package lobby implements only private readiness. No combat or reward authority.
package lobby

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"regexp"
	"sync"
	"time"
)

var ErrClosed = errors.New("room closed")
var ErrBusy = errors.New("room queue full")
var ErrUncertain = errors.New("admitted command outcome uncertain")
var ErrForbidden = errors.New("room access denied")
var identifier = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

const ReplayWindow = 64

type Command struct {
	Version          int    `json:"v"`
	ID               string `json:"id"`
	Sequence         uint64 `json:"sequence"`
	ExpectedRevision uint64 `json:"expectedRevision"`
	Type             string `json:"type"`
	Ready            *bool  `json:"ready,omitempty"`
}
type Ack struct {
	Version      int    `json:"v"`
	Type         string `json:"type"`
	ID           string `json:"id"`
	Sequence     uint64 `json:"sequence"`
	Revision     uint64 `json:"revision"`
	NextSequence uint64 `json:"nextSequence"`
	Code         string `json:"code"`
}
type Participant struct {
	ID        string `json:"id"`
	Owner     bool   `json:"owner"`
	Connected bool   `json:"connected"`
	Ready     bool   `json:"ready"`
}
type Snapshot struct {
	Version      int           `json:"v"`
	Type         string        `json:"type"`
	Room         string        `json:"room"`
	Revision     uint64        `json:"revision"`
	Phase        string        `json:"phase"`
	You          string        `json:"you"`
	NextSequence uint64        `json:"nextSequence"`
	Participants []Participant `json:"participants"`
}
type Options struct {
	Lifetime, Grace time.Duration
	QueueSize       int
}
type Room struct {
	id         string
	operations chan operation
	done       chan struct{}
	cancel     context.CancelFunc
}
type Connection struct {
	room        *Room
	account     string
	acks        chan Ack
	snapshots   chan Snapshot
	done, leave chan struct{}
	once        sync.Once
}

func (c *Connection) Acks() <-chan Ack           { return c.acks }
func (c *Connection) Snapshots() <-chan Snapshot { return c.snapshots }
func (c *Connection) Done() <-chan struct{}      { return c.done }
func (c *Connection) Close()                     { c.once.Do(func() { close(c.leave) }) }

type gate struct {
	mu         sync.Mutex
	cancelled  bool
	connection *Connection
}
type operation struct {
	kind, account string
	ctx           context.Context
	gate          *gate
	connection    *Connection
	command       Command
	reply         chan result
}
type result struct {
	connection *Connection
	ack        Ack
	err        error
}
type stored struct {
	hash [32]byte
	ack  Ack
}
type member struct {
	account, alias        string
	owner, visible, ready bool
	connection            *Connection
	disconnected          time.Time
	next                  uint64
	cache                 map[string]stored
	order                 []string
}

func NewRoom(id, owner string, invited []string, o Options) (*Room, error) {
	if !identifier.MatchString(id) || owner == "" || len(invited) > 3 {
		return nil, errors.New("invalid room")
	}
	accounts := append([]string{owner}, invited...)
	seen := map[string]bool{}
	members := []*member{}
	for i, a := range accounts {
		if a == "" || seen[a] {
			return nil, errors.New("invalid membership")
		}
		seen[a] = true
		members = append(members, &member{account: a, alias: []string{"p1", "p2", "p3", "p4"}[i], owner: i == 0, next: 1, cache: map[string]stored{}})
	}
	if o.Lifetime == 0 {
		o.Lifetime = 15 * time.Minute
	}
	if o.Grace == 0 {
		o.Grace = 30 * time.Second
	}
	if o.QueueSize == 0 {
		o.QueueSize = 64
	}
	if o.Lifetime <= 0 || o.Lifetime > time.Hour || o.Grace <= 0 || o.Grace > time.Minute || o.QueueSize < 1 || o.QueueSize > 64 {
		return nil, errors.New("unbounded room options")
	}
	ctx, cancel := context.WithCancel(context.Background())
	r := &Room{id: id, operations: make(chan operation, o.QueueSize), done: make(chan struct{}), cancel: cancel}
	go r.run(ctx, members, o)
	return r, nil
}
func (r *Room) Close() { r.cancel(); <-r.done }
func (r *Room) admit(ctx context.Context, op operation) error {
	if e := ctx.Err(); e != nil {
		return e
	}
	select {
	case <-r.done:
		return ErrClosed
	default:
	}
	select {
	case r.operations <- op:
		return nil
	case <-r.done:
		return ErrClosed
	default:
		return ErrBusy
	}
}
func (r *Room) Join(ctx context.Context, account string) (*Connection, error) {
	g := &gate{}
	op := operation{kind: "join", account: account, ctx: ctx, gate: g, reply: make(chan result, 1)}
	if e := r.admit(ctx, op); e != nil {
		return nil, e
	}
	cancelOrOwn := func(err error) (*Connection, error) {
		g.mu.Lock()
		defer g.mu.Unlock()
		if g.connection != nil {
			return g.connection, nil
		}
		g.cancelled = true
		return nil, err
	}
	select {
	case out := <-op.reply:
		return out.connection, out.err
	case <-ctx.Done():
		return cancelOrOwn(ctx.Err())
	case <-r.done:
		return cancelOrOwn(ErrClosed)
	}
}
func (r *Room) submit(ctx context.Context, op operation) (result, error) {
	op.ctx = ctx
	op.reply = make(chan result, 1)
	if e := r.admit(ctx, op); e != nil {
		return result{}, e
	}
	select {
	case out := <-op.reply:
		return out, out.err
	case <-ctx.Done():
		return result{}, ErrUncertain
	case <-r.done:
		return result{}, ErrUncertain
	}
}
func (r *Room) Authorize(ctx context.Context, account string) error {
	_, e := r.submit(ctx, operation{kind: "authorize", account: account})
	return e
}
func (c *Connection) Command(ctx context.Context, command Command) (Ack, error) {
	if command.Ready != nil {
		value := *command.Ready
		command.Ready = &value
	}
	out, e := c.room.submit(ctx, operation{kind: "command", account: c.account, connection: c, command: command})
	return out.ack, e
}
func (r *Room) run(ctx context.Context, members []*member, o Options) {
	defer close(r.done)
	byAccount := map[string]*member{}
	for _, m := range members {
		byAccount[m.account] = m
	}
	revision := uint64(0)
	phase := "waiting"
	drop := func(m *member) {
		if m.connection != nil {
			close(m.connection.done)
			close(m.connection.acks)
			close(m.connection.snapshots)
			m.connection = nil
			m.ready = false
			m.disconnected = time.Now()
			revision++
		}
	}
	defer func() {
		for _, m := range members {
			drop(m)
		}
	}()
	publish := func() {
		people := []Participant{}
		for _, m := range members {
			if m.visible {
				people = append(people, Participant{m.alias, m.owner, m.connection != nil, m.ready})
			}
		}
		for _, m := range members {
			if m.connection == nil {
				continue
			}
			v := Snapshot{1, "snapshot", r.id, revision, phase, m.alias, m.next, append([]Participant{}, people...)}
			select {
			case m.connection.snapshots <- v:
			default:
				select {
				case <-m.connection.snapshots:
				default:
				}
				m.connection.snapshots <- v
			}
		}
	}
	acknowledge := func(m *member, a Ack) {
		if m.connection == nil {
			return
		}
		select {
		case m.connection.acks <- a:
		default:
			drop(m)
			publish()
		}
	}
	timer := time.NewTimer(o.Lifetime)
	defer timer.Stop()
	tick := time.NewTicker(20 * time.Millisecond)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			return
		case now := <-tick.C:
			changed := false
			for _, m := range members {
				if m.connection != nil {
					select {
					case <-m.connection.leave:
						drop(m)
						changed = true
					default:
					}
				}
				if m.visible && m.connection == nil && !m.disconnected.IsZero() && now.Sub(m.disconnected) >= o.Grace {
					m.visible = false
					revision++
					changed = true
				}
			}
			if changed {
				publish()
			}
		case op := <-r.operations:
			changed := false
			for _, candidate := range members {
				if candidate.connection != nil {
					select {
					case <-candidate.connection.leave:
						drop(candidate)
						changed = true
					default:
					}
				}
			}
			if changed {
				publish()
			}
			m := byAccount[op.account]
			if m == nil {
				op.reply <- result{err: ErrForbidden}
				continue
			}
			switch op.kind {
			case "authorize":
				op.reply <- result{}
			case "join":
				g := op.gate
				g.mu.Lock()
				if g.cancelled || op.ctx.Err() != nil {
					g.mu.Unlock()
					op.reply <- result{err: context.Canceled}
					continue
				}
				drop(m)
				c := &Connection{room: r, account: m.account, acks: make(chan Ack, 8), snapshots: make(chan Snapshot, 1), done: make(chan struct{}), leave: make(chan struct{})}
				m.connection = c
				m.visible = true
				m.ready = false
				revision++
				g.connection = c
				g.mu.Unlock()
				publish()
				op.reply <- result{connection: c}
			case "command":
				if m.connection != op.connection {
					op.reply <- result{err: ErrClosed}
					continue
				}
				cmd := op.command
				ack := Ack{1, "ack", cmd.ID, cmd.Sequence, revision, m.next, "invalid_command"}
				valid := cmd.Version == 1 && identifier.MatchString(cmd.ID) && cmd.Sequence > 0 && cmd.Sequence <= 9007199254740991 && cmd.ExpectedRevision <= 9007199254740991 && ((cmd.Type == "ready" && cmd.Ready != nil) || (cmd.Type == "start" && cmd.Ready == nil))
				raw, _ := json.Marshal(cmd)
				hash := sha256.Sum256(raw)
				if !valid {
					acknowledge(m, ack)
					op.reply <- result{ack: ack}
					continue
				}
				if prior, ok := m.cache[cmd.ID]; ok {
					if prior.hash == hash {
						ack = prior.ack
					} else {
						ack.Code = "id_reused"
					}
					acknowledge(m, ack)
					op.reply <- result{ack: ack}
					continue
				}
				if cmd.Sequence != m.next {
					ack.Code = "out_of_order"
					if cmd.Sequence < m.next {
						ack.Code = "stale_sequence"
					}
					acknowledge(m, ack)
					op.reply <- result{ack: ack}
					continue
				}
				m.next++
				ack.NextSequence = m.next
				switch {
				case cmd.ExpectedRevision != revision:
					ack.Code = "revision_conflict"
				case phase != "waiting":
					ack.Code = "already_started"
				case cmd.Type == "ready":
					m.ready = *cmd.Ready
					revision++
					ack.Code = "ok"
				case !m.owner:
					ack.Code = "owner_required"
				default:
					ready := 0
					all := true
					for _, member := range members {
						if member.visible {
							if member.connection == nil || !member.ready {
								all = false
							} else {
								ready++
							}
						}
					}
					if all && ready >= 2 {
						phase = "started"
						revision++
						ack.Code = "ok"
					} else {
						ack.Code = "not_ready"
					}
				}
				ack.Revision = revision
				m.cache[cmd.ID] = stored{hash, ack}
				m.order = append(m.order, cmd.ID)
				if len(m.order) > ReplayWindow {
					delete(m.cache, m.order[0])
					m.order = m.order[1:]
				}
				acknowledge(m, ack)
				publish()
				op.reply <- result{ack: ack}
			default:
				op.reply <- result{err: ErrClosed}
			}
		}
	}
}
