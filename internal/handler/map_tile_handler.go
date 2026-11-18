package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
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

// MapTileHandler serves cached street map tiles from same-origin so browser
// privacy settings never trigger 403/API-key errors on third-party CDNs, while
// strictly respecting OpenStreetMap's caching & User-Agent usage policy.
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
	u := "https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=id&q=" + url.QueryEscape(q)
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, u, nil)
	if err != nil {
		httpx.OK(c, "OK", []any{})
		return
	}
	req.Header.Set("User-Agent", h.userAgent)
	req.Header.Set("Referer", h.publicURL+"/")
	req.Header.Set("Accept-Language", "id,en;q=0.8")

	resp, err := h.client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			resp.Body.Close()
		}
		httpx.OK(c, "OK", []any{})
		return
	}
	defer resp.Body.Close()

	var raw []struct {
		DisplayName string `json:"display_name"`
		Lat         string `json:"lat"`
		Lon         string `json:"lon"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 256*1024)).Decode(&raw); err != nil {
		httpx.OK(c, "OK", []any{})
		return
	}

	type placeResult struct {
		DisplayName string  `json:"display_name"`
		Latitude    float64 `json:"latitude"`
		Longitude   float64 `json:"longitude"`
	}
	out := make([]placeResult, 0, len(raw))
	for _, item := range raw {
		lat, e1 := strconv.ParseFloat(item.Lat, 64)
		lng, e2 := strconv.ParseFloat(item.Lon, 64)
		if e1 == nil && e2 == nil {
			out = append(out, placeResult{
				DisplayName: item.DisplayName,
				Latitude:    lat,
				Longitude:   lng,
			})
		}
	}
	httpx.OK(c, "Hasil pencarian lokasi", out)
}
