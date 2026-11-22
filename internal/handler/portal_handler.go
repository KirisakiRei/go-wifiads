package handler

import (
	"encoding/json"
	"html/template"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"wifiads/internal/dto"
	"wifiads/internal/service"
	"wifiads/pkg/httpx"
)

// PortalHandler serves the visitor portal and its JSON API.
type PortalHandler struct {
	portal            service.PortalService
	ops               service.PlatformOpsService
	adDurationSeconds int
}

// NewPortalHandler builds the portal handler.
func NewPortalHandler(portal service.PortalService, adDurationSeconds int) *PortalHandler {
	return &PortalHandler{portal: portal, adDurationSeconds: adDurationSeconds}
}

// SetPlatformOps attaches optional questionnaire & settings service for dynamic portal rendering.
func (h *PortalHandler) SetPlatformOps(ops service.PlatformOpsService) {
	h.ops = ops
}

// ShowPortalPage renders the captive portal shell. All Hotspot parameters stay
// in the browser and are posted back explicitly by the page script.
func (h *PortalHandler) ShowPortalPage(c *gin.Context) {
	nasIdentifier := c.DefaultQuery("nasid", c.Query("nas-identifier"))
	ad, err := h.portal.SelectAdvertisementForRouter(c.Request.Context(), nasIdentifier)
	if err != nil {
		writeError(c, err)
		return
	}

	adLayout := "landscape"
	adDur := h.adDurationSeconds
	isVideo := false
	adID := ""

	if ad != nil {
		adID = ad.ID
		if ad.LayoutMode != "" {
			adLayout = ad.LayoutMode
		}
		if ad.DurationSeconds > 0 {
			adDur = ad.DurationSeconds
		}
		urlLower := strings.ToLower(ad.ImageURL)
		if ad.MediaType == "video" || strings.HasSuffix(urlLower, ".mp4") || strings.HasSuffix(urlLower, ".webm") || strings.HasSuffix(urlLower, ".mov") {
			isVideo = true
		}
	}

	var activeFields []dto.QuestionnaireFieldResponse
	portalSettings := map[string]string{
		"portal.brand_name":            "WiFiAds",
		"portal.welcome_title":         "Wi-Fi Gratis Siap Digunakan",
		"portal.welcome_subtitle":      "Tonton iklan singkat untuk terhubung ke internet cepat.",
		"portal.default_redirect_url":  "https://www.google.com",
		"portal.enable_voucher_redeem": "true",
		"portal.enable_survey":         "true",
		"portal.ad_fallback_seconds":   "15",
	}
	if h.ops != nil {
		if fields, fErr := h.ops.ListQuestionnaireFields(c.Request.Context(), true); fErr == nil {
			activeFields = fields
		}
		for k, v := range h.ops.GetPortalSettingsMap(c.Request.Context()) {
			portalSettings[k] = v
		}
	}

	configJSON, err := json.Marshal(gin.H{
		"adId":          adID,
		"adDuration":    adDur,
		"adLayout":      adLayout,
		"isVideo":       isVideo,
		"mac":           c.Query("mac"),
		"ip":            c.Query("ip"),
		"linkLoginOnly": c.Query("link-login-only"),
		"linkLogin":     c.Query("link-login"),
		"linkLogout":    c.Query("link-logout"),
		"linkOrig":      c.DefaultQuery("link-orig", c.Query("dst")),
		"chapId":        c.Query("chap-id"),
		"chapChallenge": c.Query("chap-challenge"),
		"nasIdentifier": nasIdentifier,
		"fields":        activeFields,
		"settings":      portalSettings,
	})
	if err != nil {
		writeError(c, err)
		return
	}

	c.HTML(http.StatusOK, "portal.html", gin.H{
		"Ad":                ad,
		"AdDurationSeconds": adDur,
		"IsVideo":           isVideo,
		"Year":              time.Now().Year(),
		"ActiveFields":      activeFields,
		"PortalSettings":    portalSettings,
		"PortalConfigJSON":  template.JS(configJSON), //nolint:gosec // JSON-marshalled, angle brackets escaped.
	})
}

// CreateSession registers the untrusted redirect context and starts the timer.
func (h *PortalHandler) CreateSession(c *gin.Context) {
	var req dto.CreatePortalSessionRequest
	if !bindJSON(c, &req, "Invalid portal session payload") {
		return
	}
	res, err := h.portal.CreateSession(c.Request.Context(), req, c.Request.UserAgent())
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Created(c, "Portal session created", res)
}

// SessionStatus reports the current portal session state.
func (h *PortalHandler) SessionStatus(c *gin.Context) {
	res, err := h.portal.SessionStatus(c.Request.Context(), c.Param("token"))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Portal session retrieved", res)
}

// Connect validates the countdown and issues the temporary voucher.
func (h *PortalHandler) Connect(c *gin.Context) {
	res, err := h.portal.Connect(c.Request.Context(), c.Param("token"))
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Voucher issued", res)
}

// SubmitSurvey saves the user's survey answer and assigns a connect profile.
func (h *PortalHandler) SubmitSurvey(c *gin.Context) {
	var req dto.SubmitSurveyRequest
	if !bindJSON(c, &req, "Invalid survey payload") {
		return
	}
	res, err := h.portal.SubmitSurvey(c.Request.Context(), c.Param("token"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Survey submitted", res)
}

// GetActiveSession checks if the guest MAC already has an online hotspot session.
func (h *PortalHandler) GetActiveSession(c *gin.Context) {
	mac := c.Query("mac")
	nasid := c.DefaultQuery("nasid", c.Query("nas-identifier"))
	res, err := h.portal.GetActiveSession(c.Request.Context(), mac, nasid)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Active session status", res)
}

// DisconnectActiveSession allows a guest to disconnect their live hotspot session.
func (h *PortalHandler) DisconnectActiveSession(c *gin.Context) {
	var req dto.PortalDisconnectRequest
	if !bindJSON(c, &req, "Invalid disconnect payload") {
		return
	}
	res, err := h.portal.DisconnectActiveSession(c.Request.Context(), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, res.Message, res)
}

// RedeemVoucher validates a manual voucher code and returns the Hotspot login payload.
func (h *PortalHandler) RedeemVoucher(c *gin.Context) {
	var req dto.RedeemVoucherRequest
	if !bindJSON(c, &req, "Invalid voucher payload") {
		return
	}
	res, err := h.portal.RedeemVoucher(c.Request.Context(), c.Param("token"), req)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Voucher redeemed", res)
}

// ClickPromo records an ad click and redirects the visitor to the advertiser's promo URL.
func (h *PortalHandler) ClickPromo(c *gin.Context) {
	targetURL, err := h.portal.RecordPromoClick(c.Request.Context(), c.Param("token"))
	if err != nil || strings.TrimSpace(targetURL) == "" {
		c.Redirect(http.StatusFound, "https://www.google.com")
		return
	}
	c.Redirect(http.StatusFound, targetURL)
}
