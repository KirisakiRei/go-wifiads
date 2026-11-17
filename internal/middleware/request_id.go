package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	// HeaderRequestID is the canonical request correlation header.
	HeaderRequestID = "X-Request-ID"
	// ContextRequestID is the Gin context key holding the request id.
	ContextRequestID = "request_id"
)

// RequestID injects a correlation id into the response and request context.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader(HeaderRequestID)
		if requestID == "" {
			requestID = uuid.NewString()
		}
		c.Set(ContextRequestID, requestID)
		c.Writer.Header().Set(HeaderRequestID, requestID)
		c.Next()
	}
}

// GetRequestID returns the current request id.
func GetRequestID(c *gin.Context) string {
	if value, ok := c.Get(ContextRequestID); ok {
		if id, ok := value.(string); ok {
			return id
		}
	}
	return ""
}
