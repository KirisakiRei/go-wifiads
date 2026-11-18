package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"wifiads/pkg/apperror"
	"wifiads/pkg/httpx"
	"wifiads/pkg/utils"
)

// Context keys set by the authentication middlewares.
const (
	ContextAdminID         = "admin_id"
	ContextAdminUsername   = "admin_username"
	ContextAdminRole       = "admin_role"
	ContextAdvertiserID    = "advertiser_id"
	ContextAdvertiserEmail = "advertiser_email"
	ContextPartnerID       = "partner_id"
	ContextPartnerEmail    = "partner_email"

	RoleAdvertiser = "advertiser"
	RolePartner    = "partner"
)

// Auth verifies the admin JWT supplied as a bearer token or httpOnly cookie.
// Tokens issued for advertiser or partner accounts are strictly rejected here.
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
		if err != nil || strings.EqualFold(claims.Role, RoleAdvertiser) || strings.EqualFold(claims.Role, RolePartner) {
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

// AdvertiserAuth verifies the advertiser JWT supplied as a bearer token or dedicated cookie.
func AdvertiserAuth(jwtSecret, cookieName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := bearerToken(c)
		if token == "" && cookieName != "" {
			if cookie, err := c.Cookie(cookieName); err == nil {
				token = cookie
			}
		}
		if token == "" {
			httpx.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "Silakan masuk ke akun pengiklan terlebih dahulu", nil)
			c.Abort()
			return
		}

		claims, err := utils.ParseJWT(jwtSecret, token)
		if err != nil || !strings.EqualFold(claims.Role, RoleAdvertiser) {
			status, code := apperror.MapHTTPStatus(apperror.ErrUnauthorized)
			httpx.Error(c, status, code, "Sesi pengiklan tidak valid atau telah berakhir", nil)
			c.Abort()
			return
		}

		c.Set(ContextAdvertiserID, claims.UserID)
		c.Set(ContextAdvertiserEmail, claims.Username)
		c.Next()
	}
}

// PartnerAuth verifies the partner venue owner JWT supplied as a bearer token or dedicated cookie.
func PartnerAuth(jwtSecret, cookieName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := bearerToken(c)
		if token == "" && cookieName != "" {
			if cookie, err := c.Cookie(cookieName); err == nil {
				token = cookie
			}
		}
		if token == "" {
			httpx.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "Silakan masuk ke akun mitra terlebih dahulu", nil)
			c.Abort()
			return
		}

		claims, err := utils.ParseJWT(jwtSecret, token)
		if err != nil || !strings.EqualFold(claims.Role, RolePartner) {
			status, code := apperror.MapHTTPStatus(apperror.ErrUnauthorized)
			httpx.Error(c, status, code, "Sesi mitra tidak valid atau telah berakhir", nil)
			c.Abort()
			return
		}

		c.Set(ContextPartnerID, claims.UserID)
		c.Set(ContextPartnerEmail, claims.Username)
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

// AdminRole returns the authenticated admin role.
func AdminRole(c *gin.Context) string {
	value, _ := c.Get(ContextAdminRole)
	role, _ := value.(string)
	return role
}

// AdvertiserID returns the authenticated advertiser id.
func AdvertiserID(c *gin.Context) string {
	value, _ := c.Get(ContextAdvertiserID)
	id, _ := value.(string)
	return id
}

// AdvertiserEmail returns the authenticated advertiser email.
func AdvertiserEmail(c *gin.Context) string {
	value, _ := c.Get(ContextAdvertiserEmail)
	email, _ := value.(string)
	return email
}

// PartnerID returns the authenticated partner id.
func PartnerID(c *gin.Context) string {
	value, _ := c.Get(ContextPartnerID)
	id, _ := value.(string)
	return id
}

// PartnerEmail returns the authenticated partner email.
func PartnerEmail(c *gin.Context) string {
	value, _ := c.Get(ContextPartnerEmail)
	email, _ := value.(string)
	return email
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
