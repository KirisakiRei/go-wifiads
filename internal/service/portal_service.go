package service

import (
	"context"
	"errors"
	"log/slog"
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
	sessions repository.PortalSessionRepository
	vouchers repository.VoucherRepository
	visitors repository.WifiVisitorRepository
	routers  repository.RouterRepository
	sites    repository.SiteRepository
	ads      repository.AdvertisementRepository
	profiles repository.ConnectProfileRepository
	logger   *slog.Logger

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
	return ad, nil
}

// validateLoginURL allowlists the Hotspot login host so the portal can never
// forward credentials to an arbitrary destination.
func (s *portalService) validateLoginURL(raw string) error {
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
	if len(s.allowedHosts) == 0 {
		if s.devMode {
			return nil
		}
		return apperror.New(apperror.ErrForbidden, "no allowed login host is configured")
	}
	host := strings.ToLower(parsed.Hostname())
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
	if err := s.validateLoginURL(req.LinkLoginOnly); err != nil {
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
	session := &model.PortalSession{
		Base: model.Base{
			ID:        uuid.NewString(),
			CreatedAt: now,
			UpdatedAt: now,
		},
		TokenHash:     utils.HashToken(token),
		SiteID:        router.SiteID,
		RouterID:      router.ID,
		DeviceMAC:     utils.NormalizeMAC(req.MAC),
		DeviceIP:      strings.TrimSpace(req.IP),
		LinkLoginOnly: strings.TrimSpace(req.LinkLoginOnly),
		LinkLogin:     strings.TrimSpace(req.LinkLogin),
		LinkOrig:      strings.TrimSpace(req.LinkOrig),
		ChapID:        strings.TrimSpace(req.ChapID),
		ChapChallenge: strings.TrimSpace(req.ChapChallenge),
		UserAgent:     truncate(userAgent, 500),
		Status:        model.PortalSessionStatusPendingAd,
		AdStartedAt:   now,
		ExpiresAt:     now.Add(s.sessionTTL),
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

	adDur := s.activeAdDuration(ctx)
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

	adDur := s.activeAdDuration(ctx)
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

	// 2. Cek user yang sama dari MAC address dan Router
	// Ketika gagal login atau gagal konek ke internet, jangan langsung generate voucher baru.
	// Jika voucher sebelumnya belum kadaluarsa dan belum dipakai (status ISSUED), coba pakai voucher itu lagi.
	// Jika voucher tersebut sudah kadaluarsa (now > expires_at), tandai EXPIRED, lalu terbitkan voucher baru.
	if session.DeviceMAC != "" {
		latestVoucher, vErr := s.vouchers.FindLatestByMAC(ctx, session.DeviceMAC, session.RouterID)
		if vErr == nil && latestVoucher != nil {
			if latestVoucher.Status == model.VoucherStatusIssued {
				if now.Before(latestVoucher.ExpiresAt) {
					_ = s.vouchers.UpdatePortalSessionID(ctx, latestVoucher.ID, session.ID)
					s.afterVoucherIssued(ctx, session, latestVoucher, now)
					return s.buildConnectResponse(session, latestVoucher)
				}
				_ = s.vouchers.UpdateStatus(ctx, latestVoucher.ID, model.VoucherStatusExpired)
			}
		}
	}

	voucher, err := s.issueVoucher(ctx, session, now)
	if err != nil {
		return nil, err
	}
	return s.buildConnectResponse(session, voucher)
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

	// Resolve profile dari session (jika ada), router default profile, atau service default.
	var profileID *string
	var bwUp, bwDown int

	if session.ProfileID != nil {
		prof, profErr := s.profiles.FindByID(ctx, *session.ProfileID)
		if profErr == nil {
			profileID = &prof.ID
			bwUp = prof.BandwidthUpKbps
			bwDown = prof.BandwidthDownKbps
			if prof.SessionTimeoutSeconds > 0 {
				sessionTimeout = prof.SessionTimeoutSeconds
			}
			if prof.VoucherTTLSeconds > 0 {
				voucherTTL = time.Duration(prof.VoucherTTLSeconds) * time.Second
			}
		}
	} else if router != nil && router.DefaultProfileID != nil && *router.DefaultProfileID != "" {
		prof, profErr := s.profiles.FindByID(ctx, *router.DefaultProfileID)
		if profErr == nil {
			profileID = &prof.ID
			bwUp = prof.BandwidthUpKbps
			bwDown = prof.BandwidthDownKbps
			if prof.SessionTimeoutSeconds > 0 {
				sessionTimeout = prof.SessionTimeoutSeconds
			}
			if prof.VoucherTTLSeconds > 0 {
				voucherTTL = time.Duration(prof.VoucherTTLSeconds) * time.Second
			}
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
			Note:                  "issued by portal session",
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
