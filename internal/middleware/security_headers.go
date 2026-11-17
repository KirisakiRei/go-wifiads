package middleware

import (
	"github.com/gin-gonic/gin"
)

// SecurityHeaders sets defensive HTTP response headers on every response:
//
//   - Content-Security-Policy: only first-party assets may load or run. The
//     portal is served from the walled garden with no third-party requests
//     (fonts, CDNs, analytics), so a strict same-origin policy is safe.
//   - X-Frame-Options / frame-ancestors: block clickjacking of the portal and
//     admin pages.
//   - X-Content-Type-Options: stop MIME sniffing.
//   - Referrer-Policy: never leak portal URLs (which carry Hotspot context).
//   - HSTS: only meaningful over HTTPS, driven by the caller so development
//     over plain HTTP is not broken.
//
// A small amount of inline styling exists in a few admin templates, so
// 'unsafe-inline' is allowed for styles only; scripts remain 'self' only.
func SecurityHeaders(enableHSTS bool) gin.HandlerFunc {
	csp := "default-src 'self'; " +
		"base-uri 'self'; " +
		"object-src 'none'; " +
		"form-action 'self' http: https:; " +
		"img-src 'self' data: blob: http: https:; " +
		"media-src 'self' data: blob: http: https:; " +
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
		"script-src 'self'; " +
		"font-src 'self' data: https://fonts.gstatic.com; " +
		"connect-src 'self'; " +
		"frame-ancestors 'none'"

	return func(c *gin.Context) {
		c.Header("Content-Security-Policy", csp)
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("Referrer-Policy", "no-referrer")
		c.Header("X-Permitted-Cross-Domain-Policies", "none")
		c.Header("Cross-Origin-Opener-Policy", "same-origin")
		if enableHSTS {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		c.Next()
	}
}
