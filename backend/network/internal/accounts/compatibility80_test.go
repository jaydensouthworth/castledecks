package accounts

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"
)

type compatibilityCase struct {
	Name, Kind, Document, Normalized string
	Valid, Legacy                    bool
}

func compatibilityCases(t *testing.T) []compatibilityCase {
	t.Helper()
	raw, err := os.ReadFile("testdata/compatibility80.json")
	if err != nil {
		t.Fatal(err)
	}
	var data struct {
		Source string
		Cases  []compatibilityCase
	}
	if err = json.Unmarshal(raw, &data); err != nil {
		t.Fatal(err)
	}
	if data.Source != "791a1055d29820abeaf1de83ec56e1cc80d5a4a9" || formatCatalog.Source != data.Source {
		t.Fatal("fixture authority mismatch")
	}
	return data.Cases
}
func TestAccepted80CodecCompatibility(t *testing.T) {
	for _, c := range compatibilityCases(t) {
		t.Run(c.Name, func(t *testing.T) {
			err := ValidateDocument(c.Kind, c.Document)
			if (err == nil) != c.Valid {
				t.Fatalf("Go acceptance differs from exact80 JS codec: valid=%v, err=%v", c.Valid, err)
			}
			if c.Valid {
				if err := ValidateDocument(c.Kind, c.Normalized); err != nil {
					t.Fatalf("explicit JS migration rejected: %v", err)
				}
			}
		})
	}
}
func TestAccepted80HTTPRoundTripAndExplicitMigration(t *testing.T) {
	for _, c := range compatibilityCases(t) {
		if !c.Valid {
			continue
		}
		t.Run(c.Name, func(t *testing.T) {
			store := storeFor(t)
			session, token := signIn(t, store, "synthetic")
			server := service(t, store, nil)
			path := "/api/saves/" + c.Kind + "/1"
			if w := request(t, server, "PUT", path, token, session.CSRF, envelope(c.Document), `"0"`); w.Code != 200 {
				t.Fatal(w.Code, w.Body.String())
			}
			saved, err := store.GetSave(context.Background(), session.AccountID, c.Kind, 1)
			if err != nil || saved.Document != c.Document || saved.Revision != 1 || saved.Trust != "client-reported" {
				t.Fatal("upload changed document or trust", err)
			}
			w := request(t, server, "GET", path, token, session.CSRF, "", "")
			var downloaded Save
			if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &downloaded) != nil || downloaded.Document != c.Document {
				t.Fatal("read changed original bytes")
			}
			// Only a separate reviewed request containing a JS-migrated document changes
			// the stored representation. A stale retry cannot replace it.
			if w := request(t, server, "PUT", path, token, session.CSRF, envelope(c.Normalized), `"1"`); w.Code != 200 {
				t.Fatal("explicit migration", w.Code, w.Body.String())
			}
			if w := request(t, server, "PUT", path, token, session.CSRF, envelope(c.Document), `"1"`); w.Code != 409 {
				t.Fatal("stale migration must conflict")
			}
			saved, err = store.GetSave(context.Background(), session.AccountID, c.Kind, 1)
			if err != nil || saved.Document != c.Normalized || saved.Revision != 2 {
				t.Fatal("migration lost fields or revision", err)
			}
		})
	}
}
func TestUnsupported80DocumentsNeverReplaceStoredCopy(t *testing.T) {
	cases := compatibilityCases(t)
	valid := map[string]string{}
	for _, c := range cases {
		if c.Valid {
			valid[c.Kind] = c.Document
		}
	}
	for _, c := range cases {
		if c.Valid {
			continue
		}
		t.Run(c.Name, func(t *testing.T) {
			store := storeFor(t)
			session, token := signIn(t, store, "synthetic")
			server := service(t, store, nil)
			path := "/api/saves/" + c.Kind + "/1"
			original := valid[c.Kind]
			if w := request(t, server, "PUT", path, token, session.CSRF, envelope(original), `"0"`); w.Code != 200 {
				t.Fatal("seed", w.Code)
			}
			if w := request(t, server, "PUT", path, token, session.CSRF, envelope(c.Document), `"1"`); w.Code != 400 {
				t.Fatal("unsupported incoming document", w.Code)
			}
			saved, err := store.GetSave(context.Background(), session.AccountID, c.Kind, 1)
			if err != nil || saved.Document != original || saved.Revision != 1 {
				t.Fatal("rejected document overwrote original", err)
			}
			// Model data written by a future service. It stays readable/exportable, but
			// the old service cannot overwrite content it does not understand.
			if _, err = store.PutSave(context.Background(), session.AccountID, c.Kind, 1, 1, c.Document, time.Now()); err != nil {
				t.Fatal(err)
			}
			if w := request(t, server, "PUT", path, token, session.CSRF, envelope(original), `"2"`); w.Code != 409 {
				t.Fatal("unsupported stored copy overwritten", w.Code)
			}
			w := request(t, server, "GET", path, token, session.CSRF, "", "")
			var downloaded Save
			if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &downloaded) != nil || downloaded.Document != c.Document || downloaded.Revision != 2 {
				t.Fatal("future bytes must remain available")
			}
		})
	}
}
func TestAccepted80LimitsRemainBounded(t *testing.T) {
	for kind, limit := range map[string]int{"decks": 32768, "crownroad": MaxDocument, "wayfarer": 1024 * 1024} {
		if ValidateDocument(kind, strings.Repeat(" ", limit+1)) == nil {
			t.Fatal("oversized", kind)
		}
	}
}

func FuzzAccepted80Documents(f *testing.F) {
	raw, err := os.ReadFile("testdata/compatibility80.json")
	if err != nil {
		f.Fatal(err)
	}
	var data struct{ Cases []compatibilityCase }
	if err = json.Unmarshal(raw, &data); err != nil {
		f.Fatal(err)
	}
	seeds := map[string]bool{"checkpoint-classic-azure": true, "checkpoint-highwatch-indigo-brass": true, "wayfarer-highwatch-ivory-slate": true, "decks-highwatch-indigo-brass": true, "future-owned-castle": true, "legacy-checkpoint-profile1-deckstrue": true}
	for _, c := range data.Cases {
		if seeds[c.Name] {
			f.Add(c.Kind, c.Document)
		}
	}
	f.Fuzz(func(t *testing.T, kind, document string) {
		if len(document) > MaxDocument+1 {
			return
		}
		_ = ValidateDocument(kind, document)
	})
}
