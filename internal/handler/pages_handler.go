package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"wifiads/internal/dto"
	"wifiads/internal/service"
	"wifiads/pkg/apperror"
)

// PagesHandler renders the server-side admin pages.
type PagesHandler struct {
	admin    service.AdminService
	vouchers service.VoucherService
	appName  string
}

// NewPagesHandler builds the admin page handler.
func NewPagesHandler(admin service.AdminService, vouchers service.VoucherService, appName string) *PagesHandler {
	return &PagesHandler{admin: admin, vouchers: vouchers, appName: appName}
}

// Login renders the admin login page.
func (h *PagesHandler) Login(c *gin.Context) {
	c.HTML(http.StatusOK, "admin_login.html", gin.H{"AppName": h.appName})
}

// Overview renders the dashboard summary.
func (h *PagesHandler) Overview(c *gin.Context) {
	ctx := c.Request.Context()
	overview, err := h.admin.Overview(ctx)
	if err != nil {
		renderPageError(c, err)
		return
	}
	c.HTML(http.StatusOK, "admin_overview.html", gin.H{
		"AppName":  h.appName,
		"Active":   "overview",
		"Overview": overview,
	})
}

// Vouchers renders the voucher list page.
func (h *PagesHandler) Vouchers(c *gin.Context) {
	ctx := c.Request.Context()
	query := dto.VoucherListQuery{
		PaginationQuery: dto.PaginationQuery{
			Page:    pageFromQuery(c),
			PerPage: 20,
			Search:  c.Query("search"),
		},
		Status: c.Query("status"),
	}
	items, meta, err := h.vouchers.List(ctx, query)
	if err != nil {
		renderPageError(c, err)
		return
	}
	c.HTML(http.StatusOK, "admin_vouchers.html", gin.H{
		"AppName":     h.appName,
		"Active":      "vouchers",
		"Vouchers":    items,
		"Meta":        meta,
		"SearchQuery": query.Search,
		"StatusQuery": query.Status,
	})
}

// Visitors renders the Wi-Fi users/devices page.
func (h *PagesHandler) Visitors(c *gin.Context) {
	ctx := c.Request.Context()
	query := dto.VisitorListQuery{
		PaginationQuery: dto.PaginationQuery{
			Page:    pageFromQuery(c),
			PerPage: 20,
			Search:  c.Query("search"),
		},
		Status: c.Query("status"),
	}
	items, meta, err := h.admin.ListVisitors(ctx, query)
	if err != nil {
		renderPageError(c, err)
		return
	}
	c.HTML(http.StatusOK, "admin_visitors.html", gin.H{
		"AppName":     h.appName,
		"Active":      "visitors",
		"Visitors":    items,
		"Meta":        meta,
		"SearchQuery": query.Search,
		"StatusQuery": query.Status,
	})
}

// Sessions renders the RADIUS accounting session page.
func (h *PagesHandler) Sessions(c *gin.Context) {
	ctx := c.Request.Context()
	query := dto.SessionListQuery{
		PaginationQuery: dto.PaginationQuery{
			Page:    pageFromQuery(c),
			PerPage: 20,
			Search:  c.Query("search"),
		},
		Status: c.Query("status"),
	}
	items, meta, err := h.admin.ListSessions(ctx, query)
	if err != nil {
		renderPageError(c, err)
		return
	}
	c.HTML(http.StatusOK, "admin_sessions.html", gin.H{
		"AppName":     h.appName,
		"Active":      "sessions",
		"Sessions":    items,
		"Meta":        meta,
		"SearchQuery": query.Search,
		"StatusQuery": query.Status,
	})
}

func pageFromQuery(c *gin.Context) int {
	page := 1
	if raw := c.Query("page"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			page = parsed
		}
	}
	return page
}

func renderPageError(c *gin.Context, err error) {
	status, _ := apperror.MapHTTPStatus(err)
	c.HTML(status, "error.html", gin.H{
		"Message": err.Error(),
		"Status":  status,
	})
}
