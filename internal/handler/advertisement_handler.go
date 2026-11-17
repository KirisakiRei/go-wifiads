package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"wifiads/internal/dto"
	"wifiads/internal/service"
	"wifiads/pkg/httpx"
)

// AdvertisementHandler handles sponsor advertisement management.
type AdvertisementHandler struct {
	ads service.AdvertisementService
}

// NewAdvertisementHandler creates a new AdvertisementHandler instance.
func NewAdvertisementHandler(ads service.AdvertisementService) *AdvertisementHandler {
	return &AdvertisementHandler{ads: ads}
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

// Delete removes an advertisement.
func (h *AdvertisementHandler) Delete(c *gin.Context) {
	if err := h.ads.Delete(c.Request.Context(), c.Param("id")); err != nil {
		writeError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// UploadImage handles file uploads for advertisement banners (images and videos).
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

	// 50 MB limit for video, 10 MB limit for images
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

	dir := filepath.Join(".", "uploads", "ads")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "Gagal menyiapkan folder penyimpanan", err.Error())
		return
	}

	filename := uuid.NewString() + ext
	dest := filepath.Join(dir, filename)
	if err := c.SaveUploadedFile(file, dest); err != nil {
		httpx.Error(c, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "Gagal menyimpan file media", err.Error())
		return
	}

	mediaType := "image"
	if isVideo {
		mediaType = "video"
	}

	imageURL := "/uploads/ads/" + filename
	httpx.Created(c, "File media berhasil diunggah", gin.H{
		"url":        imageURL,
		"filename":   filename,
		"media_type": mediaType,
	})
}
