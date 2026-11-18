package handler

import (
	"github.com/gin-gonic/gin"

	"wifiads/internal/dto"
	"wifiads/internal/middleware"
	"wifiads/internal/service"
	"wifiads/pkg/httpx"
)

// AdminHandler exposes dashboard read endpoints.
type AdminHandler struct {
	admin service.AdminService
}

// NewAdminHandler builds the dashboard handler.
func NewAdminHandler(admin service.AdminService) *AdminHandler {
	return &AdminHandler{admin: admin}
}

// Overview returns the dashboard counters.
func (h *AdminHandler) Overview(c *gin.Context) {
	res, err := h.admin.Overview(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Overview retrieved", res)
}

// ListVisitors returns the Wi-Fi users/devices table.
func (h *AdminHandler) ListVisitors(c *gin.Context) {
	var query dto.VisitorListQuery
	if !bindQuery(c, &query, "Invalid visitor query") {
		return
	}
	items, meta, err := h.admin.ListVisitors(c.Request.Context(), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Visitors retrieved", items, meta)
}

// ListSessions returns the RADIUS accounting sessions.
func (h *AdminHandler) ListSessions(c *gin.Context) {
	var query dto.SessionListQuery
	if !bindQuery(c, &query, "Invalid session query") {
		return
	}
	items, meta, err := h.admin.ListSessions(c.Request.Context(), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Sessions retrieved", items, meta)
}

// ListRouters returns the registered active MikroTik routers.
func (h *AdminHandler) ListRouters(c *gin.Context) {
	routers, err := h.admin.ListRouters(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Routers retrieved", routers)
}

// CreateRouter registers a new MikroTik router and its RADIUS NAS client.
func (h *AdminHandler) CreateRouter(c *gin.Context) {
	var req dto.CreateRouterRequest
	if !bindJSON(c, &req, "Invalid router payload") {
		return
	}
	res, err := h.admin.CreateRouter(
		c.Request.Context(),
		middleware.AdminID(c),
		middleware.AdminUsername(c),
		req,
	)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Created(c, "Router created successfully", res)
}

// UpdateRouterVoucherConfig updates the automated voucher generation settings for a MikroTik router.
func (h *AdminHandler) UpdateRouterVoucherConfig(c *gin.Context) {
	routerID := c.Param("id")
	var req dto.UpdateRouterVoucherConfigRequest
	if !bindJSON(c, &req, "Invalid voucher configuration payload") {
		return
	}
	res, err := h.admin.UpdateRouterVoucherConfig(
		c.Request.Context(),
		middleware.AdminID(c),
		middleware.AdminUsername(c),
		routerID,
		req,
	)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Voucher configuration updated successfully", res)
}
