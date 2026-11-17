package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"wifiads/pkg/httpx"
)

type rateBucket struct {
	count   int
	resetAt time.Time
}

// RateLimit allows at most limit requests per client IP inside window.
func RateLimit(limit int, window time.Duration) gin.HandlerFunc {
	if limit <= 0 {
		limit = 60
	}
	if window <= 0 {
		window = time.Minute
	}

	var mu sync.Mutex
	buckets := make(map[string]*rateBucket)

	// Opportunistic cleanup keeps the map bounded for long running processes.
	cleanup := func(now time.Time) {
		for key, bucket := range buckets {
			if now.After(bucket.resetAt) {
				delete(buckets, key)
			}
		}
	}

	return func(c *gin.Context) {
		now := time.Now()
		clientIP := c.ClientIP()

		mu.Lock()
		if len(buckets) > 10000 {
			cleanup(now)
		}
		bucket, ok := buckets[clientIP]
		if !ok || now.After(bucket.resetAt) {
			bucket = &rateBucket{count: 0, resetAt: now.Add(window)}
			buckets[clientIP] = bucket
		}
		bucket.count++
		exceeded := bucket.count > limit
		mu.Unlock()

		if exceeded {
			httpx.Error(c, http.StatusTooManyRequests, "TOO_MANY_REQUESTS", "too many requests", nil)
			c.Abort()
			return
		}
		c.Next()
	}
}
