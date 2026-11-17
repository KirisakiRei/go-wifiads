package handler

import (
	"github.com/gin-gonic/gin"

	"wifiads/internal/dto"
	"wifiads/internal/middleware"
	"wifiads/internal/service"
	"wifiads/pkg/httpx"
)

// VoucherHandler exposes admin voucher endpoints.
type VoucherHandler struct {
	vouchers service.VoucherService
}

// NewVoucherHandler builds the voucher handler.
func NewVoucherHandler(vouchers service.VoucherService) *VoucherHandler {
	return &VoucherHandler{vouchers: vouchers}
}

// Create issues a manual test voucher; the password is returned only once.
func (h *VoucherHandler) Create(c *gin.Context) {
	var req dto.CreateVoucherRequest
	if !bindJSON(c, &req, "Invalid voucher payload") {
		return
	}
	res, err := h.vouchers.CreateManual(
		c.Request.Context(),
		middleware.AdminID(c),
		middleware.AdminUsername(c),
		req,
	)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Created(c, "Voucher created", res)
}

// List returns a paginated voucher list.
func (h *VoucherHandler) List(c *gin.Context) {
	var query dto.VoucherListQuery
	if !bindQuery(c, &query, "Invalid voucher query") {
		return
	}
	items, meta, err := h.vouchers.List(c.Request.Context(), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Vouchers retrieved", items, meta)
}
