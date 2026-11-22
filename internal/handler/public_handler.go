package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wifiads/internal/dto"
	"wifiads/internal/middleware"
	"wifiads/internal/service"
	"wifiads/pkg/apperror"
	"wifiads/pkg/httpx"
)

type PublicHandler struct {
	svc service.PublicService
}

func NewPublicHandler(svc service.PublicService) *PublicHandler {
	return &PublicHandler{svc: svc}
}

func (h *PublicHandler) GetLandingData(c *gin.Context) {
	res, err := h.svc.GetLandingData(c.Request.Context())
	if err != nil {
		status, code := apperror.MapHTTPStatus(err)
		httpx.Error(c, status, code, err.Error(), nil)
		return
	}
	httpx.OK(c, "Landing data fetched", res)
}

func (h *PublicHandler) GetPublicMapRouters(c *gin.Context) {
	res, err := h.svc.GetLandingData(c.Request.Context())
	if err != nil {
		status, code := apperror.MapHTTPStatus(err)
		httpx.Error(c, status, code, err.Error(), nil)
		return
	}
	httpx.OK(c, "Public map routers fetched", res.Locations)
}

func (h *PublicHandler) SubmitPartnerLead(c *gin.Context) {
	var req dto.SubmitPartnerLeadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Data pendaftaran tidak valid", err.Error())
		return
	}
	res, err := h.svc.SubmitPartnerLead(c.Request.Context(), req)
	if err != nil {
		status, code := apperror.MapHTTPStatus(err)
		httpx.Error(c, status, code, err.Error(), nil)
		return
	}
	httpx.Created(c, "Pendaftaran calon mitra berhasil dikirim", res)
}

func (h *PublicHandler) AdminListPartnerLeads(c *gin.Context) {
	var query dto.PartnerLeadListQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		httpx.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Query tidak valid", err.Error())
		return
	}
	items, meta, err := h.svc.AdminListPartnerLeads(c.Request.Context(), query)
	if err != nil {
		status, code := apperror.MapHTTPStatus(err)
		httpx.Error(c, status, code, err.Error(), nil)
		return
	}
	httpx.Paginated(c, "Daftar calon mitra", items, meta)
}

func (h *PublicHandler) AdminUpdatePartnerLeadStatus(c *gin.Context) {
	var req dto.UpdatePartnerLeadStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Payload tidak valid", err.Error())
		return
	}
	res, err := h.svc.AdminUpdatePartnerLeadStatus(
		c.Request.Context(),
		c.Param("id"),
		req,
		c.GetString(middleware.ContextAdminID),
		c.GetString(middleware.ContextAdminUsername),
	)
	if err != nil {
		status, code := apperror.MapHTTPStatus(err)
		httpx.Error(c, status, code, err.Error(), nil)
		return
	}
	httpx.OK(c, "Status calon mitra diperbarui", res)
}

func (h *PublicHandler) AdminConvertPartnerLead(c *gin.Context) {
	var req dto.ConvertPartnerLeadRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			httpx.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Payload tidak valid", err.Error())
			return
		}
	}
	res, err := h.svc.AdminConvertPartnerLead(
		c.Request.Context(),
		c.Param("id"),
		req,
		c.GetString(middleware.ContextAdminID),
		c.GetString(middleware.ContextAdminUsername),
	)
	if err != nil {
		status, code := apperror.MapHTTPStatus(err)
		httpx.Error(c, status, code, err.Error(), nil)
		return
	}
	httpx.Created(c, "Calon mitra berhasil dikonversi menjadi undangan mitra", res)
}
