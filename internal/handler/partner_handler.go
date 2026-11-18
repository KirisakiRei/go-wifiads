package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wifiads/internal/dto"
	"wifiads/internal/middleware"
	"wifiads/internal/service"
	"wifiads/pkg/httpx"
)

const PartnerCookieName = "wifiads_partner_token"

// PartnerHandler exposes Admin Partner/Finance management endpoints and
// Partner Portal self-service endpoints.
type PartnerHandler struct {
	svc          service.PartnerService
	mktHandler   *MarketplaceHandler
	cookieSecure bool
}

func NewPartnerHandler(svc service.PartnerService, mktHandler *MarketplaceHandler, cookieSecure bool) *PartnerHandler {
	return &PartnerHandler{
		svc:          svc,
		mktHandler:   mktHandler,
		cookieSecure: cookieSecure,
	}
}

// ==================== ADMIN BADGES, FINANCE & GLOBAL LEDGER ====================

func (h *PartnerHandler) AdminGetBadges(c *gin.Context) {
	res, err := h.svc.AdminGetBadges(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Indikator berhasil dimuat", res)
}

func (h *PartnerHandler) AdminGetFinanceSummary(c *gin.Context) {
	var query dto.AdminFinanceQuery
	if !bindQuery(c, &query, "Parameter rentang laporan tidak valid") {
		return
	}
	res, err := h.svc.AdminGetFinanceSummary(c.Request.Context(), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Laporan keuangan berhasil dimuat", res)
}

func (h *PartnerHandler) AdminListGlobalTransactions(c *gin.Context) {
	var query dto.WalletTransactionListQuery
	if !bindQuery(c, &query, "Parameter mutasi tidak valid") {
		return
	}
	items, meta, err := h.svc.AdminListGlobalWalletTransactions(c.Request.Context(), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Buku mutasi berhasil dimuat", items, meta)
}

// ==================== ADMIN PARTNER CRUD & WITHDRAWALS ====================

func (h *PartnerHandler) AdminListPartners(c *gin.Context) {
	var query dto.AdminPartnerListQuery
	if !bindQuery(c, &query, "Parameter pencarian mitra tidak valid") {
		return
	}
	items, meta, err := h.svc.AdminListPartners(c.Request.Context(), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Daftar mitra berhasil dimuat", items, meta)
}

func (h *PartnerHandler) AdminGetPartner(c *gin.Context) {
	res, err := h.svc.AdminGetPartner(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Detail mitra berhasil dimuat", res)
}

func (h *PartnerHandler) AdminCreatePartner(c *gin.Context) {
	var req dto.AdminCreatePartnerInviteRequest
	if !bindJSON(c, &req, "Data undangan mitra tidak valid") {
		return
	}
	res, err := h.svc.AdminCreatePartnerInvite(c.Request.Context(), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Created(c, "Tautan undangan mitra berhasil dibuat", res)
}

func (h *PartnerHandler) AdminRegeneratePartnerInvite(c *gin.Context) {
	res, err := h.svc.AdminRegeneratePartnerInvite(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Tautan undangan baru berhasil dibuat", res)
}

func (h *PartnerHandler) AdminUpdatePartner(c *gin.Context) {
	var req dto.AdminUpdatePartnerSettingsRequest
	if !bindJSON(c, &req, "Pengaturan mitra tidak valid") {
		return
	}
	res, err := h.svc.AdminUpdatePartnerSettings(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Pengaturan bagi hasil & status mitra berhasil disimpan", res)
}

func (h *PartnerHandler) AdminChangePartnerPassword(c *gin.Context) {
	var req dto.AdminChangePartnerPasswordRequest
	if !bindJSON(c, &req, "Data kata sandi mitra tidak valid") {
		return
	}
	if err := h.svc.AdminChangePartnerPassword(c.Request.Context(), c.Param("id"), req); err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Kata sandi mitra berhasil diperbarui", nil)
}

func (h *PartnerHandler) AdminDeletePartner(c *gin.Context) {
	if err := h.svc.AdminDeletePartner(c.Request.Context(), c.Param("id")); err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Akun mitra berhasil dihapus", nil)
}

func (h *PartnerHandler) AdminListWithdrawals(c *gin.Context) {
	var query dto.WithdrawalListQuery
	if !bindQuery(c, &query, "Parameter pencarian pencairan tidak valid") {
		return
	}
	items, meta, err := h.svc.AdminListWithdrawals(c.Request.Context(), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Daftar pencairan dana berhasil dimuat", items, meta)
}

func (h *PartnerHandler) AdminProcessWithdrawal(c *gin.Context) {
	var req dto.AdminProcessWithdrawalRequest
	if !bindJSON(c, &req, "Data pemrosesan pencairan tidak valid") {
		return
	}
	res, err := h.svc.AdminProcessWithdrawal(c.Request.Context(), middleware.AdminID(c), c.Param("id"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Status pencairan dana berhasil diperbarui", res)
}

func (h *PartnerHandler) AdminUploadPayoutProof(c *gin.Context) {
	if h.mktHandler == nil {
		httpx.Error(c, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "Layanan unggah belum siap", nil)
		return
	}
	h.mktHandler.uploadAsset(c, "ads/admin/payouts", false)
}

// ==================== PARTNER INVITE & PORTAL ENDPOINTS ====================

func (h *PartnerHandler) GetInviteInfo(c *gin.Context) {
	res, err := h.svc.GetPartnerInviteInfo(c.Request.Context(), c.Param("token"))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Informasi undangan mitra", res)
}

func (h *PartnerHandler) ActivateInvite(c *gin.Context) {
	var req dto.PartnerActivateInviteRequest
	if !bindJSON(c, &req, "Mohon lengkapi seluruh data akun dan lokasi tempat usaha") {
		return
	}
	res, err := h.svc.ActivatePartnerInvite(c.Request.Context(), c.Param("token"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(PartnerCookieName, res.Token, 60*60*24*7, "/", "", h.cookieSecure, true)
	httpx.Created(c, "Selamat! Akun mitra berhasil diaktifkan", res)
}

func (h *PartnerHandler) Login(c *gin.Context) {
	var req dto.PartnerLoginRequest
	if !bindJSON(c, &req, "Data login mitra tidak valid") {
		return
	}
	res, err := h.svc.LoginPartner(c.Request.Context(), req)
	if err != nil {
		writeError(c, err)
		return
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(PartnerCookieName, res.Token, 60*60*24*7, "/", "", h.cookieSecure, true)
	httpx.OK(c, "Berhasil masuk ke portal mitra", res)
}

func (h *PartnerHandler) Logout(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(PartnerCookieName, "", -1, "/", "", h.cookieSecure, true)
	httpx.OK(c, "Sesi mitra diakhiri", nil)
}

func (h *PartnerHandler) GetProfile(c *gin.Context) {
	res, err := h.svc.GetPartnerProfile(c.Request.Context(), middleware.PartnerID(c))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Profil mitra berhasil dimuat", res)
}

func (h *PartnerHandler) UpdateProfile(c *gin.Context) {
	var req dto.UpdatePartnerProfileRequest
	if !bindJSON(c, &req, "Data profil dan titik koordinat wajib dilengkapi") {
		return
	}
	res, err := h.svc.UpdatePartnerProfile(c.Request.Context(), middleware.PartnerID(c), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Profil dan titik lokasi berhasil diperbarui", res)
}

func (h *PartnerHandler) ChangePassword(c *gin.Context) {
	var req dto.ChangePartnerPasswordRequest
	if !bindJSON(c, &req, "Data kata sandi tidak valid") {
		return
	}
	if err := h.svc.ChangePartnerPassword(c.Request.Context(), middleware.PartnerID(c), req); err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Kata sandi berhasil diperbarui", nil)
}

func (h *PartnerHandler) GetOverview(c *gin.Context) {
	res, err := h.svc.GetPartnerOverview(c.Request.Context(), middleware.PartnerID(c))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Ringkasan lokasi berhasil dimuat", res)
}

func (h *PartnerHandler) ListAds(c *gin.Context) {
	items, err := h.svc.ListPartnerAds(c.Request.Context(), middleware.PartnerID(c))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Daftar iklan di lokasi Anda berhasil dimuat", items)
}

func (h *PartnerHandler) ListRouters(c *gin.Context) {
	items, err := h.svc.ListPartnerRouters(c.Request.Context(), middleware.PartnerID(c))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Daftar perangkat lokasi berhasil dimuat", items)
}

func (h *PartnerHandler) CreateWithdrawal(c *gin.Context) {
	var req dto.CreatePartnerWithdrawalRequest
	if !bindJSON(c, &req, "Nominal pencairan dana tidak valid") {
		return
	}
	res, err := h.svc.CreatePartnerWithdrawal(c.Request.Context(), middleware.PartnerID(c), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Created(c, "Pengajuan pencairan dana berhasil dikirim", res)
}

func (h *PartnerHandler) ListWithdrawals(c *gin.Context) {
	var query dto.WithdrawalListQuery
	if !bindQuery(c, &query, "Parameter riwayat pencairan tidak valid") {
		return
	}
	items, meta, err := h.svc.ListPartnerWithdrawals(c.Request.Context(), middleware.PartnerID(c), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Riwayat pencairan berhasil dimuat", items, meta)
}

func (h *PartnerHandler) ListTransactions(c *gin.Context) {
	var query dto.PaginationQuery
	if !bindQuery(c, &query, "Parameter mutasi tidak valid") {
		return
	}
	items, meta, err := h.svc.ListPartnerTransactions(c.Request.Context(), middleware.PartnerID(c), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Riwayat mutasi pendapatan berhasil dimuat", items, meta)
}
