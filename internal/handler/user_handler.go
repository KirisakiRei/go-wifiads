package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wifiads/internal/dto"
	"wifiads/internal/service"
	"wifiads/pkg/httpx"
)

// UserHandler handles admin account management.
type UserHandler struct {
	users service.UserService
}

// NewUserHandler creates a new UserHandler instance.
func NewUserHandler(users service.UserService) *UserHandler {
	return &UserHandler{users: users}
}

// List returns all admin user accounts.
func (h *UserHandler) List(c *gin.Context) {
	items, err := h.users.List(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Users retrieved", items)
}

// Get returns an admin user by ID.
func (h *UserHandler) Get(c *gin.Context) {
	item, err := h.users.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "User retrieved", item)
}

// Create creates a new admin user.
func (h *UserHandler) Create(c *gin.Context) {
	var req dto.CreateAdminUserRequest
	if !bindJSON(c, &req, "Invalid user payload") {
		return
	}
	item, err := h.users.Create(c.Request.Context(), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Created(c, "User created", item)
}

// Update updates an admin user's name, role or status.
func (h *UserHandler) Update(c *gin.Context) {
	var req dto.UpdateAdminUserRequest
	if !bindJSON(c, &req, "Invalid user update payload") {
		return
	}
	item, err := h.users.Update(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "User updated", item)
}

// ChangePassword updates an admin user's password.
func (h *UserHandler) ChangePassword(c *gin.Context) {
	var req dto.ChangePasswordRequest
	if !bindJSON(c, &req, "Invalid password payload") {
		return
	}
	if err := h.users.ChangePassword(c.Request.Context(), c.Param("id"), req); err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Password changed", nil)
}

// Delete removes an admin user account.
func (h *UserHandler) Delete(c *gin.Context) {
	if err := h.users.Delete(c.Request.Context(), c.Param("id")); err != nil {
		writeError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
