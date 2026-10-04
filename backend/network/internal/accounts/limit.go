package accounts

import (
	"errors"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"sync"
	"time"
)

type bucket struct {
	tokens   float64
	at, last time.Time
}
type loginLimit struct {
	mu      sync.Mutex
	clients map[netip.Addr]bucket
	global  bucket
	trusted []netip.Prefix
}

func newLimit(cidrs []string) (*loginLimit, error) {
	l := &loginLimit{clients: map[netip.Addr]bucket{}, global: bucket{tokens: 10, at: time.Now()}}
	for _, raw := range cidrs {
		p, e := netip.ParsePrefix(strings.TrimSpace(raw))
		if e != nil || p.Bits() == 0 || p.Addr().Zone() != "" {
			return nil, errors.New("explicit trusted proxy CIDRs required")
		}
		l.trusted = append(l.trusted, p.Masked())
	}
	return l, nil
}
func (l *loginLimit) isTrusted(a netip.Addr) bool {
	for _, p := range l.trusted {
		if p.Contains(a) {
			return true
		}
	}
	return false
}
func (l *loginLimit) client(r *http.Request) (netip.Addr, error) {
	host, _, e := net.SplitHostPort(r.RemoteAddr)
	if e != nil {
		return netip.Addr{}, e
	}
	a, e := netip.ParseAddr(host)
	if e != nil || a.Zone() != "" {
		return netip.Addr{}, errors.New("invalid peer")
	}
	a = a.Unmap()
	if l.isTrusted(a) {
		values := r.Header.Values("X-Forwarded-For")
		if len(values) != 1 {
			return netip.Addr{}, errors.New("trusted proxy chain required")
		}
		parts := strings.Split(values[0], ",")
		if len(parts) == 0 || len(parts) > 8 {
			return netip.Addr{}, errors.New("invalid chain")
		}
		chain := make([]netip.Addr, len(parts))
		for i, p := range parts {
			v, e := netip.ParseAddr(strings.TrimSpace(p))
			if e != nil || v.Zone() != "" {
				return netip.Addr{}, errors.New("invalid chain")
			}
			chain[i] = v.Unmap()
		}
		for i := len(chain) - 1; i >= 0 && l.isTrusted(a); i-- {
			a = chain[i]
		}
	}
	if a.Is6() {
		a = netip.PrefixFrom(a, 64).Masked().Addr()
	}
	return a, nil
}
func refill(b bucket, now time.Time, rate, maximum float64) bucket {
	if b.at.IsZero() {
		b.tokens = maximum
	} else {
		elapsed := now.Sub(b.at).Seconds()
		if elapsed > 0 {
			b.tokens += elapsed * rate
		}
	}
	if b.tokens > maximum {
		b.tokens = maximum
	}
	b.at = now
	return b
}
func (l *loginLimit) allow(r *http.Request, now time.Time) bool {
	a, e := l.client(r)
	if e != nil {
		return false
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	for id, b := range l.clients {
		if now.Sub(b.last) >= 5*time.Minute {
			delete(l.clients, id)
		}
	}
	b, exists := l.clients[a]
	b = refill(b, now, 5.0/60, 3)
	if b.tokens < 1 {
		return false
	}
	l.global = refill(l.global, now, 0.5, 10)
	if l.global.tokens < 1 || (!exists && len(l.clients) >= 1024) {
		return false
	}
	b.tokens--
	b.last = now
	l.clients[a] = b
	l.global.tokens--
	return true
}
