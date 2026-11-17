package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"wifiads/pkg/httpx"
)

// HealthHandler reports process and dependency health.
type HealthHandler struct {
	checkDependencies func(ctx context.Context) error
}

// NewHealthHandler builds the health handler.
func NewHealthHandler(checkDependencies func(ctx context.Context) error) *HealthHandler {
	return &HealthHandler{checkDependencies: checkDependencies}
}

// Live reports that the process is running.
func (h *HealthHandler) Live(c *gin.Context) {
	httpx.OK(c, "Service is alive", gin.H{"status": "ok"})
}

// Ready verifies that critical dependencies are reachable.
func (h *HealthHandler) Ready(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	if err := h.checkDependencies(ctx); err != nil {
		httpx.Error(c, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "dependencies are not ready", err.Error())
		return
	}
	httpx.OK(c, "Service is ready", gin.H{"status": "ready"})
}
