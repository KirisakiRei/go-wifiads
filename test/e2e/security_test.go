//go:build e2e

package e2e

import (
	"net/http"
	"strings"
	"testing"
)

// TestSecurityHeaders ensures the defensive headers are present on portal and
// admin pages so clickjacking, MIME sniffing and inline-script injection are
// mitigated at the transport layer.
func TestSecurityHeaders(t *testing.T) {
	h := newHarness(t)
	defer h.stop()

	for _, path := range []string{"/portal", "/admin/login", "/health/live"} {
		res, err := http.Get(h.baseURL + path)
		if err != nil {
			t.Fatalf("GET %s: %v", path, err)
		}
		res.Body.Close()

		csp := res.Header.Get("Content-Security-Policy")
		if !strings.Contains(csp, "frame-ancestors 'none'") || !strings.Contains(csp, "script-src 'self'") {
			t.Fatalf("%s: weak or missing CSP: %q", path, csp)
		}
		if got := res.Header.Get("X-Frame-Options"); got != "DENY" {
			t.Fatalf("%s: expected X-Frame-Options DENY, got %q", path, got)
		}
		if got := res.Header.Get("X-Content-Type-Options"); got != "nosniff" {
			t.Fatalf("%s: expected nosniff, got %q", path, got)
		}
		if got := res.Header.Get("Referrer-Policy"); got != "no-referrer" {
			t.Fatalf("%s: expected no-referrer, got %q", path, got)
		}
	}
}

// TestAdminLoginRateLimited proves the login endpoint is throttled far below the
// general API limit: brute-forcing the admin password must hit 429 quickly.
func TestAdminLoginRateLimited(t *testing.T) {
	h := newHarness(t)
	defer h.stop()

	sawTooMany := false
	for i := 0; i < 20; i++ {
		res, err := http.Post(h.baseURL+"/api/v1/admin/auth/login",
			"application/json",
			strings.NewReader(`{"username":"admin","password":"wrong"}`))
		if err != nil {
			t.Fatalf("login attempt %d: %v", i, err)
		}
		res.Body.Close()
		if res.StatusCode == http.StatusTooManyRequests {
			sawTooMany = true
			break
		}
	}
	if !sawTooMany {
		t.Fatalf("expected 429 after repeated failed logins, never seen")
	}
}
