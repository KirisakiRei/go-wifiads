package handler

import (
	"math"
	"testing"
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
