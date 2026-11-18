package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"wifiads/pkg/httpx"
)

const (
	tileCacheTTL      = 7 * 24 * time.Hour
	maxTileSizeBytes  = 512 * 1024
	defaultTileOrigin = "https://wifiads.smartscales.web.id"
)

var (
	reExtractURL    = regexp.MustCompile(`https?://[^\s"'<>]+`)
	rePin3d4d       = regexp.MustCompile(`!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)`)
	reViewportAt    = regexp.MustCompile(`/@(-?\d+\.\d+),(-?\d+\.\d+)`)
	reSearchPath    = regexp.MustCompile(`/maps/search/(-?\d+\.\d+),\s*\+?(-?\d+\.\d+)`)
	reStaticCenter  = regexp.MustCompile(`center=(-?\d+\.\d+)(?:%2C|,)\s*(-?\d+\.\d+)`)
	rePlaceSegment  = regexp.MustCompile(`/maps/place/([^/@?]+)`)
	reRawCoordInput = regexp.MustCompile(`^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$`)
)

// MapTileHandler serves cached street map tiles from same-origin, place search,
// and Google Maps share-link coordinate extraction.
type MapTileHandler struct {
	client    *http.Client
	publicURL string
	userAgent string
}

func NewMapTileHandler(publicBaseURL string) *MapTileHandler {
	origin := strings.TrimRight(strings.TrimSpace(publicBaseURL), "/")
	if origin == "" {
		origin = defaultTileOrigin
	}
	return &MapTileHandler{
		client: &http.Client{
			Timeout: 8 * time.Second,
		},
		publicURL: origin,
		userAgent: fmt.Sprintf("AdWaveWiFi-TileCache/1.0 (+%s)", origin),
	}
}

func (h *MapTileHandler) ServeTile(c *gin.Context) {
	z, errZ := strconv.Atoi(c.Param("z"))
	x, errX := strconv.Atoi(c.Param("x"))
	rawY := strings.TrimSuffix(c.Param("y"), ".png")
	rawY = strings.TrimSuffix(rawY, "@2x")
	y, errY := strconv.Atoi(rawY)

	if errZ != nil || errX != nil || errY != nil || z < 0 || z > 19 {
		c.Status(http.StatusBadRequest)
		return
	}
	maxCoord := 1 << z
	if x < 0 || x >= maxCoord || y < 0 || y >= maxCoord {
		c.Status(http.StatusBadRequest)
		return
	}

	cacheFile := filepath.Join("uploads", "tilecache", strconv.Itoa(z), strconv.Itoa(x), strconv.Itoa(y)+".tile")
	if info, err := os.Stat(cacheFile); err == nil && !info.IsDir() && time.Since(info.ModTime()) < tileCacheTTL {
		data, readErr := os.ReadFile(cacheFile)
		if readErr == nil && len(data) > 0 {
			c.Header("Cache-Control", "public, max-age=604800")
			c.Data(http.StatusOK, http.DetectContentType(data), data)
			return
		}
	}

	upstreams := []string{
		fmt.Sprintf("https://tile.openstreetmap.org/%d/%d/%d.png", z, x, y),
		fmt.Sprintf("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/%d/%d/%d", z, y, x),
	}

	ctx := c.Request.Context()
	for _, upstreamURL := range upstreams {
		data, contentType, fetchErr := h.fetchTile(ctx, upstreamURL)
		if fetchErr == nil && len(data) > 0 {
			if mkErr := os.MkdirAll(filepath.Dir(cacheFile), 0o755); mkErr == nil {
				_ = os.WriteFile(cacheFile, data, 0o644)
			}
			if contentType == "" {
				contentType = http.DetectContentType(data)
			}
			c.Header("Cache-Control", "public, max-age=604800")
			c.Data(http.StatusOK, contentType, data)
			return
		}
	}

	if data, readErr := os.ReadFile(cacheFile); readErr == nil && len(data) > 0 {
		c.Header("Cache-Control", "public, max-age=3600")
		c.Data(http.StatusOK, http.DetectContentType(data), data)
		return
	}

	c.Status(http.StatusBadGateway)
}

func (h *MapTileHandler) fetchTile(ctx context.Context, upstreamURL string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, upstreamURL, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", h.userAgent)
	req.Header.Set("Referer", h.publicURL+"/")
	req.Header.Set("Accept", "image/png,image/webp,image/*;q=0.8")

	resp, err := h.client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("upstream status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxTileSizeBytes))
	if err != nil {
		return nil, "", err
	}
	return data, resp.Header.Get("Content-Type"), nil
}

// SearchPlace proxies place/street search to OpenStreetMap Nominatim so Leaflet pin pickers
// can jump directly to a street or city while keeping strict same-origin CSP.
func (h *MapTileHandler) SearchPlace(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if len(q) < 2 {
		httpx.OK(c, "OK", []any{})
		return
	}
	out := h.searchNominatim(c.Request.Context(), q, 5)
	httpx.OK(c, "Hasil pencarian lokasi", out)
}

type placeSearchResult struct {
	DisplayName string  `json:"display_name"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
}

func (h *MapTileHandler) searchNominatim(ctx context.Context, q string, limit int) []placeSearchResult {
	u := fmt.Sprintf("https://nominatim.openstreetmap.org/search?format=json&limit=%d&countrycodes=id&q=%s", limit, url.QueryEscape(q))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return []placeSearchResult{}
	}
	req.Header.Set("User-Agent", h.userAgent)
	req.Header.Set("Referer", h.publicURL+"/")
	req.Header.Set("Accept-Language", "id,en;q=0.8")

	resp, err := h.client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			resp.Body.Close()
		}
		return []placeSearchResult{}
	}
	defer resp.Body.Close()

	var raw []struct {
		DisplayName string `json:"display_name"`
		Lat         string `json:"lat"`
		Lon         string `json:"lon"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 256*1024)).Decode(&raw); err != nil {
		return []placeSearchResult{}
	}

	out := make([]placeSearchResult, 0, len(raw))
	for _, item := range raw {
		lat, e1 := strconv.ParseFloat(item.Lat, 64)
		lng, e2 := strconv.ParseFloat(item.Lon, 64)
		if e1 == nil && e2 == nil && isValidCoord(lat, lng) {
			out = append(out, placeSearchResult{
				DisplayName: item.DisplayName,
				Latitude:    lat,
				Longitude:   lng,
			})
		}
	}
	return out
}

func (h *MapTileHandler) reverseGeocode(ctx context.Context, lat, lng float64) string {
	revCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	u := fmt.Sprintf("https://nominatim.openstreetmap.org/reverse?format=json&lat=%.6f&lon=%.6f&zoom=18", lat, lng)
	req, err := http.NewRequestWithContext(revCtx, http.MethodGet, u, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("User-Agent", h.userAgent)
	req.Header.Set("Referer", h.publicURL+"/")
	req.Header.Set("Accept-Language", "id,en;q=0.8")

	resp, err := h.client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			resp.Body.Close()
		}
		return ""
	}
	defer resp.Body.Close()

	var payload struct {
		DisplayName string `json:"display_name"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64*1024)).Decode(&payload); err != nil {
		return ""
	}
	return strings.TrimSpace(payload.DisplayName)
}

type resolveMapLinkRequest struct {
	Input string `json:"input" binding:"required,min=4,max=2048"`
}

type resolvedMapLocation struct {
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	PlaceName   string  `json:"place_name,omitempty"`
	DisplayName string  `json:"display_name,omitempty"`
}

// ResolveGoogleMapsLink extracts accurate coordinates & street address from a shared
// Google Maps link (including shortened https://maps.app.goo.gl/... or https://goo.gl/maps/...).
func (h *MapTileHandler) ResolveGoogleMapsLink(c *gin.Context) {
	var req resolveMapLinkRequest
	if !bindJSON(c, &req, "Masukkan tautan bagikan lokasi Google Maps") {
		return
	}
	raw := strings.TrimSpace(req.Input)

	// 1. Direct coordinate pair fallback if user pasted numbers
	if m := reRawCoordInput.FindStringSubmatch(raw); len(m) == 3 {
		lat, e1 := strconv.ParseFloat(m[1], 64)
		lng, e2 := strconv.ParseFloat(m[2], 64)
		if e1 == nil && e2 == nil && isValidCoord(lat, lng) {
			addr := h.reverseGeocode(c.Request.Context(), lat, lng)
			httpx.OK(c, "Titik lokasi berhasil ditemukan", resolvedMapLocation{
				Latitude:    lat,
				Longitude:   lng,
				DisplayName: addr,
			})
			return
		}
	}

	// 2. Extract URL from pasted text (supports full WhatsApp share text + link)
	extractedURL := reExtractURL.FindString(raw)
	if extractedURL == "" {
		httpx.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Format tautan Google Maps tidak dikenali. Silakan klik Bagikan (Share) di Google Maps lalu salin tautannya.", nil)
		return
	}

	// 3. Try parsing directly from the pasted URL before making any network call
	if lat, lng, place, ok := ExtractGoogleMapsCoordinates(extractedURL, ""); ok {
		addr := h.reverseGeocode(c.Request.Context(), lat, lng)
		if addr == "" {
			addr = place
		}
		httpx.OK(c, "Titik lokasi Google Maps berhasil diambil", resolvedMapLocation{
			Latitude:    lat,
			Longitude:   lng,
			PlaceName:   place,
			DisplayName: addr,
		})
		return
	}

	// 4. Validate domain against strict Google Maps allowlist before following redirects (SSRF protection)
	parsedStart, pErr := url.Parse(extractedURL)
	if pErr != nil || !isAllowedMapsHost(parsedStart.Hostname()) {
		httpx.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Hanya tautan resmi Google Maps (maps.app.goo.gl / google.com/maps) yang didukung.", nil)
		return
	}
	if parsedStart.Scheme != "https" && parsedStart.Scheme != "http" {
		httpx.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Skema tautan tidak valid.", nil)
		return
	}

	visitedURLs := []string{extractedURL}
	redirectClient := &http.Client{
		Timeout: 8 * time.Second,
		CheckRedirect: func(r *http.Request, via []*http.Request) error {
			if len(via) >= 7 {
				return errors.New("terlalu banyak pengalihan tautan")
			}
			if !isAllowedMapsHost(r.URL.Hostname()) {
				return errors.New("pengalihan ke domain di luar Google Maps ditolak")
			}
			visitedURLs = append(visitedURLs, r.URL.String())
			return nil
		},
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	outReq, err := http.NewRequestWithContext(ctx, http.MethodGet, extractedURL, nil)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Tautan tidak dapat diproses", nil)
		return
	}
	outReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
	outReq.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	outReq.Header.Set("Accept-Language", "id-ID,id;q=0.9,en-US;q=0.8")

	resp, err := redirectClient.Do(outReq)
	var bodySnippet string
	if resp != nil {
		defer resp.Body.Close()
		if resp.Request != nil && resp.Request.URL != nil {
			visitedURLs = append(visitedURLs, resp.Request.URL.String())
		}
		if locHdr := resp.Header.Get("Location"); locHdr != "" {
			visitedURLs = append(visitedURLs, locHdr)
		}
		rawBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
		bodySnippet = string(rawBytes)
	} else if err != nil && len(visitedURLs) <= 1 {
		httpx.Error(c, http.StatusBadGateway, "BAD_GATEWAY", "Gagal menghubungi server Google Maps, silakan coba lagi atau gunakan pencarian nama jalan.", nil)
		return
	}

	// Check all visited redirect URLs (from final back to initial) + HTML snippet
	var placeHint string
	for i := len(visitedURLs) - 1; i >= 0; i-- {
		uStr := visitedURLs[i]
		if lat, lng, place, ok := ExtractGoogleMapsCoordinates(uStr, ""); ok {
			addr := h.reverseGeocode(c.Request.Context(), lat, lng)
			if addr == "" {
				addr = place
			}
			httpx.OK(c, "Titik lokasi Google Maps berhasil diambil", resolvedMapLocation{
				Latitude:    lat,
				Longitude:   lng,
				PlaceName:   place,
				DisplayName: addr,
			})
			return
		}
		if placeHint == "" {
			placeHint = extractPlaceNameFromMapsURL(uStr)
		}
	}

	if lat, lng, place, ok := ExtractGoogleMapsCoordinates("", bodySnippet); ok {
		if place == "" {
			place = placeHint
		}
		addr := h.reverseGeocode(c.Request.Context(), lat, lng)
		if addr == "" {
			addr = place
		}
		httpx.OK(c, "Titik lokasi Google Maps berhasil diambil", resolvedMapLocation{
			Latitude:    lat,
			Longitude:   lng,
			PlaceName:   place,
			DisplayName: addr,
		})
		return
	}

	// Fallback: if Google Maps short link resolved to a named place query without coordinates in URL, search Nominatim
	if placeHint != "" {
		found := h.searchNominatim(c.Request.Context(), placeHint, 1)
		if len(found) > 0 {
			httpx.OK(c, "Lokasi ditemukan berdasarkan nama tempat Google Maps", resolvedMapLocation{
				Latitude:    found[0].Latitude,
				Longitude:   found[0].Longitude,
				PlaceName:   placeHint,
				DisplayName: found[0].DisplayName,
			})
			return
		}
	}

	httpx.Error(c, http.StatusUnprocessableEntity, "UNPROCESSABLE_ENTITY", "Titik koordinat tidak ditemukan pada tautan tersebut. Pastikan menyalin tautan lokasi spesifik atau cari nama jalan di kolom pencarian.", nil)
}

func isAllowedMapsHost(host string) bool {
	h := strings.ToLower(strings.TrimSpace(host))
	switch h {
	case "maps.app.goo.gl", "goo.gl", "google.com", "www.google.com", "maps.google.com", "google.co.id", "www.google.co.id", "maps.google.co.id":
		return true
	default:
		return false
	}
}

func isValidCoord(lat, lng float64) bool {
	if lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		return false
	}
	if lat == 0 && lng == 0 {
		return false
	}
	return true
}

func extractPlaceNameFromMapsURL(rawURL string) string {
	if rawURL == "" {
		return ""
	}
	if m := rePlaceSegment.FindStringSubmatch(rawURL); len(m) == 2 {
		decoded, err := url.QueryUnescape(strings.ReplaceAll(m[1], "+", " "))
		if err == nil {
			clean := strings.TrimSpace(decoded)
			if reRawCoordInput.MatchString(clean) {
				return ""
			}
			return clean
		}
	}
	if parsed, err := url.Parse(rawURL); err == nil {
		for _, key := range []string{"q", "query"} {
			if val := strings.TrimSpace(parsed.Query().Get(key)); val != "" && !reRawCoordInput.MatchString(val) {
				return val
			}
		}
	}
	return ""
}

// ExtractGoogleMapsCoordinates parses exact POI coordinates from a Google Maps URL or HTML body.
func ExtractGoogleMapsCoordinates(rawURL string, htmlBody string) (lat, lng float64, placeName string, ok bool) {
	placeName = extractPlaceNameFromMapsURL(rawURL)

	// 1. Exact POI pin (!3dLAT!4dLNG) in URL — highest precision
	if rawURL != "" {
		decodedURL, err := url.QueryUnescape(rawURL)
		if err != nil {
			decodedURL = rawURL
		}
		if m := rePin3d4d.FindStringSubmatch(decodedURL); len(m) == 3 {
			if la, lo, valid := parsePair(m[1], m[2]); valid {
				return la, lo, placeName, true
			}
		}

		// 2. Query parameters (?q=lat,lng, ?query=lat,lng, ?ll=lat,lng, ?center=lat,lng, ?destination=lat,lng)
		if parsed, pErr := url.Parse(rawURL); pErr == nil {
			q := parsed.Query()
			for _, key := range []string{"q", "query", "ll", "center", "destination", "daddr"} {
				val := strings.TrimSpace(q.Get(key))
				if val == "" {
					continue
				}
				// Strip prefix like "loc:" if present
				val = strings.TrimPrefix(strings.ToLower(val), "loc:")
				if cm := reRawCoordInput.FindStringSubmatch(val); len(cm) == 3 {
					if la, lo, valid := parsePair(cm[1], cm[2]); valid {
						return la, lo, placeName, true
					}
				}
			}
		}

		// 3. /maps/search/lat,lng path
		if m := reSearchPath.FindStringSubmatch(decodedURL); len(m) == 3 {
			if la, lo, valid := parsePair(m[1], m[2]); valid {
				return la, lo, placeName, true
			}
		}

		// 4. Viewport /@lat,lng in URL
		if m := reViewportAt.FindStringSubmatch(decodedURL); len(m) == 3 {
			if la, lo, valid := parsePair(m[1], m[2]); valid {
				return la, lo, placeName, true
			}
		}
	}

	// 5. Fallback to HTML body patterns (!3d!4d, staticmap center=, /@lat,lng)
	if htmlBody != "" {
		if m := rePin3d4d.FindStringSubmatch(htmlBody); len(m) == 3 {
			if la, lo, valid := parsePair(m[1], m[2]); valid {
				return la, lo, placeName, true
			}
		}
		if m := reStaticCenter.FindStringSubmatch(htmlBody); len(m) == 3 {
			if la, lo, valid := parsePair(m[1], m[2]); valid {
				return la, lo, placeName, true
			}
		}
		if m := reViewportAt.FindStringSubmatch(htmlBody); len(m) == 3 {
			if la, lo, valid := parsePair(m[1], m[2]); valid {
				return la, lo, placeName, true
			}
		}
	}

	return 0, 0, placeName, false
}

func parsePair(latStr, lngStr string) (float64, float64, bool) {
	la, e1 := strconv.ParseFloat(strings.TrimSpace(latStr), 64)
	lo, e2 := strconv.ParseFloat(strings.TrimSpace(lngStr), 64)
	if e1 != nil || e2 != nil || !isValidCoord(la, lo) {
		return 0, 0, false
	}
	return la, lo, true
}
