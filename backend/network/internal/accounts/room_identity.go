package accounts

import (
	"context"
	"errors"
	"net/http"
	"time"
)

type RoomIdentity struct {
	Account, Binding string
	Expires          time.Time
}

func (s *Store) RoomIdentity(r *http.Request, csrf string, now time.Time) (RoomIdentity, error) {
	token := cookieValue(r, sessionCookie)
	if len(token) != 43 || len(csrf) != 43 {
		return RoomIdentity{}, errors.New("session binding required")
	}
	session, e := s.Session(r.Context(), token, now)
	if e != nil {
		return RoomIdentity{}, e
	}
	if !equal(session.CSRF, csrf) {
		return RoomIdentity{}, errors.New("session changed")
	}
	return RoomIdentity{session.AccountID, digest(token), time.Unix(session.Expires, 0)}, nil
}

// Confirmed absence is separate from unavailable/cancelled database validation.
func (s *Store) RoomBindingValid(ctx context.Context, binding, account string, now time.Time) (bool, error) {
	var found string
	e := s.db.QueryRowContext(ctx, `SELECT account_id FROM sessions WHERE token_hash=? AND expires_at>?`, binding, now.Unix()).Scan(&found)
	if errors.Is(e, ErrNotFound) {
		return false, nil
	}
	if e != nil {
		return false, e
	}
	if e=s.journalState(ctx,account);errors.Is(e,ErrNotFound){return false,nil}else if e!=nil{return false,e}; return equal(found, account), nil
}
