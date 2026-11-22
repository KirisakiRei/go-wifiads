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
	auth         service.AuthService
	cookieName   string
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
	if refreshTok, rErr := h.auth.IssueRefreshToken(c.Request.Context(), res.User.ID); rErr == nil && refreshTok != "" {
		c.SetCookie(h.cookieName+"_refresh", refreshTok, 60*60*24*7, "/", "", h.cookieSecure, true)
	}
	httpx.OK(c, "Login successful", res)
}

// Refresh rotates the admin access & refresh cookies using the HttpOnly refresh cookie.
func (h *AuthHandler) Refresh(c *gin.Context) {
	refreshCookie, err := c.Cookie(h.cookieName + "_refresh")
	if err != nil || refreshCookie == "" {
		httpx.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "Refresh token tidak ditemukan", nil)
		return
	}
	res, newRefresh, err := h.auth.Refresh(c.Request.Context(), refreshCookie)
	if err != nil {
		writeError(c, err)
		return
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(h.cookieName, res.Token, 60*60*12, "/", "", h.cookieSecure, true)
	c.SetCookie(h.cookieName+"_refresh", newRefresh, 60*60*24*7, "/", "", h.cookieSecure, true)
	httpx.OK(c, "Session refreshed", res)
}

// Logout clears the admin session and refresh cookies.
func (h *AuthHandler) Logout(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(h.cookieName, "", -1, "/", "", h.cookieSecure, true)
	c.SetCookie(h.cookieName+"_refresh", "", -1, "/", "", h.cookieSecure, true)
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
