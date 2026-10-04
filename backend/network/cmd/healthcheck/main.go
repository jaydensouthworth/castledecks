package main

import (
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"time"
)

func main() {
	u, e := url.Parse(os.Getenv("PUBLIC_ORIGIN"))
	if e != nil || u.Scheme != "https" || u.Host == "" {
		os.Exit(1)
	}
	r, e := http.NewRequest("GET", "http://127.0.0.1:8080/api/ready", nil)
	if e != nil {
		os.Exit(1)
	}
	r.Host = u.Host
	c := &http.Client{Timeout: 2 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	v, e := c.Do(r)
	if e != nil {
		os.Exit(1)
	}
	defer v.Body.Close()
	var body struct {
		Ready bool `json:"ready"`
	}
	if v.StatusCode != 200 || json.NewDecoder(http.MaxBytesReader(nil, v.Body, 1024)).Decode(&body) != nil || !body.Ready {
		os.Exit(1)
	}
}
