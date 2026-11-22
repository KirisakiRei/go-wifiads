package handler

import (
	"strconv"

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

// DeleteRouter soft-deletes a router and disables its RADIUS NAS client.
func (h *AdminHandler) DeleteRouter(c *gin.Context) {
	err := h.admin.DeleteRouter(
		c.Request.Context(),
		middleware.AdminID(c),
		middleware.AdminUsername(c),
		c.Param("id"),
	)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Router berhasil dihapus", nil)
}

// DisconnectSession terminates an active session via RADIUS CoA (port 3799) with voucher revoke fallback.
func (h *AdminHandler) DisconnectSession(c *gin.Context) {
	res, err := h.admin.DisconnectSession(
		c.Request.Context(),
		middleware.AdminID(c),
		middleware.AdminUsername(c),
		c.Param("id"),
	)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, res.Message, res)
}

// BlockDevice adds a MAC address to the blocklist and optionally disconnects its active session.
func (h *AdminHandler) BlockDevice(c *gin.Context) {
	var req dto.BlockDeviceRequest
	if c.Request.ContentLength > 0 {
		if !bindJSON(c, &req, "Invalid block device payload") {
			return
		}
	}
	res, err := h.admin.BlockDevice(
		c.Request.Context(),
		middleware.AdminID(c),
		middleware.AdminUsername(c),
		c.Param("mac"),
		req,
	)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Created(c, "Perangkat berhasil diblokir", res)
}

// UnblockDevice removes a MAC address from the blocklist.
func (h *AdminHandler) UnblockDevice(c *gin.Context) {
	err := h.admin.UnblockDevice(
		c.Request.Context(),
		middleware.AdminID(c),
		middleware.AdminUsername(c),
		c.Param("mac"),
		c.Query("router_id"),
	)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Blokir perangkat berhasil dibuka", nil)
}

// ListBlockedDevices returns paginated blocked MAC addresses.
func (h *AdminHandler) ListBlockedDevices(c *gin.Context) {
	var query dto.BlockedDeviceListQuery
	if !bindQuery(c, &query, "Invalid blocked devices query") {
		return
	}
	items, meta, err := h.admin.ListBlockedDevices(c.Request.Context(), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Daftar perangkat diblokir", items, meta)
}

// ListAuditLogs returns paginated system/admin audit logs.
func (h *AdminHandler) ListAuditLogs(c *gin.Context) {
	var query dto.AuditLogListQuery
	if !bindQuery(c, &query, "Invalid audit log query") {
		return
	}
	items, meta, err := h.admin.ListAuditLogs(c.Request.Context(), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Audit logs retrieved", items, meta)
}

// AuditLogFilters returns distinct action and entity_type filter values.
func (h *AdminHandler) AuditLogFilters(c *gin.Context) {
	res, err := h.admin.AuditLogFilters(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Audit log filters retrieved", res)
}

// CleanupAuditLogs deletes audit logs older than ?days=90 (super_admin only).
func (h *AdminHandler) CleanupAuditLogs(c *gin.Context) {
	days := 90
	if raw := c.Query("days"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			days = parsed
		}
	}
	res, err := h.admin.CleanupAuditLogs(
		c.Request.Context(),
		middleware.AdminID(c),
		middleware.AdminUsername(c),
		middleware.AdminRole(c),
		days,
	)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Log sistem lama berhasil dibersihkan", res)
}
