package handler

import (
	"github.com/gin-gonic/gin"

	"wifiads/internal/dto"
	"wifiads/internal/service"
	"wifiads/pkg/httpx"
)

// ProfileHandler handles QoS tier profile management.
type ProfileHandler struct {
	profiles service.ProfileService
}

// NewProfileHandler creates a new ProfileHandler instance.
func NewProfileHandler(profiles service.ProfileService) *ProfileHandler {
	return &ProfileHandler{profiles: profiles}
}

// List returns active QoS connect profiles.
func (h *ProfileHandler) List(c *gin.Context) {
	items, err := h.profiles.List(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Profiles retrieved", items)
}

// Get returns a single profile by ID.
func (h *ProfileHandler) Get(c *gin.Context) {
	item, err := h.profiles.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Profile retrieved", item)
}

// Create creates a new QoS connect profile.
func (h *ProfileHandler) Create(c *gin.Context) {
	var req dto.CreateProfileRequest
	if !bindJSON(c, &req, "Invalid profile payload") {
		return
	}
	item, err := h.profiles.Create(c.Request.Context(), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Created(c, "Profile created", item)
}

// Update updates an existing QoS connect profile.
func (h *ProfileHandler) Update(c *gin.Context) {
	var req dto.UpdateProfileRequest
	if !bindJSON(c, &req, "Invalid profile update payload") {
		return
	}
	item, err := h.profiles.Update(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Profile updated", item)
}
