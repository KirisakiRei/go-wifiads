package handler

import (
	"errors"
	"io"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"wifiads/internal/dto"
	"wifiads/internal/middleware"
	"wifiads/internal/service"
	"wifiads/pkg/httpx"
	"wifiads/pkg/media"
	"wifiads/pkg/storage"
)

// AdvertisementHandler handles sponsor advertisement management and R2 media uploads.
type AdvertisementHandler struct {
	ads service.AdvertisementService
	r2  *storage.R2Client
}

// NewAdvertisementHandler creates a new AdvertisementHandler instance.
func NewAdvertisementHandler(ads service.AdvertisementService, r2 ...*storage.R2Client) *AdvertisementHandler {
	h := &AdvertisementHandler{ads: ads}
	if len(r2) > 0 {
		h.r2 = r2[0]
	}
	return h
}

// List returns all advertisements.
func (h *AdvertisementHandler) List(c *gin.Context) {
	items, err := h.ads.List(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Advertisements retrieved", items)
}

// Get returns an advertisement by ID.
func (h *AdvertisementHandler) Get(c *gin.Context) {
	item, err := h.ads.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Advertisement retrieved", item)
}

// Create creates a new advertisement.
func (h *AdvertisementHandler) Create(c *gin.Context) {
	var req dto.CreateAdvertisementRequest
	if !bindJSON(c, &req, "Invalid advertisement payload") {
		return
	}
	item, err := h.ads.Create(c.Request.Context(), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Created(c, "Advertisement created", item)
}

// Update updates an advertisement.
func (h *AdvertisementHandler) Update(c *gin.Context) {
	var req dto.UpdateAdvertisementRequest
	if !bindJSON(c, &req, "Invalid advertisement update payload") {
		return
	}
	item, err := h.ads.Update(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Advertisement updated", item)
}

// Delete removes an advertisement and returns a standard 200 JSON payload.
func (h *AdvertisementHandler) Delete(c *gin.Context) {
	if err := h.ads.Delete(c.Request.Context(), c.Param("id")); err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Advertisement deleted", nil)
}

// UploadImage handles file uploads for advertisement banners (images, videos, and thumbnails)
// into a structured Cloudflare R2 hierarchy:
//   - Admin uploads      : ads/admin/media/{videos|photos|thumbnails}/<uuid>.<ext>
//   - Advertiser uploads : ads/pengiklan/<user_id>/media/{videos|photos|thumbnails}/<uuid>.<ext>
func (h *AdvertisementHandler) UploadImage(c *gin.Context) {
	file, err := c.FormFile("image")
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "BAD_REQUEST", "File media wajib diunggah", err.Error())
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	imageExts := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".webp": true,
		".svg":  true,
	}
	videoExts := map[string]bool{
		".mp4":  true,
		".webm": true,
		".mov":  true,
		".ogg":  true,
	}

	isImage := imageExts[ext]
	isVideo := videoExts[ext]

	if !isImage && !isVideo {
		httpx.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Format media harus berupa gambar (JPG, PNG, WebP, SVG) atau video (MP4, WebM, MOV)", nil)
		return
	}

	maxSize := int64(10 * 1024 * 1024)
	if isVideo {
		maxSize = 50 * 1024 * 1024
	}
	if file.Size > maxSize {
		limitMB := maxSize / (1024 * 1024)
		httpx.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Ukuran file melebihi batas maksimal", map[string]any{
			"max_mb": limitMB,
		})
		return
	}

	src, err := file.Open()
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "Gagal membaca file unggahan", err.Error())
		return
	}
	defer src.Close()

	data, err := io.ReadAll(src)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "Gagal membaca isi file media", err.Error())
		return
	}

	// Build structured R2 folder path:
	// - ads/admin/media/{videos|photos|thumbnails}/<uuid>.<ext>
	// - ads/pengiklan/<user_id>/media/{videos|photos|thumbnails}/<uuid>.<ext>
	role := strings.ToLower(strings.TrimSpace(middleware.AdminRole(c)))
	adminID := strings.TrimSpace(middleware.AdminID(c))
	ownerType := strings.ToLower(strings.TrimSpace(c.PostForm("owner_type")))

	ownerPrefix := "ads/admin/media"
	if role == "pengiklan" || role == "advertiser" || ownerType == "pengiklan" {
		if adminID == "" {
			adminID = "general"
		}
		ownerPrefix = "ads/pengiklan/" + adminID + "/media"
	}

	kind := strings.ToLower(strings.TrimSpace(c.PostForm("kind")))
	categoryFolder := "photos"
	if kind == "thumbnail" {
		categoryFolder = "thumbnails"
	} else if isVideo {
		categoryFolder = "videos"
	}

	contentType := detectMediaContentType(ext)
	var posterBytes []byte
	videoDurationSec := 0
	transcoded := false
	if isVideo {
		processed, pErr := media.ProcessVideo(c.Request.Context(), data, ext, 60)
		if pErr != nil {
			if errors.Is(pErr, media.ErrVideoTooLong) {
				httpx.Error(c, http.StatusBadRequest, "VIDEO_TOO_LONG", pErr.Error(), nil)
				return
			}
		} else if processed != nil {
			data = processed.VideoBytes
			ext = processed.Ext
			contentType = processed.ContentType
			posterBytes = processed.PosterBytes
			videoDurationSec = processed.DurationSeconds
			transcoded = processed.Transcoded
		}
	}

	baseID := uuid.NewString()
	filename := baseID + ext
	objectKey := path.Join(ownerPrefix, categoryFolder, filename)

	// 1. Primary Storage: Upload to Cloudflare R2 if configured
	if h.r2 != nil && h.r2.Enabled() {
		if r2Err := h.r2.PutObject(c.Request.Context(), objectKey, data, contentType); r2Err != nil {
			httpx.Error(c, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "Gagal mengunggah media ke Cloudflare R2 Object Storage", r2Err.Error())
			return
		}
	}

	// 2. Local Edge Cache: Write to ./uploads/<objectKey> for fast Range streaming
	localFilePath := filepath.Join(".", "uploads", filepath.FromSlash(objectKey))
	if mkErr := os.MkdirAll(filepath.Dir(localFilePath), 0o755); mkErr == nil {
		_ = os.WriteFile(localFilePath, data, 0o644)
	} else if h.r2 == nil || !h.r2.Enabled() {
		httpx.Error(c, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "Gagal menyiapkan folder penyimpanan", mkErr.Error())
		return
	}

	posterURL := ""
	if len(posterBytes) > 0 {
		posterKey := path.Join(ownerPrefix, "thumbnails", baseID+".jpg")
		if h.r2 != nil && h.r2.Enabled() {
			_ = h.r2.PutObject(c.Request.Context(), posterKey, posterBytes, "image/jpeg")
		}
		localPosterPath := filepath.Join(".", "uploads", filepath.FromSlash(posterKey))
		if mkErr := os.MkdirAll(filepath.Dir(localPosterPath), 0o755); mkErr == nil {
			_ = os.WriteFile(localPosterPath, posterBytes, 0o644)
		}
		posterURL = "/uploads/" + posterKey
	}

	mediaType := "image"
	if isVideo {
		mediaType = "video"
	}

	imageURL := "/uploads/" + objectKey
	r2URL := ""
	if h.r2 != nil && h.r2.Enabled() {
		r2URL = h.r2.PublicURL(objectKey)
	}

	httpx.Created(c, "File media berhasil diunggah ke Cloudflare R2", gin.H{
		"url":              imageURL,
		"r2_url":           r2URL,
		"poster_url":       posterURL,
		"object_key":       objectKey,
		"filename":         filename,
		"media_type":       mediaType,
		"duration_seconds": videoDurationSec,
		"transcoded":       transcoded,
	})
}

// ServeMedia serves advertisement media from the local edge cache or pulls it on-demand
// from Cloudflare R2 Object Storage. Using http.ServeFile preserves HTTP Range
// headers (206 Partial Content) required for fast HTML5 <video> chunk streaming.
func (h *AdvertisementHandler) ServeMedia(c *gin.Context) {
	rawPath := strings.TrimPrefix(c.Param("filepath"), "/")
	cleanRel := path.Clean(rawPath)
	if cleanRel == "" || cleanRel == "." || strings.HasPrefix(cleanRel, "..") || strings.Contains(cleanRel, "\\") {
		c.Status(http.StatusNotFound)
		return
	}

	localPath := filepath.Join(".", "uploads", filepath.FromSlash(cleanRel))
	if info, err := os.Stat(localPath); err == nil && !info.IsDir() {
		c.Header("Cache-Control", "public, max-age=86400")
		c.Header("X-Accel-Buffering", "no")
		http.ServeFile(c.Writer, c.Request, localPath)
		return
	}

	if h.r2 != nil && h.r2.Enabled() {
		data, contentType, err := h.r2.GetObject(c.Request.Context(), cleanRel)
		if err == nil {
			if os.MkdirAll(filepath.Dir(localPath), 0o755) == nil {
				if os.WriteFile(localPath, data, 0o644) == nil {
					c.Header("Cache-Control", "public, max-age=86400")
					c.Header("X-Accel-Buffering", "no")
					http.ServeFile(c.Writer, c.Request, localPath)
					return
				}
			}
			if contentType == "" {
				contentType = detectMediaContentType(strings.ToLower(filepath.Ext(cleanRel)))
			}
			c.Header("Cache-Control", "public, max-age=86400")
			c.Header("X-Accel-Buffering", "no")
			c.Data(http.StatusOK, contentType, data)
			return
		}
	}

	c.Status(http.StatusNotFound)
}

func detectMediaContentType(ext string) string {
	switch ext {
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".mov":
		return "video/quicktime"
	case ".ogg":
		return "video/ogg"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".svg":
		return "image/svg+xml"
	default:
		if ct := mime.TypeByExtension(ext); ct != "" {
			return ct
		}
		return "application/octet-stream"
	}
}
