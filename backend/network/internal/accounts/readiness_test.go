package accounts

import (
	"net/http/httptest"
	"testing"
)

func TestDeploymentReadiness(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		t.Run(map[bool]string{false: "disabled", true: "configured"}[enabled], func(t *testing.T) {
			store := storeFor(t)
			var provider IdentityProvider
			if enabled {
				provider = &fakeProvider{}
			}
			s := service(t, store, provider)
			probe := func(path string) int {
				r := httptest.NewRequest("GET", "https://game.invalid"+path, nil)
				r.Host = "game.invalid"
				w := httptest.NewRecorder()
				s.Handler().ServeHTTP(w, r)
				return w.Code
			}
			expected := 503
			if enabled {
				expected = 200
			}
			if code := probe("/api/ready"); code != expected {
				t.Fatalf("ready=%d wanted=%d", code, expected)
			}
			store.Close()
			if code := probe("/api/ready"); code != 503 {
				t.Fatalf("closed db ready=%d", code)
			}
			if code := probe("/api/health"); code != 200 {
				t.Fatalf("liveness=%d", code)
			}
		})
	}
}
