package handler

import (
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"wifiads/internal/dto"
	"wifiads/internal/middleware"
	"wifiads/internal/service"
	"wifiads/pkg/httpx"
	"wifiads/pkg/media"
	"wifiads/pkg/storage"
)

const AdvertiserCookieName = "wifiads_adv_token"

// MarketplaceHandler exposes both Admin marketplace management endpoints
// and Advertiser client dashboard endpoints.
type MarketplaceHandler struct {
	svc          service.MarketplaceService
	r2           *storage.R2Client
	cookieSecure bool
}

func NewMarketplaceHandler(svc service.MarketplaceService, r2 *storage.R2Client, cookieSecure bool) *MarketplaceHandler {
	return &MarketplaceHandler{
		svc:          svc,
		r2:           r2,
		cookieSecure: cookieSecure,
	}
}

// ==================== ADVERTISER AUTH & PROFILE ====================

func (h *MarketplaceHandler) Register(c *gin.Context) {
	var req dto.AdvertiserRegisterRequest
	if !bindJSON(c, &req, "Data pendaftaran pengiklan tidak valid") {
		return
	}
	res, err := h.svc.RegisterAdvertiser(c.Request.Context(), req)
	if err != nil {
		writeError(c, err)
		return
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(AdvertiserCookieName, res.Token, 60*60*24*7, "/", "", h.cookieSecure, true)
	httpx.Created(c, "Akun pengiklan berhasil dibuat", res)
}

func (h *MarketplaceHandler) Login(c *gin.Context) {
	var req dto.AdvertiserLoginRequest
	if !bindJSON(c, &req, "Data login tidak valid") {
		return
	}
	res, err := h.svc.LoginAdvertiser(c.Request.Context(), req)
	if err != nil {
		writeError(c, err)
		return
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(AdvertiserCookieName, res.Token, 60*60*24*7, "/", "", h.cookieSecure, true)
	httpx.OK(c, "Berhasil masuk", res)
}

func (h *MarketplaceHandler) Logout(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(AdvertiserCookieName, "", -1, "/", "", h.cookieSecure, true)
	httpx.OK(c, "Sesi pengiklan diakhiri", nil)
}

func (h *MarketplaceHandler) GetProfile(c *gin.Context) {
	res, err := h.svc.GetAdvertiserProfile(c.Request.Context(), middleware.AdvertiserID(c))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Profil pengiklan berhasil dimuat", res)
}

func (h *MarketplaceHandler) UpdateProfile(c *gin.Context) {
	var req dto.UpdateAdvertiserProfileRequest
	if !bindJSON(c, &req, "Data profil tidak valid") {
		return
	}
	res, err := h.svc.UpdateAdvertiserProfile(c.Request.Context(), middleware.AdvertiserID(c), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Profil berhasil diperbarui", res)
}

func (h *MarketplaceHandler) ChangePassword(c *gin.Context) {
	var req dto.ChangeAdvertiserPasswordRequest
	if !bindJSON(c, &req, "Data kata sandi tidak valid") {
		return
	}
	if err := h.svc.ChangeAdvertiserPassword(c.Request.Context(), middleware.AdvertiserID(c), req); err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Kata sandi berhasil diperbarui", nil)
}

// ==================== ADVERTISER CONFIG, MAP & CAMPAIGNS ====================

func (h *MarketplaceHandler) GetAdvertiserConfig(c *gin.Context) {
	ctx := c.Request.Context()
	setting, err := h.svc.GetPlatformSetting(ctx)
	if err != nil {
		writeError(c, err)
		return
	}
	tiers, err := h.svc.ListLocationTiers(ctx, true)
	if err != nil {
		writeError(c, err)
		return
	}
	paymentMethods, err := h.svc.ListPaymentMethods(ctx, true)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Konfigurasi berhasil dimuat", gin.H{
		"setting":         setting,
		"location_tiers":  tiers,
		"payment_methods": paymentMethods,
	})
}

func (h *MarketplaceHandler) ListMapRouters(c *gin.Context) {
	items, err := h.svc.ListMarketplaceRouters(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Lokasi router berhasil dimuat", items)
}

func (h *MarketplaceHandler) CreateCampaign(c *gin.Context) {
	var req dto.CreateCampaignRequest
	if !bindJSON(c, &req, "Data iklan tidak valid") {
		return
	}
	res, err := h.svc.CreateCampaign(c.Request.Context(), middleware.AdvertiserID(c), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Created(c, "Iklan berhasil diajukan", res)
}

func (h *MarketplaceHandler) UpdateCampaign(c *gin.Context) {
	var req dto.UpdateCampaignRequest
	if !bindJSON(c, &req, "Data perubahan iklan tidak valid") {
		return
	}
	res, err := h.svc.UpdateCampaign(c.Request.Context(), middleware.AdvertiserID(c), c.Param("id"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Perubahan iklan berhasil disimpan", res)
}

func (h *MarketplaceHandler) ListAdvertiserCampaigns(c *gin.Context) {
	var query dto.CampaignListQuery
	if !bindQuery(c, &query, "Parameter pencarian tidak valid") {
		return
	}
	items, meta, err := h.svc.ListAdvertiserCampaigns(c.Request.Context(), middleware.AdvertiserID(c), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Daftar iklan berhasil dimuat", items, meta)
}

func (h *MarketplaceHandler) GetAdvertiserCampaign(c *gin.Context) {
	res, err := h.svc.GetAdvertiserCampaign(c.Request.Context(), middleware.AdvertiserID(c), c.Param("id"))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Detail iklan berhasil dimuat", res)
}

func (h *MarketplaceHandler) ToggleAdvertiserCampaignStatus(c *gin.Context) {
	var req dto.UpdateCampaignStatusRequest
	if !bindJSON(c, &req, "Permintaan perubahan status tidak valid") {
		return
	}
	res, err := h.svc.ToggleAdvertiserCampaignStatus(c.Request.Context(), middleware.AdvertiserID(c), c.Param("id"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Status iklan berhasil diperbarui", res)
}

func (h *MarketplaceHandler) DeleteAdvertiserCampaign(c *gin.Context) {
	if err := h.svc.DeleteAdvertiserCampaign(c.Request.Context(), middleware.AdvertiserID(c), c.Param("id")); err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Iklan berhasil dihapus", nil)
}

// ==================== ADVERTISER UPLOADS (MEDIA & PAYMENT PROOF) ====================

func (h *MarketplaceHandler) UploadAdvertiserMedia(c *gin.Context) {
	advID := middleware.AdvertiserID(c)
	if advID == "" {
		advID = "guest"
	}
	h.uploadAsset(c, fmt.Sprintf("ads/pengiklan/%s/media", advID), true)
}

func (h *MarketplaceHandler) UploadTopupProofFile(c *gin.Context) {
	advID := middleware.AdvertiserID(c)
	if advID == "" {
		advID = "guest"
	}
	h.uploadAsset(c, fmt.Sprintf("ads/pengiklan/%s/proofs", advID), false)
}

func (h *MarketplaceHandler) AdminUploadQRIS(c *gin.Context) {
	h.uploadAsset(c, "ads/admin/qris", false)
}

func (h *MarketplaceHandler) uploadAsset(c *gin.Context, basePrefix string, allowVideo bool) {
	file, err := c.FormFile("file")
	if err != nil {
		file, err = c.FormFile("image")
	}
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Berkas wajib dipilih", err.Error())
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	imageExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true}
	videoExts := map[string]bool{".mp4": true, ".webm": true, ".mov": true}

	isImage := imageExts[ext]
	isVideo := allowVideo && videoExts[ext]

	if !isImage && !isVideo {
		msg := "Format berkas harus berupa gambar (JPG, PNG, WebP)"
		if allowVideo {
			msg = "Format berkas harus berupa gambar (JPG, PNG, WebP) atau video (MP4, WebM, MOV)"
		}
		httpx.Error(c, http.StatusBadRequest, "BAD_REQUEST", msg, nil)
		return
	}

	maxSize := int64(10 * 1024 * 1024)
	if isVideo {
		maxSize = 50 * 1024 * 1024
	}
	if file.Size > maxSize {
		httpx.Error(c, http.StatusBadRequest, "BAD_REQUEST", fmt.Sprintf("Ukuran berkas melebihi batas %d MB", maxSize/(1024*1024)), nil)
		return
	}

	src, err := file.Open()
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "Gagal membaca berkas", nil)
		return
	}
	defer src.Close()

	data, err := io.ReadAll(src)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "Gagal memproses berkas", nil)
		return
	}

	subFolder := ""
	if strings.HasSuffix(basePrefix, "/media") {
		if isVideo {
			subFolder = "videos"
		} else {
			subFolder = "photos"
		}
	}

	var posterBytes []byte
	videoDurationSec := 0
	transcoded := false
	contentType := mime.TypeByExtension(ext)
	if isVideo {
		processed, pErr := media.ProcessVideo(c.Request.Context(), data, ext, 60)
		if pErr != nil {
			if errors.Is(pErr, media.ErrVideoTooLong) {
				httpx.Error(c, http.StatusBadRequest, "VIDEO_TOO_LONG", pErr.Error(), nil)
				return
			}
		} else if processed != nil {
			data = processed.VideoBytes
			ext = processed.Ext
			contentType = processed.ContentType
			posterBytes = processed.PosterBytes
			videoDurationSec = processed.DurationSeconds
			transcoded = processed.Transcoded
		}
	}

	baseID := uuid.NewString()
	filename := baseID + ext
	objectKey := path.Join(basePrefix, subFolder, filename)
	mediaType := "image"
	if isVideo {
		mediaType = "video"
	}

	if contentType == "" {
		if isVideo {
			contentType = "video/mp4"
		} else {
			contentType = "image/jpeg"
		}
	}

	if h.r2 != nil && h.r2.Enabled() {
		if err := h.r2.PutObject(c.Request.Context(), objectKey, data, contentType); err != nil {
			httpx.Error(c, http.StatusBadGateway, "STORAGE_UPLOAD_FAILED", "Gagal mengunggah berkas ke penyimpanan", err.Error())
			return
		}
	}

	localPath := filepath.Join("uploads", filepath.FromSlash(objectKey))
	if mkErr := os.MkdirAll(filepath.Dir(localPath), 0o755); mkErr == nil {
		_ = os.WriteFile(localPath, data, 0o644)
	} else if h.r2 == nil || !h.r2.Enabled() {
		httpx.Error(c, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "Gagal menyiapkan ruang simpan", nil)
		return
	}

	posterURL := ""
	if len(posterBytes) > 0 {
		posterKey := path.Join(basePrefix, "thumbnails", baseID+".jpg")
		if h.r2 != nil && h.r2.Enabled() {
			_ = h.r2.PutObject(c.Request.Context(), posterKey, posterBytes, "image/jpeg")
		}
		localPosterPath := filepath.Join("uploads", filepath.FromSlash(posterKey))
		if mkErr := os.MkdirAll(filepath.Dir(localPosterPath), 0o755); mkErr == nil {
			_ = os.WriteFile(localPosterPath, posterBytes, 0o644)
		}
		posterURL = "/uploads/" + posterKey
	}

	r2URL := ""
	if h.r2 != nil && h.r2.Enabled() {
		r2URL = h.r2.PublicURL(objectKey)
	}

	httpx.OK(c, "Berkas berhasil diunggah", gin.H{
		"url":              "/uploads/" + objectKey,
		"r2_url":           r2URL,
		"poster_url":       posterURL,
		"key":              objectKey,
		"media_type":       mediaType,
		"duration_seconds": videoDurationSec,
		"transcoded":       transcoded,
		"size":             len(data),
	})
}

// ==================== ADVERTISER WALLET, TOP-UP & ANALYTICS ====================

func (h *MarketplaceHandler) CreateTopup(c *gin.Context) {
	var req dto.CreateTopupRequest
	if !bindJSON(c, &req, "Data Top-Up tidak valid") {
		return
	}
	res, err := h.svc.CreateTopupInvoice(c.Request.Context(), middleware.AdvertiserID(c), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Created(c, "Tagihan Top-Up berhasil dibuat", res)
}

func (h *MarketplaceHandler) SubmitTopupProof(c *gin.Context) {
	var req dto.SubmitTopupProofRequest
	if !bindJSON(c, &req, "Data bukti pembayaran tidak valid") {
		return
	}
	res, err := h.svc.SubmitTopupProof(c.Request.Context(), middleware.AdvertiserID(c), c.Param("id"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Bukti pembayaran berhasil dikirim", res)
}

func (h *MarketplaceHandler) ListAdvertiserTopups(c *gin.Context) {
	var query dto.TopupListQuery
	if !bindQuery(c, &query, "Parameter pencarian tidak valid") {
		return
	}
	items, meta, err := h.svc.ListAdvertiserTopups(c.Request.Context(), middleware.AdvertiserID(c), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Riwayat Top-Up berhasil dimuat", items, meta)
}

func (h *MarketplaceHandler) ListAdvertiserWalletTransactions(c *gin.Context) {
	var query dto.WalletTransactionListQuery
	if !bindQuery(c, &query, "Parameter pencarian tidak valid") {
		return
	}
	items, meta, err := h.svc.ListAdvertiserWalletTransactions(c.Request.Context(), middleware.AdvertiserID(c), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Mutasi saldo berhasil dimuat", items, meta)
}

func (h *MarketplaceHandler) GetAdvertiserOverview(c *gin.Context) {
	res, err := h.svc.GetAdvertiserOverview(c.Request.Context(), middleware.AdvertiserID(c))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Ringkasan berhasil dimuat", res)
}

func (h *MarketplaceHandler) GetAdvertiserAnalytics(c *gin.Context) {
	var query dto.AnalyticsQuery
	if !bindQuery(c, &query, "Parameter laporan tidak valid") {
		return
	}
	res, err := h.svc.GetAdvertiserAnalytics(c.Request.Context(), middleware.AdvertiserID(c), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Laporan performa berhasil dimuat", res)
}

// ==================== ADMIN MARKETPLACE ENDPOINTS ====================

func (h *MarketplaceHandler) AdminGetSetting(c *gin.Context) {
	res, err := h.svc.GetPlatformSetting(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Pengaturan tarif berhasil dimuat", res)
}

func (h *MarketplaceHandler) AdminUpdateSetting(c *gin.Context) {
	var req dto.UpdatePlatformAdSettingRequest
	if !bindJSON(c, &req, "Pengaturan tarif tidak valid") {
		return
	}
	res, err := h.svc.UpdatePlatformSetting(c.Request.Context(), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Pengaturan tarif berhasil disimpan", res)
}

func (h *MarketplaceHandler) AdminListLocationTiers(c *gin.Context) {
	items, err := h.svc.ListLocationTiers(c.Request.Context(), false)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Daftar rank lokasi berhasil dimuat", items)
}

func (h *MarketplaceHandler) AdminCreateLocationTier(c *gin.Context) {
	var req dto.UpsertLocationTierRequest
	if !bindJSON(c, &req, "Data rank lokasi tidak valid") {
		return
	}
	res, err := h.svc.CreateLocationTier(c.Request.Context(), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Created(c, "Rank lokasi berhasil ditambahkan", res)
}

func (h *MarketplaceHandler) AdminUpdateLocationTier(c *gin.Context) {
	var req dto.UpsertLocationTierRequest
	if !bindJSON(c, &req, "Data rank lokasi tidak valid") {
		return
	}
	res, err := h.svc.UpdateLocationTier(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Rank lokasi berhasil diperbarui", res)
}

func (h *MarketplaceHandler) AdminDeleteLocationTier(c *gin.Context) {
	if err := h.svc.DeleteLocationTier(c.Request.Context(), c.Param("id")); err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Rank lokasi berhasil dihapus", nil)
}

func (h *MarketplaceHandler) AdminListPaymentMethods(c *gin.Context) {
	items, err := h.svc.ListPaymentMethods(c.Request.Context(), false)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Metode pembayaran berhasil dimuat", items)
}

func (h *MarketplaceHandler) AdminCreatePaymentMethod(c *gin.Context) {
	var req dto.UpsertPaymentMethodRequest
	if !bindJSON(c, &req, "Data metode pembayaran tidak valid") {
		return
	}
	res, err := h.svc.CreatePaymentMethod(c.Request.Context(), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Created(c, "Metode pembayaran berhasil ditambahkan", res)
}

func (h *MarketplaceHandler) AdminUpdatePaymentMethod(c *gin.Context) {
	var req dto.UpsertPaymentMethodRequest
	if !bindJSON(c, &req, "Data metode pembayaran tidak valid") {
		return
	}
	res, err := h.svc.UpdatePaymentMethod(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Metode pembayaran berhasil diperbarui", res)
}

func (h *MarketplaceHandler) AdminDeletePaymentMethod(c *gin.Context) {
	if err := h.svc.DeletePaymentMethod(c.Request.Context(), c.Param("id")); err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Metode pembayaran berhasil dihapus", nil)
}

func (h *MarketplaceHandler) AdminListAdvertisers(c *gin.Context) {
	var query dto.AdminAdvertiserListQuery
	if !bindQuery(c, &query, "Parameter pencarian tidak valid") {
		return
	}
	items, meta, err := h.svc.AdminListAdvertisers(c.Request.Context(), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Daftar pengiklan berhasil dimuat", items, meta)
}

func (h *MarketplaceHandler) AdminAdjustBalance(c *gin.Context) {
	var req dto.AdminAdjustBalanceRequest
	if !bindJSON(c, &req, "Data penyesuaian saldo tidak valid") {
		return
	}
	res, err := h.svc.AdminAdjustAdvertiserBalance(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Saldo pengiklan berhasil disesuaikan", res)
}

func (h *MarketplaceHandler) AdminToggleAdvertiserStatus(c *gin.Context) {
	var req dto.AdminToggleStatusRequest
	if !bindJSON(c, &req, "Data status akun tidak valid") {
		return
	}
	res, err := h.svc.AdminToggleAdvertiserStatus(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Status akun pengiklan berhasil diperbarui", res)
}

func (h *MarketplaceHandler) AdminListCampaigns(c *gin.Context) {
	var query dto.CampaignListQuery
	if !bindQuery(c, &query, "Parameter pencarian tidak valid") {
		return
	}
	items, meta, err := h.svc.AdminListCampaigns(c.Request.Context(), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Daftar iklan klien berhasil dimuat", items, meta)
}

func (h *MarketplaceHandler) AdminModerateCampaign(c *gin.Context) {
	var req dto.AdminModerateCampaignRequest
	if !bindJSON(c, &req, "Data moderasi tidak valid") {
		return
	}
	res, err := h.svc.AdminModerateCampaign(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Status moderasi iklan berhasil disimpan", res)
}

func (h *MarketplaceHandler) AdminListTopups(c *gin.Context) {
	var query dto.TopupListQuery
	if !bindQuery(c, &query, "Parameter pencarian tidak valid") {
		return
	}
	items, meta, err := h.svc.AdminListTopups(c.Request.Context(), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Daftar Top-Up berhasil dimuat", items, meta)
}

func (h *MarketplaceHandler) AdminVerifyTopup(c *gin.Context) {
	var req dto.AdminVerifyTopupRequest
	if !bindJSON(c, &req, "Data verifikasi tidak valid") {
		return
	}
	res, err := h.svc.AdminVerifyTopup(c.Request.Context(), middleware.AdminID(c), c.Param("id"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Status Top-Up berhasil diperbarui", res)
}
