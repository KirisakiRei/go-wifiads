package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wifiads/internal/dto"
	"wifiads/internal/middleware"
	"wifiads/internal/service"
	"wifiads/pkg/httpx"
)

// AuthHandler exposes admin authentication endpoints.
type AuthHandler struct {
	auth       service.AuthService
	cookieName string
	cookieSecure bool
}

// NewAuthHandler builds the authentication handler.
func NewAuthHandler(auth service.AuthService, cookieName string, cookieSecure bool) *AuthHandler {
	return &AuthHandler{auth: auth, cookieName: cookieName, cookieSecure: cookieSecure}
}

// Login authenticates an admin and stores the token in an httpOnly cookie.
func (h *AuthHandler) Login(c *gin.Context) {
	var req dto.LoginRequest
	if !bindJSON(c, &req, "Invalid login payload") {
		return
	}
	res, err := h.auth.Login(c.Request.Context(), req)
	if err != nil {
		writeError(c, err)
		return
	}

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(h.cookieName, res.Token, 60*60*12, "/", "", h.cookieSecure, true)
	httpx.OK(c, "Login successful", res)
}

// Logout clears the admin session cookie.
func (h *AuthHandler) Logout(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(h.cookieName, "", -1, "/", "", h.cookieSecure, true)
	httpx.OK(c, "Logged out", nil)
}

// Profile returns the authenticated admin.
func (h *AuthHandler) Profile(c *gin.Context) {
	res, err := h.auth.Profile(c.Request.Context(), middleware.AdminID(c))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Admin profile retrieved", res)
}
