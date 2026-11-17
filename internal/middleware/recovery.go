package middleware

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"wifiads/pkg/httpx"
)

// Recovery converts panics into the standard error envelope.
func Recovery(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.Error("panic recovered",
					slog.Any("panic", recovered),
					slog.String("path", c.Request.URL.Path),
					slog.String("request_id", GetRequestID(c)),
				)
				httpx.Error(c, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "internal server error", nil)
				c.Abort()
			}
		}()
		c.Next()
	}
}
