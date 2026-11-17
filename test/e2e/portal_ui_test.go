//go:build e2e

package e2e

import (
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

// TestPortalPageRenders ensures the redesigned portal template executes without
// error (bad field references fail at render time, not parse time) and that the
// three reference screens plus the stylesheet are present.
func TestPortalPageRenders(t *testing.T) {
	h := newHarness(t)
	defer h.stop()

	res, err := http.Get(h.baseURL + "/portal?mac=AA:BB:CC:DD:EE:10&ip=10.0.0.5")
	if err != nil {
		t.Fatalf("GET /portal: %v", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.StatusCode)
	}
	buf := make([]byte, 64*1024)
	n, _ := res.Body.Read(buf)
	html := string(buf[:n])

	for _, want := range []string{
		"Selamat Datang",
		"screen-welcome",
		"screen-ad",
		"screen-connected",
		"/static/css/portal.css",
		"Mulai Sekarang",
	} {
		if !strings.Contains(html, want) {
			t.Fatalf("portal HTML missing %q", want)
		}
	}
}

// TestPortalStylesheetServed ensures the new stylesheet is actually embedded
// and served (otherwise the page would render unstyled).
func TestPortalStylesheetServed(t *testing.T) {
	h := newHarness(t)
	defer h.stop()

	res, err := http.Get(h.baseURL + "/static/css/portal.css")
	if err != nil {
		t.Fatalf("GET portal.css: %v", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("stylesheets must be served, got %d", res.StatusCode)
	}
}

// TestPortalConfigIsInertJSON is the XSS regression: every Hotspot value arrives
// from the query string, so it must never be executable. The config is embedded
// as an application/json block and the dangerous characters must be escaped.
func TestPortalConfigIsInertJSON(t *testing.T) {
	h := newHarness(t)
	defer h.stop()

	payload := `</script><img src=x onerror=alert(1)>`
	res, err := http.Get(h.baseURL + "/portal?mac=" + url.QueryEscape(payload) + "&link-login-only=" + url.QueryEscape("https://evil.example/login"))
	if err != nil {
		t.Fatalf("GET /portal: %v", err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	html := string(body)

	// The raw dangerous payload must never appear unescaped.
	if strings.Contains(html, "<img src=x onerror=alert(1)>") {
		t.Fatalf("portal HTML contains an unescaped injection payload")
	}
	if strings.Contains(html, "</script><img") {
		t.Fatalf("portal HTML allows breaking out of the script tag")
	}
	// The config block must be present and escaped as \u003c...\u003e text.
	if !strings.Contains(html, `id="portal-config" type="application/json"`) {
		t.Fatalf("portal config block missing")
	}
	if !strings.Contains(html, `\u003c/script\u003e`) {
		t.Fatalf("expected escaped payload inside config JSON")
	}
}
