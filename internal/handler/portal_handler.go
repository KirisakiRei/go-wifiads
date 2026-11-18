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
	adDurationSeconds int
}

// NewPortalHandler builds the portal handler.
func NewPortalHandler(portal service.PortalService, adDurationSeconds int) *PortalHandler {
	return &PortalHandler{portal: portal, adDurationSeconds: adDurationSeconds}
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

	configJSON, err := json.Marshal(gin.H{
		"adId":          adID,
		"adDuration":    adDur,
		"adLayout":      adLayout,
		"isVideo":       isVideo,
		"mac":           c.Query("mac"),
		"ip":            c.Query("ip"),
		"linkLoginOnly": c.Query("link-login-only"),
		"linkLogin":     c.Query("link-login"),
		"linkOrig":      c.DefaultQuery("link-orig", c.Query("dst")),
		"chapId":        c.Query("chap-id"),
		"chapChallenge": c.Query("chap-challenge"),
		"nasIdentifier": nasIdentifier,
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
		// configJSON was produced by encoding/json, which escapes <, > and &
		// as \u003c / \u003e / \u0026, so it cannot terminate the surrounding
		// <script type="application/json"> element. Marking it template.JS
		// keeps it as raw JSON (not an extra-quoted JSON string) so the browser
		// can JSON.parse it straight into an object.
		"PortalConfigJSON": template.JS(configJSON), //nolint:gosec // see comment: JSON-marshalled, angle brackets escaped.
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

// ClickPromo records an ad click and redirects the visitor to the advertiser's promo URL.
func (h *PortalHandler) ClickPromo(c *gin.Context) {
	targetURL, err := h.portal.RecordPromoClick(c.Request.Context(), c.Param("token"))
	if err != nil || strings.TrimSpace(targetURL) == "" {
		c.Redirect(http.StatusFound, "https://www.google.com")
		return
	}
	c.Redirect(http.StatusFound, targetURL)
}
