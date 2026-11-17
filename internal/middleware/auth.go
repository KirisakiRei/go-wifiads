package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"wifiads/pkg/apperror"
	"wifiads/pkg/httpx"
	"wifiads/pkg/utils"
)

// Context keys set by the authentication middleware.
const (
	ContextAdminID       = "admin_id"
	ContextAdminUsername = "admin_username"
	ContextAdminRole     = "admin_role"
)

// Auth verifies the admin JWT supplied as a bearer token or httpOnly cookie.
func Auth(jwtSecret, cookieName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := bearerToken(c)
		if token == "" && cookieName != "" {
			if cookie, err := c.Cookie(cookieName); err == nil {
				token = cookie
			}
		}
		if token == "" {
			httpx.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing authentication token", nil)
			c.Abort()
			return
		}

		claims, err := utils.ParseJWT(jwtSecret, token)
		if err != nil {
			status, code := apperror.MapHTTPStatus(apperror.ErrUnauthorized)
			httpx.Error(c, status, code, "invalid or expired token", nil)
			c.Abort()
			return
		}

		c.Set(ContextAdminID, claims.UserID)
		c.Set(ContextAdminUsername, claims.Username)
		c.Set(ContextAdminRole, claims.Role)
		c.Next()
	}
}

// AdminID returns the authenticated admin id.
func AdminID(c *gin.Context) string {
	value, _ := c.Get(ContextAdminID)
	id, _ := value.(string)
	return id
}

// AdminUsername returns the authenticated admin username.
func AdminUsername(c *gin.Context) string {
	value, _ := c.Get(ContextAdminUsername)
	username, _ := value.(string)
	return username
}

func bearerToken(c *gin.Context) string {
	header := c.GetHeader("Authorization")
	if header == "" {
		return ""
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}
