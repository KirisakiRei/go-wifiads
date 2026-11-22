package handler

import (
	"bytes"
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestExtractGoogleMapsCoordinates(t *testing.T) {
	cases := []struct {
		name      string
		url       string
		html      string
		wantLat   float64
		wantLng   float64
		wantPlace string
	}{
		{
			name:      "Full place URL prefers exact !3d!4d pin over @viewport",
			url:       "https://www.google.com/maps/place/Kafe+Kopi+Nusantara/@3.580000,98.670000,17z/data=!3m1!4b1!4m6!3m5!1s0x123:0x456!8m2!3d3.589462!4d98.674162!16s",
			wantLat:   3.589462,
			wantLng:   98.674162,
			wantPlace: "Kafe Kopi Nusantara",
		},
		{
			name:    "Query param ?q=lat,lng",
			url:     "https://maps.google.com/?q=-6.208763,106.845599&z=18",
			wantLat: -6.208763,
			wantLng: 106.845599,
		},
		{
			name:    "Search API URL ?api=1&query=lat%2Clng",
			url:     "https://www.google.com/maps/search/?api=1&query=3.589462%2C98.674162",
			wantLat: 3.589462,
			wantLng: 98.674162,
		},
		{
			name:    "Viewport @lat,lng URL",
			url:     "https://www.google.com/maps/@-6.175392,106.827153,16z",
			wantLat: -6.175392,
			wantLng: 106.827153,
		},
		{
			name:    "HTML staticmap og:image fallback",
			url:     "",
			html:    `<meta property="og:image" content="https://maps.google.com/maps/api/staticmap?center=3.589462%2C98.674162&amp;zoom=17">`,
			wantLat: 3.589462,
			wantLng: 98.674162,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			lat, lng, place, ok := ExtractGoogleMapsCoordinates(tc.url, tc.html)
			if !ok {
				t.Fatalf("expected ok=true, got false")
			}
			if math.Abs(lat-tc.wantLat) > 1e-6 || math.Abs(lng-tc.wantLng) > 1e-6 {
				t.Fatalf("got (%f, %f), want (%f, %f)", lat, lng, tc.wantLat, tc.wantLng)
			}
			if tc.wantPlace != "" && place != tc.wantPlace {
				t.Fatalf("got place %q, want %q", place, tc.wantPlace)
			}
		})
	}
}

func TestExtractFirstURLGluedDuplicate(t *testing.T) {
	got := extractFirstURL("https://maps.app.goo.gl/dsTfsZ8Kf5UKjYeo8https://maps.app.goo.gl/dsTfsZ8Kf5UKjYeo8")
	want := "https://maps.app.goo.gl/dsTfsZ8Kf5UKjYeo8"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

// A dead or expired share link answers 404 from Google: the API must say the link
// is gone instead of blaming the pin coordinates.
func TestResolveGoogleMapsLinkExpiredLink(t *testing.T) {
	gin.SetMode(gin.TestMode)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	h := NewMapTileHandler("")
	h.client = &http.Client{
		Transport: &rewriteHostTransport{target: srv.URL},
	}

	r := gin.New()
	r.POST("/resolve", h.ResolveGoogleMapsLink)
	body, _ := json.Marshal(map[string]string{"input": "https://maps.app.goo.gl/dsTfsZ8Kf5UKjYe08"})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/resolve", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d (body %s)", w.Code, http.StatusUnprocessableEntity, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "LINK_EXPIRED") {
		t.Fatalf("expected LINK_EXPIRED error code, got %s", w.Body.String())
	}
}

// rewriteHostTransport sends every request to a local test server, keeping the
// original Host header so the allowlist check still sees a Google Maps host.
type rewriteHostTransport struct{ target string }

func (rt *rewriteHostTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	u, err := url.Parse(rt.target)
	if err != nil {
		return nil, err
	}
	out := req.Clone(req.Context())
	out.URL.Scheme = u.Scheme
	out.URL.Host = u.Host
	return http.DefaultTransport.RoundTrip(out)
}
