package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// Logger writes one structured line per request. Secrets and request bodies are
// never logged.
func Logger(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		attrs := []any{
			slog.String("method", c.Request.Method),
			slog.String("path", path),
			slog.String("query", query),
			slog.Int("status", c.Writer.Status()),
			slog.Int("size", c.Writer.Size()),
			slog.String("ip", c.ClientIP()),
			slog.Duration("latency", time.Since(start)),
			slog.String("request_id", GetRequestID(c)),
		}
		if errs := c.Errors.String(); errs != "" {
			attrs = append(attrs, slog.String("errors", errs))
		}

		switch {
		case c.Writer.Status() >= 500:
			logger.Error("http request", attrs...)
		case c.Writer.Status() >= 400:
			logger.Warn("http request", attrs...)
		default:
			logger.Info("http request", attrs...)
		}
	}
}
