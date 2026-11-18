package service

import (
	"context"
	"errors"
	"log/slog"
	"math"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	"wifiads/internal/dto"
	"wifiads/internal/model"
	"wifiads/internal/repository"
	"wifiads/pkg/apperror"
	"wifiads/pkg/utils"
)

type portalService struct {
	sessions    repository.PortalSessionRepository
	vouchers    repository.VoucherRepository
	visitors    repository.WifiVisitorRepository
	routers     repository.RouterRepository
	sites       repository.SiteRepository
	ads         repository.AdvertisementRepository
	profiles    repository.ConnectProfileRepository
	marketplace repository.MarketplaceRepository
	partners    repository.PartnerRepository
	logger      *slog.Logger

	voucherKey            []byte
	usernamePrefix        string
	passwordLength        int
	adDuration            time.Duration
	sessionTTL            time.Duration
	voucherTTL            time.Duration
	defaultSessionTimeout int
	allowedHosts          []string
	devMode               bool
}

// PortalServiceOptions carries configuration into the portal service.
type PortalServiceOptions struct {
	VoucherKey            []byte
	UsernamePrefix        string
	PasswordLength        int
	AdDuration            time.Duration
	SessionTTL            time.Duration
	VoucherTTL            time.Duration
	DefaultSessionTimeout int
	AllowedLoginHosts     []string
	DevMode               bool
	Marketplace           repository.MarketplaceRepository
	Partners              repository.PartnerRepository
}

// NewPortalService builds the visitor portal service.
func NewPortalService(
	sessions repository.PortalSessionRepository,
	vouchers repository.VoucherRepository,
	visitors repository.WifiVisitorRepository,
	connectProfiles repository.ConnectProfileRepository,
	routers repository.RouterRepository,
	sites repository.SiteRepository,
	ads repository.AdvertisementRepository,
	logger *slog.Logger,
	opts PortalServiceOptions,
) PortalService {
	return &portalService{
		sessions:              sessions,
		vouchers:              vouchers,
		visitors:              visitors,
		profiles:              connectProfiles,
		routers:               routers,
		sites:                 sites,
		ads:                   ads,
		marketplace:           opts.Marketplace,
		partners:              opts.Partners,
		logger:                logger,
		voucherKey:            opts.VoucherKey,
		usernamePrefix:        opts.UsernamePrefix,
		passwordLength:        opts.PasswordLength,
		adDuration:            opts.AdDuration,
		sessionTTL:            opts.SessionTTL,
		voucherTTL:            opts.VoucherTTL,
		defaultSessionTimeout: opts.DefaultSessionTimeout,
		allowedHosts:          opts.AllowedLoginHosts,
		devMode:               opts.DevMode,
	}
}

func (s *portalService) CurrentAdvertisement(ctx context.Context) (*model.Advertisement, error) {
	ad, err := s.ads.FindActive(ctx)
	if err != nil {
		if errors.Is(err, apperror.ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}
	if ad != nil {
		ad.ImageURL = normalizeAdMediaURL(ad.ImageURL)
	}
	return ad, nil
}

// SelectAdvertisementForRouter picks an eligible paid advertiser campaign targeting
// the router (matching schedule & active balance) in fair rotation, falling back
// to the default Admin House Ad when none matches.
func (s *portalService) SelectAdvertisementForRouter(ctx context.Context, nasIdentifier string) (*model.Advertisement, error) {
	if s.marketplace != nil && s.routers != nil {
		router, rErr := s.resolveRouter(ctx, "", nasIdentifier)
		if rErr == nil && router != nil {
			var site *model.Site
			if s.sites != nil {
				site, _ = s.sites.FindByID(ctx, router.SiteID)
			}
			ad, _, selErr := s.pickMarketplaceAd(ctx, router, site, time.Now().UTC())
			if selErr == nil && ad != nil {
				ad.ImageURL = normalizeAdMediaURL(ad.ImageURL)
				_ = s.marketplace.TouchCampaignLastShown(ctx, ad.ID, time.Now().UTC())
				return ad, nil
			}
		}
	}
	return s.CurrentAdvertisement(ctx)
}

func (s *portalService) resolveMultiplierForRouter(ctx context.Context, router *model.Router) float64 {
	if s.marketplace == nil || router == nil {
		return 1.0
	}
	tiers, err := s.marketplace.ListLocationTiers(ctx, false)
	if err != nil || len(tiers) == 0 {
		return 1.0
	}
	var avgConn, avgImp int64
	if s.partners != nil {
		if trMap, tErr := s.partners.GetRouterTraffic7d(ctx, time.Now().UTC().AddDate(0, 0, -7)); tErr == nil {
			tr := trMap[router.ID]
			avgConn = computeAvg7d(tr.TotalConnects7d)
			avgImp = computeAvg7d(tr.TotalImpressions7d)
		}
	}
	_, _, mult := ResolveEffectiveRouterTier(router, tiers, avgConn, avgImp)
	if mult <= 0 {
		return 1.0
	}
	return mult
}

func (s *portalService) pickMarketplaceAd(ctx context.Context, router *model.Router, site *model.Site, nowUTC time.Time) (*model.Advertisement, int64, error) {
	if s.marketplace == nil || router == nil {
		return nil, 0, apperror.ErrNotFound
	}
	setting, err := s.marketplace.GetPlatformSetting(ctx)
	if err != nil {
		return nil, 0, err
	}
	multiplier := s.resolveMultiplierForRouter(ctx, router)
	tzName := "Asia/Jakarta"
	if site != nil && strings.TrimSpace(site.Timezone) != "" {
		tzName = strings.TrimSpace(site.Timezone)
	}
	loc, locErr := time.LoadLocation(tzName)
	if locErr != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	return s.marketplace.SelectEligibleCampaignForRouter(ctx, router.ID, multiplier, setting, nowUTC.In(loc))
}

func (s *portalService) computeRouterAdCost(ctx context.Context, router *model.Router, ad *model.Advertisement) int64 {
	if ad == nil || ad.AdvertiserID == nil || *ad.AdvertiserID == "" || s.marketplace == nil {
		return 0
	}
	setting, err := s.marketplace.GetPlatformSetting(ctx)
	if err != nil {
		return 50
	}
	multiplier := s.resolveMultiplierForRouter(ctx, router)
	base := setting.BasePriceImageIDR
	if strings.EqualFold(ad.MediaType, "video") {
		base = setting.BasePriceVideoIDR
	}
	cost := int64(math.Round(float64(base) * multiplier))
	if cost < 1 {
		cost = 1
	}
	return cost
}

// validateLoginURL allowlists the Hotspot login host so the portal can never
// forward credentials to an arbitrary destination.
func (s *portalService) validateLoginURL(ctx context.Context, raw string) error {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		if s.devMode {
			return nil
		}
		return apperror.New(apperror.ErrBadRequest, "link-login-only is required")
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" {
		return apperror.New(apperror.ErrBadRequest, "link-login-only is not a valid URL")
	}
	host := strings.ToLower(parsed.Hostname())

	// Also allow any Hotspot Gateway IP registered in active routers.
	if s.routers != nil {
		if routers, rErr := s.routers.ListActive(ctx); rErr == nil {
			for _, r := range routers {
				if strings.EqualFold(strings.TrimSpace(r.IPAddress), host) {
					return nil
				}
			}
		}
	}

	if len(s.allowedHosts) == 0 {
		if s.devMode {
			return nil
		}
		return apperror.New(apperror.ErrForbidden, "no allowed login host is configured")
	}
	for _, allowed := range s.allowedHosts {
		allowed = strings.ToLower(strings.TrimSpace(allowed))
		if allowed == "" {
			continue
		}
		if strings.HasPrefix(allowed, "*.") {
			if strings.HasSuffix(host, allowed[1:]) {
				return nil
			}
			continue
		}
		if host == allowed {
			return nil
		}
	}
	return apperror.New(apperror.ErrForbidden, "link-login-only host is not allowed")
}

// CreateSession stores the untrusted redirect context and starts the ad timer.
func (s *portalService) CreateSession(ctx context.Context, req dto.CreatePortalSessionRequest, userAgent string) (*dto.PortalSessionResponse, error) {
	if err := s.validateLoginURL(ctx, req.LinkLoginOnly); err != nil {
		return nil, err
	}

	router, err := s.resolveRouter(ctx, req.RouterID, req.NASIdentifier)
	if err != nil {
		return nil, err
	}
	site, err := s.sites.FindByID(ctx, router.SiteID)
	if err != nil {
		return nil, err
	}

	token, err := utils.SecureToken(32)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	deviceMAC := utils.NormalizeMAC(req.MAC)

	// Anti-Ad-Spam & Auto-Reconnect:
	// If this device (MAC) already has an ACTIVE, unexpired voucher on this router,
	// immediately return its credentials so the portal auto-authenticates the user
	// without forcing them to watch the ad again or creating duplicate visitor rows.
	if deviceMAC != "" && s.vouchers != nil {
		if latest, vErr := s.vouchers.FindLatestByMAC(ctx, deviceMAC, router.ID); vErr == nil && latest != nil {
			if latest.Status == model.VoucherStatusActive && now.Before(latest.ExpiresAt) {
				tempSession := &model.PortalSession{
					DeviceMAC:     deviceMAC,
					DeviceIP:      strings.TrimSpace(req.IP),
					LinkLoginOnly: strings.TrimSpace(req.LinkLoginOnly),
					LinkLogin:     strings.TrimSpace(req.LinkLogin),
					LinkOrig:      strings.TrimSpace(req.LinkOrig),
					ChapID:        strings.TrimSpace(req.ChapID),
					ChapChallenge: strings.TrimSpace(req.ChapChallenge),
				}
				if connData, cErr := s.buildConnectResponse(tempSession, latest); cErr == nil {
					rem := int(latest.ExpiresAt.Sub(now).Seconds())
					if rem > 0 {
						connData.SessionTimeoutSeconds = rem
					}
					return &dto.PortalSessionResponse{
						SessionToken:       "auto-resume",
						Status:             model.PortalSessionStatusVoucherIssued,
						AdStartedAt:        now,
						AdDurationSeconds:  0,
						ConnectAvailableAt: now,
						ExpiresAt:          latest.ExpiresAt,
						SiteName:           site.Name,
						RouterName:         router.Name,
						AuthMode:           authModeOf(tempSession),
						AutoConnect:        true,
						ConnectData:        connData,
					}, nil
				}
			}
		}
	}

	var selectedAd *model.Advertisement
	var adCost int64
	if reqAdID := strings.TrimSpace(req.AdvertisementID); reqAdID != "" {
		if s.marketplace != nil {
			if found, fErr := s.marketplace.FindCampaignByID(ctx, reqAdID); fErr == nil && found != nil && found.IsActive {
				selectedAd = found
				adCost = s.computeRouterAdCost(ctx, router, found)
			}
		} else if s.ads != nil {
			if found, fErr := s.ads.FindByID(ctx, reqAdID); fErr == nil && found != nil && found.IsActive {
				selectedAd = found
			}
		}
	}
	if selectedAd == nil {
		if picked, cost, pErr := s.pickMarketplaceAd(ctx, router, site, now); pErr == nil && picked != nil {
			selectedAd = picked
			adCost = cost
			if s.marketplace != nil {
				_ = s.marketplace.TouchCampaignLastShown(ctx, picked.ID, now)
			}
		} else if fallback, fbErr := s.CurrentAdvertisement(ctx); fbErr == nil && fallback != nil {
			selectedAd = fallback
			adCost = 0
		}
	}

	var selectedAdID *string
	if selectedAd != nil && selectedAd.ID != "" {
		idCopy := selectedAd.ID
		selectedAdID = &idCopy
	}

	session := &model.PortalSession{
		Base: model.Base{
			ID:        uuid.NewString(),
			CreatedAt: now,
			UpdatedAt: now,
		},
		TokenHash:         utils.HashToken(token),
		SiteID:            router.SiteID,
		RouterID:          router.ID,
		AdvertisementID:   selectedAdID,
		AdCostSnapshotIDR: adCost,
		DeviceMAC:         deviceMAC,
		DeviceIP:          strings.TrimSpace(req.IP),
		LinkLoginOnly:     strings.TrimSpace(req.LinkLoginOnly),
		LinkLogin:         strings.TrimSpace(req.LinkLogin),
		LinkOrig:          strings.TrimSpace(req.LinkOrig),
		ChapID:            strings.TrimSpace(req.ChapID),
		ChapChallenge:     strings.TrimSpace(req.ChapChallenge),
		UserAgent:         truncate(userAgent, 500),
		Status:            model.PortalSessionStatusPendingAd,
		AdStartedAt:       now,
		ExpiresAt:         now.Add(s.sessionTTL),
	}
	if err := s.sessions.Create(ctx, session); err != nil {
		return nil, err
	}

	visitor := &model.WifiVisitor{
		Base: model.Base{
			ID:        uuid.NewString(),
			CreatedAt: now,
			UpdatedAt: now,
		},
		PortalSessionID: session.ID,
		SiteID:          router.SiteID,
		RouterID:        router.ID,
		MAC:             session.DeviceMAC,
		IP:              session.DeviceIP,
		Status:          model.VisitorStatusPending,
	}
	if err := s.visitors.Create(ctx, visitor); err != nil {
		s.logger.Error("failed to create visitor record",
			slog.String("portal_session_id", session.ID),
			slog.String("error", err.Error()),
		)
		return nil, err
	}

	adDur := s.sessionAdDuration(ctx, session)
	return &dto.PortalSessionResponse{
		SessionToken:       token,
		Status:             session.Status,
		AdStartedAt:        session.AdStartedAt,
		AdDurationSeconds:  int(adDur.Seconds()),
		ConnectAvailableAt: session.AdStartedAt.Add(adDur),
		ExpiresAt:          session.ExpiresAt,
		SiteName:           site.Name,
		RouterName:         router.Name,
		AuthMode:           authModeOf(session),
	}, nil
}

func authModeOf(session *model.PortalSession) string {
	if session.ChapID != "" && session.ChapChallenge != "" {
		return dto.AuthModeCHAP
	}
	return dto.AuthModePAP
}

func (s *portalService) resolveRouter(ctx context.Context, routerID, nasIdentifier string) (*model.Router, error) {
	if routerID != "" {
		return s.routers.FindByID(ctx, routerID)
	}
	if nasIdentifier != "" {
		return s.routers.FindByNASIdentifier(ctx, nasIdentifier)
	}
	routers, err := s.routers.ListActive(ctx)
	if err != nil {
		return nil, err
	}
	switch len(routers) {
	case 1:
		return &routers[0], nil
	case 0:
		return nil, apperror.New(apperror.ErrBadRequest, "no active router is registered")
	default:
		return nil, apperror.New(apperror.ErrBadRequest, "router_id or nas_identifier is required when several routers are active")
	}
}

func (s *portalService) SessionStatus(ctx context.Context, token string) (*dto.PortalSessionStatusResponse, error) {
	session, err := s.sessions.FindByTokenHash(ctx, utils.HashToken(token))
	if err != nil {
		return nil, err
	}
	issued := session.Status == model.PortalSessionStatusVoucherIssued
	return &dto.PortalSessionStatusResponse{
		Status:             session.Status,
		AdStartedAt:        session.AdStartedAt,
		ConnectAvailableAt: session.AdStartedAt.Add(s.adDuration),
		ExpiresAt:          session.ExpiresAt,
		VoucherIssued:      issued,
	}, nil
}

// SubmitSurvey records the visitor's survey response and assigns a connect
// profile (premium if contact info was provided, basic/default if skipped).
func (s *portalService) SubmitSurvey(ctx context.Context, token string, req dto.SubmitSurveyRequest) (*dto.SubmitSurveyResponse, error) {
	session, err := s.sessions.FindByTokenHash(ctx, utils.HashToken(token))
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	if now.After(session.ExpiresAt) {
		return nil, apperror.New(apperror.ErrForbidden, "portal session has expired")
	}
	if session.Status == model.PortalSessionStatusExpired || session.Status == model.PortalSessionStatusFailed {
		return nil, apperror.New(apperror.ErrForbidden, "portal session is no longer usable")
	}

	// Idempotency: kalau survey sudah disubmit, return profile yang sudah di-assign.
	if session.ProfileID != nil {
		profile, err := s.profiles.FindByID(ctx, *session.ProfileID)
		if err != nil {
			return nil, err
		}
		return &dto.SubmitSurveyResponse{
			ProfileName:    profile.Name,
			ProfileDisplay: profile.DisplayName,
			ReadyToConnect: true,
		}, nil
	}

	// Load router mapping jika tersedia
	var router *model.Router
	if session.RouterID != "" && s.routers != nil {
		if r, rErr := s.routers.FindByID(ctx, session.RouterID); rErr == nil && r != nil {
			router = r
		}
	}

	// Pilih profile: metode survey selesai jika ada isi email/phone, metode skip survey jika lewatkan.
	skipped := req.Skipped || (strings.TrimSpace(req.Email) == "" && strings.TrimSpace(req.Phone) == "")
	var profile *model.ConnectProfile
	if skipped {
		if router != nil && router.DefaultProfileID != nil && *router.DefaultProfileID != "" {
			profile, err = s.profiles.FindByID(ctx, *router.DefaultProfileID)
		}
		if profile == nil {
			profile, err = s.profiles.FindDefault(ctx)
		}
	} else {
		if router != nil && router.SurveyProfileID != nil && *router.SurveyProfileID != "" {
			profile, err = s.profiles.FindByID(ctx, *router.SurveyProfileID)
		}
		if profile == nil {
			profile, err = s.profiles.FindForSurveyCompleted(ctx)
			if err != nil && errors.Is(err, apperror.ErrNotFound) {
				// Fallback ke profil default router atau sistem bila profil survei khusus belum diset
				if router != nil && router.DefaultProfileID != nil && *router.DefaultProfileID != "" {
					profile, err = s.profiles.FindByID(ctx, *router.DefaultProfileID)
				}
				if profile == nil {
					profile, err = s.profiles.FindDefault(ctx)
				}
			}
		}
	}
	if err != nil {
		return nil, err
	}

	// Simpan ke session.
	if err := s.sessions.SaveSurvey(ctx, session.ID, req.Email, req.Phone, skipped, profile.ID); err != nil {
		return nil, err
	}

	return &dto.SubmitSurveyResponse{
		ProfileName:    profile.Name,
		ProfileDisplay: profile.DisplayName,
		ReadyToConnect: true,
	}, nil
}

// Connect validates the countdown server-side and issues exactly one voucher.
func (s *portalService) Connect(ctx context.Context, token string) (*dto.ConnectResponse, error) {
	session, err := s.sessions.FindByTokenHash(ctx, utils.HashToken(token))
	if err != nil {
		return nil, err
	}

	// Idempotency: a repeated click returns the voucher already issued.
	existing, findErr := s.vouchers.FindByPortalSessionID(ctx, session.ID)
	if findErr == nil {
		return s.buildConnectResponse(session, existing)
	}
	if !errors.Is(findErr, apperror.ErrNotFound) {
		return nil, findErr
	}

	now := time.Now().UTC()
	if session.Status == model.PortalSessionStatusExpired || session.Status == model.PortalSessionStatusFailed {
		return nil, apperror.New(apperror.ErrForbidden, "portal session is no longer usable")
	}
	if now.After(session.ExpiresAt) {
		if updateErr := s.sessions.UpdateStatus(ctx, session.ID, model.PortalSessionStatusExpired); updateErr != nil {
			s.logger.Warn("failed to expire portal session", slog.String("error", updateErr.Error()))
		}
		return nil, apperror.New(apperror.ErrForbidden, "portal session has expired")
	}

	adDur := s.sessionAdDuration(ctx, session)
	readyAt := session.AdStartedAt.Add(adDur)
	if now.Before(readyAt) {
		remaining := int(readyAt.Sub(now).Round(time.Second) / time.Second)
		if remaining < 1 {
			remaining = 1
		}
		return nil, apperror.WithDetails(apperror.ErrBadRequest, "advertisement countdown is not finished", map[string]any{
			"remaining_seconds": remaining,
		})
	}

	// Atomically record completed ad impression and settle advertiser wallet charge
	var settledAd *model.Advertisement
	if s.marketplace != nil && session.AdvertisementID != nil && *session.AdvertisementID != "" {
		ad, settleErr := s.marketplace.SettlePortalSessionAd(ctx, session.ID, now)
		if settleErr != nil {
			s.logger.Warn("failed to settle portal session ad impression",
				slog.String("portal_session_id", session.ID),
				slog.String("error", settleErr.Error()),
			)
		} else {
			settledAd = ad
		}
	}

	// 2. Cek user yang sama dari MAC address dan Router
	if session.DeviceMAC != "" {
		latestVoucher, vErr := s.vouchers.FindLatestByMAC(ctx, session.DeviceMAC, session.RouterID)
		if vErr == nil && latestVoucher != nil {
			if latestVoucher.Status == model.VoucherStatusIssued {
				if now.Before(latestVoucher.ExpiresAt) {
					_ = s.vouchers.UpdatePortalSessionID(ctx, latestVoucher.ID, session.ID)
					s.afterVoucherIssued(ctx, session, latestVoucher, now)
					resp, bErr := s.buildConnectResponse(session, latestVoucher)
					if bErr == nil && settledAd != nil && strings.TrimSpace(settledAd.TargetURL) != "" {
						resp.PromoURL = "/api/v1/portal-sessions/" + url.PathEscape(token) + "/click"
						resp.PromoTitle = settledAd.Title
					}
					return resp, bErr
				}
				_ = s.vouchers.UpdateStatus(ctx, latestVoucher.ID, model.VoucherStatusExpired)
			}
		}
	}

	voucher, err := s.issueVoucher(ctx, session, now)
	if err != nil {
		return nil, err
	}
	resp, err := s.buildConnectResponse(session, voucher)
	if err == nil && settledAd != nil && strings.TrimSpace(settledAd.TargetURL) != "" {
		resp.PromoURL = "/api/v1/portal-sessions/" + url.PathEscape(token) + "/click"
		resp.PromoTitle = settledAd.Title
	}
	return resp, err
}

func (s *portalService) RecordPromoClick(ctx context.Context, token string) (string, error) {
	session, err := s.sessions.FindByTokenHash(ctx, utils.HashToken(token))
	if err != nil {
		return "", err
	}
	if s.marketplace == nil {
		return "", apperror.ErrNotFound
	}
	targetURL, err := s.marketplace.RecordAdClickByPortalSession(ctx, session.ID, time.Now().UTC())
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(targetURL) == "" {
		return "https://www.google.com", nil
	}
	return targetURL, nil
}

func (s *portalService) issueVoucher(ctx context.Context, session *model.PortalSession, now time.Time) (*model.Voucher, error) {
	// Defaults from service configuration
	prefix := s.usernamePrefix
	digitCount := 6
	numericOnly := true
	sessionTimeout := s.defaultSessionTimeout
	voucherTTL := s.voucherTTL

	// Load router configuration if available
	var router *model.Router
	if session.RouterID != "" && s.routers != nil {
		if r, rErr := s.routers.FindByID(ctx, session.RouterID); rErr == nil && r != nil {
			router = r
			if r.VoucherPrefix != "" {
				prefix = r.VoucherPrefix
			}
			if r.VoucherDigitCount > 0 {
				digitCount = r.VoucherDigitCount
			}
			numericOnly = r.VoucherNumericOnly
			if r.VoucherTTLSeconds > 0 {
				voucherTTL = time.Duration(r.VoucherTTLSeconds) * time.Second
			}
			if r.SessionTimeoutSeconds > 0 {
				sessionTimeout = r.SessionTimeoutSeconds
			}
		}
	}

	// Resolve profile dari session (jika ada), router default profile, atau global default profile.
	var profileID *string
	var bwUp, bwDown int

	var resolvedProfile *model.ConnectProfile
	if session.ProfileID != nil && s.profiles != nil {
		if prof, profErr := s.profiles.FindByID(ctx, *session.ProfileID); profErr == nil {
			resolvedProfile = prof
		}
	}
	if resolvedProfile == nil && router != nil && router.DefaultProfileID != nil && *router.DefaultProfileID != "" && s.profiles != nil {
		if prof, profErr := s.profiles.FindByID(ctx, *router.DefaultProfileID); profErr == nil {
			resolvedProfile = prof
		}
	}
	if resolvedProfile == nil && s.profiles != nil {
		if prof, profErr := s.profiles.FindDefault(ctx); profErr == nil {
			resolvedProfile = prof
		}
	}
	if resolvedProfile != nil {
		profileID = &resolvedProfile.ID
		bwUp = resolvedProfile.BandwidthUpKbps
		bwDown = resolvedProfile.BandwidthDownKbps
		if resolvedProfile.SessionTimeoutSeconds > 0 {
			sessionTimeout = resolvedProfile.SessionTimeoutSeconds
		}
		if resolvedProfile.VoucherTTLSeconds > 0 {
			voucherTTL = time.Duration(resolvedProfile.VoucherTTLSeconds) * time.Second
		}
	}

	password, err := utils.GenerateVoucherPassword(s.passwordLength)
	if err != nil {
		return nil, err
	}
	cipher, err := utils.EncryptString(s.voucherKey, password)
	if err != nil {
		return nil, err
	}

	routerLabel := "Hotspot"
	if router != nil && router.Name != "" {
		routerLabel = router.Name
	}
	surveyNote := "Isi Survei"
	if session.SurveySkipped {
		surveyNote = "Tanpa Survei"
	}
	macLabel := session.DeviceMAC
	if macLabel == "" {
		macLabel = "—"
	}
	informativeNote := "Router " + routerLabel + " • " + surveyNote + " • MAC " + macLabel

	for attempt := 0; attempt < 5; attempt++ {
		username, genErr := utils.GenerateCustomVoucherUsername(prefix, digitCount, numericOnly)
		if genErr != nil {
			return nil, genErr
		}
		sessionID := session.ID
		voucher := &model.Voucher{
			Base: model.Base{
				ID:        uuid.NewString(),
				CreatedAt: now,
				UpdatedAt: now,
			},
			Username:              username,
			PasswordCiphertext:    cipher,
			Status:                model.VoucherStatusIssued,
			SiteID:                session.SiteID,
			RouterID:              session.RouterID,
			PortalSessionID:       &sessionID,
			ExpectedMAC:           session.DeviceMAC,
			CreatedBy:             "portal",
			Note:                  informativeNote,
			ExpiresAt:             now.Add(voucherTTL),
			SessionTimeoutSeconds: sessionTimeout,
			ProfileID:             profileID,
			BandwidthUpKbps:       bwUp,
			BandwidthDownKbps:     bwDown,
		}
		createErr := s.vouchers.CreateForPortalSession(ctx, voucher)
		if createErr == nil {
			s.afterVoucherIssued(ctx, session, voucher, now)
			return voucher, nil
		}
		if !errors.Is(createErr, apperror.ErrAlreadyExists) {
			return nil, createErr
		}
		// A concurrent Connect (or a retry) already created the voucher for
		// this session: return that voucher to keep Connect idempotent.
		existing, findErr := s.vouchers.FindByPortalSessionID(ctx, session.ID)
		if findErr == nil {
			return existing, nil
		}
		if !errors.Is(findErr, apperror.ErrNotFound) {
			return nil, findErr
		}
	}
	return nil, apperror.New(apperror.ErrConflict, "could not allocate a unique voucher username")
}

// afterVoucherIssued syncs the portal session and visitor; failures are logged
// because the voucher itself is already valid for RADIUS.
func (s *portalService) afterVoucherIssued(ctx context.Context, session *model.PortalSession, voucher *model.Voucher, now time.Time) {
	if err := s.sessions.MarkVoucherIssued(ctx, session.ID, now); err != nil {
		s.logger.Warn("failed to mark portal session as voucher issued",
			slog.String("portal_session_id", session.ID),
			slog.String("error", err.Error()),
		)
	}
	if err := s.visitors.AttachVoucher(ctx, session.ID, voucher.ID, voucher.Username, now); err != nil {
		s.logger.Warn("failed to attach voucher to visitor",
			slog.String("portal_session_id", session.ID),
			slog.String("error", err.Error()),
		)
	}
}

func (s *portalService) buildConnectResponse(session *model.PortalSession, voucher *model.Voucher) (*dto.ConnectResponse, error) {
	password, err := utils.DecryptString(s.voucherKey, voucher.PasswordCiphertext)
	if err != nil {
		s.logger.Error("failed to decrypt voucher password",
			slog.String("voucher_id", voucher.ID),
			slog.String("error", err.Error()),
		)
		return nil, apperror.ErrInternalServer
	}
	// The voucher plaintext is meant to be submitted once to the Hotspot via the
	// browser (and must reach RADIUS to verify CHAP), so it is not persisted.
	// Development mode prints it only to the local console when the portal is
	// exercised without a MikroTik; production never logs the secret (PRD §7.1).
	if s.devMode && !sessionLinkPresent(session.LinkLoginOnly) {
		s.logger.Info("portal dev mode issued voucher",
			slog.String("username", voucher.Username),
		)
	}
	return &dto.ConnectResponse{
		Username:              voucher.Username,
		Password:              password,
		LinkLoginOnly:         session.LinkLoginOnly,
		LinkLogin:             session.LinkLogin,
		LinkOrig:              session.LinkOrig,
		ChapID:                session.ChapID,
		ChapChallenge:         session.ChapChallenge,
		AuthMode:              authModeOf(session),
		SessionTimeoutSeconds: voucher.SessionTimeoutSeconds,
		VoucherExpiresAt:      voucher.ExpiresAt,
		BandwidthUpKbps:       voucher.BandwidthUpKbps,
		BandwidthDownKbps:     voucher.BandwidthDownKbps,
	}, nil
}

func (s *portalService) sessionAdDuration(ctx context.Context, session *model.PortalSession) time.Duration {
	if session != nil && session.AdvertisementID != nil && *session.AdvertisementID != "" {
		if s.marketplace != nil {
			if ad, err := s.marketplace.FindCampaignByID(ctx, *session.AdvertisementID); err == nil && ad != nil && ad.DurationSeconds > 0 {
				return time.Duration(ad.DurationSeconds) * time.Second
			}
		} else if s.ads != nil {
			if ad, err := s.ads.FindByID(ctx, *session.AdvertisementID); err == nil && ad != nil && ad.DurationSeconds > 0 {
				return time.Duration(ad.DurationSeconds) * time.Second
			}
		}
	}
	return s.activeAdDuration(ctx)
}

func (s *portalService) activeAdDuration(ctx context.Context) time.Duration {
	if s.ads != nil {
		if ad, err := s.ads.FindActive(ctx); err == nil && ad != nil && ad.DurationSeconds > 0 {
			return time.Duration(ad.DurationSeconds) * time.Second
		}
	}
	return s.adDuration
}

func sessionLinkPresent(link string) bool {
	return strings.TrimSpace(link) != ""
}

func truncate(value string, limit int) string {
	if len(value) <= limit {
		return value
	}
	return value[:limit]
}
