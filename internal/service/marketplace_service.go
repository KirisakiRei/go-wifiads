package service

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"math/big"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	"wifiads/internal/dto"
	"wifiads/internal/middleware"
	"wifiads/internal/model"
	"wifiads/internal/repository"
	"wifiads/pkg/apperror"
	"wifiads/pkg/utils"
)

type MarketplaceService interface {
	// Public / Shared Config
	GetPlatformSetting(ctx context.Context) (*dto.PlatformAdSettingResponse, error)
	UpdatePlatformSetting(ctx context.Context, req dto.UpdatePlatformAdSettingRequest) (*dto.PlatformAdSettingResponse, error)

	ListLocationTiers(ctx context.Context, onlyActive bool) ([]dto.LocationTierResponse, error)
	CreateLocationTier(ctx context.Context, req dto.UpsertLocationTierRequest) (*dto.LocationTierResponse, error)
	UpdateLocationTier(ctx context.Context, id string, req dto.UpsertLocationTierRequest) (*dto.LocationTierResponse, error)
	DeleteLocationTier(ctx context.Context, id string) error

	ListPaymentMethods(ctx context.Context, onlyActive bool) ([]dto.PaymentMethodResponse, error)
	CreatePaymentMethod(ctx context.Context, req dto.UpsertPaymentMethodRequest) (*dto.PaymentMethodResponse, error)
	UpdatePaymentMethod(ctx context.Context, id string, req dto.UpsertPaymentMethodRequest) (*dto.PaymentMethodResponse, error)
	DeletePaymentMethod(ctx context.Context, id string) error

	// Advertiser Auth & Profile
	RegisterAdvertiser(ctx context.Context, req dto.AdvertiserRegisterRequest) (*dto.AdvertiserAuthResponse, error)
	LoginAdvertiser(ctx context.Context, req dto.AdvertiserLoginRequest) (*dto.AdvertiserAuthResponse, error)
	GetAdvertiserProfile(ctx context.Context, advertiserID string) (*dto.AdvertiserProfileResponse, error)
	UpdateAdvertiserProfile(ctx context.Context, advertiserID string, req dto.UpdateAdvertiserProfileRequest) (*dto.AdvertiserProfileResponse, error)
	ChangeAdvertiserPassword(ctx context.Context, advertiserID string, req dto.ChangeAdvertiserPasswordRequest) error

	// Marketplace Map & Advertiser Campaigns
	ListMarketplaceRouters(ctx context.Context) ([]dto.MarketplaceRouterPoint, error)
	CreateCampaign(ctx context.Context, advertiserID string, req dto.CreateCampaignRequest) (*dto.CampaignResponse, error)
	UpdateCampaign(ctx context.Context, advertiserID, campaignID string, req dto.UpdateCampaignRequest) (*dto.CampaignResponse, error)
	ListAdvertiserCampaigns(ctx context.Context, advertiserID string, query dto.CampaignListQuery) ([]dto.CampaignResponse, dto.PaginationMeta, error)
	GetAdvertiserCampaign(ctx context.Context, advertiserID, campaignID string) (*dto.CampaignResponse, error)
	ToggleAdvertiserCampaignStatus(ctx context.Context, advertiserID, campaignID string, req dto.UpdateCampaignStatusRequest) (*dto.CampaignResponse, error)
	DeleteAdvertiserCampaign(ctx context.Context, advertiserID, campaignID string) error

	// Advertiser Wallet, Top-Up & Analytics
	CreateTopupInvoice(ctx context.Context, advertiserID string, req dto.CreateTopupRequest) (*dto.TopupInvoiceResponse, error)
	SubmitTopupProof(ctx context.Context, advertiserID, invoiceID string, req dto.SubmitTopupProofRequest) (*dto.TopupInvoiceResponse, error)
	ListAdvertiserTopups(ctx context.Context, advertiserID string, query dto.TopupListQuery) ([]dto.TopupInvoiceResponse, dto.PaginationMeta, error)
	ListAdvertiserWalletTransactions(ctx context.Context, advertiserID string, query dto.WalletTransactionListQuery) ([]dto.WalletTransactionResponse, dto.PaginationMeta, error)
	GetAdvertiserOverview(ctx context.Context, advertiserID string) (*dto.AdvertiserOverviewResponse, error)
	GetAdvertiserAnalytics(ctx context.Context, advertiserID string, query dto.AnalyticsQuery) (*dto.AdvertiserAnalyticsResponse, error)

	// Admin Moderation & Verification
	AdminListAdvertisers(ctx context.Context, query dto.AdminAdvertiserListQuery) ([]dto.AdvertiserProfileResponse, dto.PaginationMeta, error)
	AdminToggleAdvertiserStatus(ctx context.Context, advertiserID string, req dto.AdminToggleStatusRequest) (*dto.AdvertiserProfileResponse, error)
	AdminAdjustAdvertiserBalance(ctx context.Context, advertiserID string, req dto.AdminAdjustBalanceRequest) (*dto.AdvertiserProfileResponse, error)
	AdminListCampaigns(ctx context.Context, query dto.CampaignListQuery) ([]dto.CampaignResponse, dto.PaginationMeta, error)
	AdminModerateCampaign(ctx context.Context, campaignID string, req dto.AdminModerateCampaignRequest) (*dto.CampaignResponse, error)
	AdminListTopups(ctx context.Context, query dto.TopupListQuery) ([]dto.TopupInvoiceResponse, dto.PaginationMeta, error)
	AdminVerifyTopup(ctx context.Context, adminID, invoiceID string, req dto.AdminVerifyTopupRequest) (*dto.TopupInvoiceResponse, error)
	SetPartnerRepository(partners repository.PartnerRepository)
}

type marketplaceService struct {
	repo      repository.MarketplaceRepository
	partners  repository.PartnerRepository
	routers   repository.RouterRepository
	accounts  repository.AccountingRepository
	logger    *slog.Logger
	jwtSecret string
	jwtIssuer string
	jwtTTL    time.Duration
}

func NewMarketplaceService(
	repo repository.MarketplaceRepository,
	routers repository.RouterRepository,
	accounts repository.AccountingRepository,
	logger *slog.Logger,
	jwtSecret string,
	jwtIssuer string,
	jwtTTL time.Duration,
) MarketplaceService {
	return &marketplaceService{
		repo:      repo,
		routers:   routers,
		accounts:  accounts,
		logger:    logger,
		jwtSecret: jwtSecret,
		jwtIssuer: jwtIssuer,
		jwtTTL:    jwtTTL,
	}
}

func (s *marketplaceService) SetPartnerRepository(partners repository.PartnerRepository) {
	s.partners = partners
}

// ==================== PLATFORM SETTINGS, TIERS & PAYMENT METHODS ====================

func (s *marketplaceService) GetPlatformSetting(ctx context.Context) (*dto.PlatformAdSettingResponse, error) {
	item, err := s.repo.GetPlatformSetting(ctx)
	if err != nil {
		return nil, err
	}
	sharePct := item.DefaultPartnerSharePercent
	if sharePct <= 0 {
		sharePct = 20
	}
	minWd := item.MinWithdrawalAmountIDR
	if minWd <= 0 {
		minWd = 50000
	}
	return &dto.PlatformAdSettingResponse{
		BasePriceImageIDR:          item.BasePriceImageIDR,
		BasePriceVideoIDR:          item.BasePriceVideoIDR,
		MaxAdDurationSeconds:       item.MaxAdDurationSeconds,
		MinTopupAmountIDR:          item.MinTopupAmountIDR,
		DefaultPartnerSharePercent: sharePct,
		MinWithdrawalAmountIDR:     minWd,
		RequireAdApproval:          item.RequireAdApproval,
		UpdatedAt:                  item.UpdatedAt,
	}, nil
}

func (s *marketplaceService) UpdatePlatformSetting(ctx context.Context, req dto.UpdatePlatformAdSettingRequest) (*dto.PlatformAdSettingResponse, error) {
	item, err := s.repo.GetPlatformSetting(ctx)
	if err != nil {
		return nil, err
	}
	item.BasePriceImageIDR = req.BasePriceImageIDR
	item.BasePriceVideoIDR = req.BasePriceVideoIDR
	item.MaxAdDurationSeconds = req.MaxAdDurationSeconds
	item.MinTopupAmountIDR = req.MinTopupAmountIDR
	if req.DefaultPartnerSharePercent >= 0 {
		item.DefaultPartnerSharePercent = req.DefaultPartnerSharePercent
	}
	if req.MinWithdrawalAmountIDR >= 1000 {
		item.MinWithdrawalAmountIDR = req.MinWithdrawalAmountIDR
	}
	item.RequireAdApproval = req.RequireAdApproval
	item.UpdatedAt = time.Now().UTC()
	if err := s.repo.SavePlatformSetting(ctx, item); err != nil {
		return nil, err
	}
	return s.GetPlatformSetting(ctx)
}

func (s *marketplaceService) ListLocationTiers(ctx context.Context, onlyActive bool) ([]dto.LocationTierResponse, error) {
	items, err := s.repo.ListLocationTiers(ctx, onlyActive)
	if err != nil {
		return nil, err
	}
	out := make([]dto.LocationTierResponse, 0, len(items))
	for _, t := range items {
		out = append(out, toLocationTierDTO(&t))
	}
	return out, nil
}

func (s *marketplaceService) CreateLocationTier(ctx context.Context, req dto.UpsertLocationTierRequest) (*dto.LocationTierResponse, error) {
	now := time.Now().UTC()
	tier := &model.LocationTier{
		Base:                model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		Name:                strings.TrimSpace(req.Name),
		Multiplier:          req.Multiplier,
		MinDailyConnects:    req.MinDailyConnects,
		MinDailyImpressions: req.MinDailyImpressions,
		Description:         strings.TrimSpace(req.Description),
		SortOrder:           req.SortOrder,
		IsActive:            req.IsActive,
	}
	if err := s.repo.CreateLocationTier(ctx, tier); err != nil {
		return nil, err
	}
	res := toLocationTierDTO(tier)
	return &res, nil
}

func (s *marketplaceService) UpdateLocationTier(ctx context.Context, id string, req dto.UpsertLocationTierRequest) (*dto.LocationTierResponse, error) {
	tier, err := s.repo.FindLocationTierByID(ctx, id)
	if err != nil {
		return nil, err
	}
	tier.Name = strings.TrimSpace(req.Name)
	tier.Multiplier = req.Multiplier
	tier.MinDailyConnects = req.MinDailyConnects
	tier.MinDailyImpressions = req.MinDailyImpressions
	tier.Description = strings.TrimSpace(req.Description)
	tier.SortOrder = req.SortOrder
	tier.IsActive = req.IsActive
	tier.UpdatedAt = time.Now().UTC()
	if err := s.repo.UpdateLocationTier(ctx, tier); err != nil {
		return nil, err
	}
	res := toLocationTierDTO(tier)
	return &res, nil
}

func (s *marketplaceService) DeleteLocationTier(ctx context.Context, id string) error {
	return s.repo.DeleteLocationTier(ctx, id)
}

func (s *marketplaceService) ListPaymentMethods(ctx context.Context, onlyActive bool) ([]dto.PaymentMethodResponse, error) {
	items, err := s.repo.ListPaymentMethods(ctx, onlyActive)
	if err != nil {
		return nil, err
	}
	out := make([]dto.PaymentMethodResponse, 0, len(items))
	for _, pm := range items {
		out = append(out, toPaymentMethodDTO(&pm))
	}
	return out, nil
}

func (s *marketplaceService) CreatePaymentMethod(ctx context.Context, req dto.UpsertPaymentMethodRequest) (*dto.PaymentMethodResponse, error) {
	now := time.Now().UTC()
	pm := &model.PaymentMethod{
		Base:          model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		Type:          req.Type,
		ProviderName:  strings.TrimSpace(req.ProviderName),
		AccountNumber: strings.TrimSpace(req.AccountNumber),
		AccountHolder: strings.TrimSpace(req.AccountHolder),
		QrisImageURL:  strings.TrimSpace(req.QrisImageURL),
		Instructions:  strings.TrimSpace(req.Instructions),
		SortOrder:     req.SortOrder,
		IsActive:      req.IsActive,
	}
	if err := s.repo.CreatePaymentMethod(ctx, pm); err != nil {
		return nil, err
	}
	res := toPaymentMethodDTO(pm)
	return &res, nil
}

func (s *marketplaceService) UpdatePaymentMethod(ctx context.Context, id string, req dto.UpsertPaymentMethodRequest) (*dto.PaymentMethodResponse, error) {
	pm, err := s.repo.FindPaymentMethodByID(ctx, id)
	if err != nil {
		return nil, err
	}
	pm.Type = req.Type
	pm.ProviderName = strings.TrimSpace(req.ProviderName)
	pm.AccountNumber = strings.TrimSpace(req.AccountNumber)
	pm.AccountHolder = strings.TrimSpace(req.AccountHolder)
	pm.QrisImageURL = strings.TrimSpace(req.QrisImageURL)
	pm.Instructions = strings.TrimSpace(req.Instructions)
	pm.SortOrder = req.SortOrder
	pm.IsActive = req.IsActive
	pm.UpdatedAt = time.Now().UTC()
	if err := s.repo.UpdatePaymentMethod(ctx, pm); err != nil {
		return nil, err
	}
	res := toPaymentMethodDTO(pm)
	return &res, nil
}

func (s *marketplaceService) DeletePaymentMethod(ctx context.Context, id string) error {
	return s.repo.DeletePaymentMethod(ctx, id)
}

// ==================== ADVERTISER AUTH & PROFILE ====================

func (s *marketplaceService) RegisterAdvertiser(ctx context.Context, req dto.AdvertiserRegisterRequest) (*dto.AdvertiserAuthResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	existing, err := s.repo.FindAdvertiserByEmail(ctx, email)
	if err != nil && !errors.Is(err, apperror.ErrNotFound) {
		return nil, err
	}
	if existing != nil {
		return nil, apperror.New(apperror.ErrAlreadyExists, "Alamat email sudah digunakan")
	}

	hash, err := utils.HashPassword(req.Password)
	if err != nil {
		return nil, apperror.ErrInternalServer
	}

	now := time.Now().UTC()
	adv := &model.Advertiser{
		Base:             model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		Email:            email,
		Phone:            strings.TrimSpace(req.Phone),
		PasswordHash:     hash,
		Name:             strings.TrimSpace(req.Name),
		CompanyName:      strings.TrimSpace(req.CompanyName),
		WalletBalanceIDR: 0,
		IsActive:         true,
		LastLoginAt:      &now,
	}
	if err := s.repo.CreateAdvertiser(ctx, adv); err != nil {
		return nil, err
	}

	token, err := utils.GenerateJWT(s.jwtSecret, s.jwtIssuer, adv.ID, adv.Email, middleware.RoleAdvertiser, s.jwtTTL)
	if err != nil {
		return nil, apperror.ErrInternalServer
	}

	return &dto.AdvertiserAuthResponse{
		Token:      token,
		ExpiresAt:  now.Add(s.jwtTTL),
		Advertiser: toAdvertiserProfileDTO(adv),
	}, nil
}

func (s *marketplaceService) LoginAdvertiser(ctx context.Context, req dto.AdvertiserLoginRequest) (*dto.AdvertiserAuthResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	adv, err := s.repo.FindAdvertiserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, apperror.ErrNotFound) {
			return nil, apperror.New(apperror.ErrUnauthorized, "Email atau kata sandi salah")
		}
		return nil, err
	}
	if !adv.IsActive {
		return nil, apperror.New(apperror.ErrForbidden, "Akun pengiklan sedang dinonaktifkan")
	}
	if !utils.CheckPasswordHash(req.Password, adv.PasswordHash) {
		return nil, apperror.New(apperror.ErrUnauthorized, "Email atau kata sandi salah")
	}

	now := time.Now().UTC()
	_ = s.repo.TouchAdvertiserLogin(ctx, adv.ID, now)
	adv.LastLoginAt = &now

	token, err := utils.GenerateJWT(s.jwtSecret, s.jwtIssuer, adv.ID, adv.Email, middleware.RoleAdvertiser, s.jwtTTL)
	if err != nil {
		return nil, apperror.ErrInternalServer
	}

	return &dto.AdvertiserAuthResponse{
		Token:      token,
		ExpiresAt:  now.Add(s.jwtTTL),
		Advertiser: toAdvertiserProfileDTO(adv),
	}, nil
}

func (s *marketplaceService) GetAdvertiserProfile(ctx context.Context, advertiserID string) (*dto.AdvertiserProfileResponse, error) {
	adv, err := s.repo.FindAdvertiserByID(ctx, advertiserID)
	if err != nil {
		return nil, err
	}
	res := toAdvertiserProfileDTO(adv)
	return &res, nil
}

func (s *marketplaceService) UpdateAdvertiserProfile(ctx context.Context, advertiserID string, req dto.UpdateAdvertiserProfileRequest) (*dto.AdvertiserProfileResponse, error) {
	adv, err := s.repo.FindAdvertiserByID(ctx, advertiserID)
	if err != nil {
		return nil, err
	}
	adv.Name = strings.TrimSpace(req.Name)
	adv.CompanyName = strings.TrimSpace(req.CompanyName)
	adv.Phone = strings.TrimSpace(req.Phone)
	adv.UpdatedAt = time.Now().UTC()
	if err := s.repo.UpdateAdvertiser(ctx, adv); err != nil {
		return nil, err
	}
	res := toAdvertiserProfileDTO(adv)
	return &res, nil
}

func (s *marketplaceService) ChangeAdvertiserPassword(ctx context.Context, advertiserID string, req dto.ChangeAdvertiserPasswordRequest) error {
	adv, err := s.repo.FindAdvertiserByID(ctx, advertiserID)
	if err != nil {
		return err
	}
	if !utils.CheckPasswordHash(req.CurrentPassword, adv.PasswordHash) {
		return apperror.New(apperror.ErrBadRequest, "Kata sandi lama tidak sesuai")
	}
	hash, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		return apperror.ErrInternalServer
	}
	adv.PasswordHash = hash
	adv.UpdatedAt = time.Now().UTC()
	return s.repo.UpdateAdvertiser(ctx, adv)
}

// ==================== MARKETPLACE MAP ROUTERS ====================

func (s *marketplaceService) ListMarketplaceRouters(ctx context.Context) ([]dto.MarketplaceRouterPoint, error) {
	routers, err := s.routers.ListActive(ctx)
	if err != nil {
		return nil, err
	}
	setting, err := s.repo.GetPlatformSetting(ctx)
	if err != nil {
		return nil, err
	}
	tiers, err := s.repo.ListLocationTiers(ctx, false)
	if err != nil {
		return nil, err
	}

	partnerMap := make(map[string]model.Partner)
	trafficMap := make(map[string]repository.RouterTrafficStat)
	if s.partners != nil {
		if allP, pErr := s.partners.ListAllPartners(ctx); pErr == nil {
			for _, p := range allP {
				partnerMap[p.ID] = p
			}
		}
		trafficMap, _ = s.partners.GetRouterTraffic7d(ctx, time.Now().UTC().AddDate(0, 0, -7))
	}
	visitorCounts7d, _ := s.repo.CountVisitorsByRouterSince(ctx, time.Now().UTC().AddDate(0, 0, -7))

	activeByNAS := make(map[string]int64)
	seenByNAS := make(map[string]bool)
	if s.accounts != nil {
		if sessions, _, sErr := s.accounts.ListSessions(ctx, repository.SessionFilter{Page: 1, PerPage: 300, Order: "desc"}); sErr == nil {
			for _, sess := range sessions {
				k := strings.ToLower(strings.TrimSpace(sess.NASIdentifier))
				if k == "" {
					continue
				}
				seenByNAS[k] = true
				if sess.Status == model.AccountingSessionStatusActive {
					activeByNAS[k]++
				}
			}
		}
	}

	out := make([]dto.MarketplaceRouterPoint, 0, len(routers))
	for _, r := range routers {
		if !r.IsPublicMarketplace {
			continue
		}

		tr := trafficMap[r.ID]
		avgConn := computeAvg7d(tr.TotalConnects7d)
		avgImp := computeAvg7d(tr.TotalImpressions7d)
		if avgConn == 0 && visitorCounts7d[r.ID] > 0 {
			avgConn = computeAvg7d(visitorCounts7d[r.ID])
		}

		tierID, tierName, multiplier := ResolveEffectiveRouterTier(&r, tiers, avgConn, avgImp)
		displayName, address, venueCat, lat, lng, _ := ResolveRouterPartnerDisplay(&r, partnerMap)

		priceImg := int64(math.Round(float64(setting.BasePriceImageIDR) * multiplier))
		priceVid := int64(math.Round(float64(setting.BasePriceVideoIDR) * multiplier))
		if priceImg < 1 {
			priceImg = 1
		}
		if priceVid < 1 {
			priceVid = 1
		}

		nasKey := strings.ToLower(strings.TrimSpace(r.NASIdentifier))

		out = append(out, dto.MarketplaceRouterPoint{
			ID:                  r.ID,
			Name:                displayName,
			LocationAddress:     address,
			VenueCategory:       venueCat,
			Latitude:            lat,
			Longitude:           lng,
			TierID:              tierID,
			TierName:            tierName,
			Multiplier:          multiplier,
			PriceImageIDR:       priceImg,
			PriceVideoIDR:       priceVid,
			AvgDailyVisitors:    avgConn,
			ActiveSessionsCount: activeByNAS[nasKey],
			IsConnected:         seenByNAS[nasKey],
		})
	}
	return out, nil
}

// ==================== CAMPAIGNS ====================

type validatedCampaignFields struct {
	setting        *model.PlatformAdSetting
	startDate      *time.Time
	endDate        *time.Time
	startHour      int
	endHour        int
	activeDays     string
	targetURL      string
	imageURL       string
	cleanRouterIDs []string
}

func normalizeAdMediaURL(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if idx := strings.Index(trimmed, ".r2.dev/ads/"); idx != -1 {
		key := trimmed[idx+len(".r2.dev/"):]
		return "/uploads/" + strings.TrimPrefix(key, "/")
	}
	return trimmed
}

func (s *marketplaceService) validateCampaignInput(ctx context.Context, req dto.CreateCampaignRequest) (*validatedCampaignFields, error) {
	setting, err := s.repo.GetPlatformSetting(ctx)
	if err != nil {
		return nil, err
	}
	if req.DurationSeconds > setting.MaxAdDurationSeconds {
		return nil, apperror.New(apperror.ErrBadRequest, fmt.Sprintf("Durasi iklan melebihi batas maksimal %d detik", setting.MaxAdDurationSeconds))
	}

	startHour := req.StartHour
	endHour := req.EndHour
	if endHour == 0 {
		endHour = 24
	}
	if startHour < 0 || startHour > 23 || endHour < 1 || endHour > 24 || startHour >= endHour {
		return nil, apperror.New(apperror.ErrBadRequest, "Rentang jam tayang tidak valid")
	}

	targetURL := strings.TrimSpace(req.TargetURL)
	if targetURL != "" {
		parsed, pErr := url.Parse(targetURL)
		if pErr != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
			return nil, apperror.New(apperror.ErrBadRequest, "Link promo harus diawali http:// atau https://")
		}
	}

	var startDate, endDate *time.Time
	if sd := strings.TrimSpace(req.StartDate); sd != "" {
		t, tErr := time.Parse("2006-01-02", sd)
		if tErr != nil {
			return nil, apperror.New(apperror.ErrBadRequest, "Format tanggal mulai harus YYYY-MM-DD")
		}
		startDate = &t
	}
	if ed := strings.TrimSpace(req.EndDate); ed != "" {
		t, tErr := time.Parse("2006-01-02", ed)
		if tErr != nil {
			return nil, apperror.New(apperror.ErrBadRequest, "Format tanggal berakhir harus YYYY-MM-DD")
		}
		endDate = &t
	}
	if startDate != nil && endDate != nil && endDate.Before(*startDate) {
		return nil, apperror.New(apperror.ErrBadRequest, "Tanggal berakhir tidak boleh sebelum tanggal mulai")
	}

	activeRouters, err := s.routers.ListActive(ctx)
	if err != nil {
		return nil, err
	}
	validRouterSet := make(map[string]bool, len(activeRouters))
	for _, r := range activeRouters {
		validRouterSet[r.ID] = true
	}
	cleanRouterIDs := make([]string, 0, len(req.RouterIDs))
	seen := make(map[string]bool, len(req.RouterIDs))
	for _, rid := range req.RouterIDs {
		rid = strings.TrimSpace(rid)
		if validRouterSet[rid] && !seen[rid] {
			seen[rid] = true
			cleanRouterIDs = append(cleanRouterIDs, rid)
		}
	}
	if len(cleanRouterIDs) == 0 {
		return nil, apperror.New(apperror.ErrBadRequest, "Pilih minimal satu lokasi router yang aktif")
	}

	activeDays := strings.TrimSpace(req.ActiveDays)
	if activeDays == "" {
		activeDays = "1,2,3,4,5,6,7"
	}

	return &validatedCampaignFields{
		setting:        setting,
		startDate:      startDate,
		endDate:        endDate,
		startHour:      startHour,
		endHour:        endHour,
		activeDays:     activeDays,
		targetURL:      targetURL,
		imageURL:       normalizeAdMediaURL(req.ImageURL),
		cleanRouterIDs: cleanRouterIDs,
	}, nil
}

func (s *marketplaceService) CreateCampaign(ctx context.Context, advertiserID string, req dto.CreateCampaignRequest) (*dto.CampaignResponse, error) {
	v, err := s.validateCampaignInput(ctx, req)
	if err != nil {
		return nil, err
	}

	initialStatus := model.AdStatusActive
	if v.setting.RequireAdApproval {
		initialStatus = model.AdStatusPendingReview
	}

	now := time.Now().UTC()
	advID := advertiserID
	ad := &model.Advertisement{
		Base:            model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		AdvertiserID:    &advID,
		Title:           strings.TrimSpace(req.Title),
		Body:            strings.TrimSpace(req.Body),
		ImageURL:        v.imageURL,
		TargetURL:       v.targetURL,
		MediaType:       strings.ToLower(strings.TrimSpace(req.MediaType)),
		LayoutMode:      strings.ToLower(strings.TrimSpace(req.LayoutMode)),
		DurationSeconds: req.DurationSeconds,
		Status:          initialStatus,
		IsActive:        true,
		StartDate:       v.startDate,
		EndDate:         v.endDate,
		StartHour:       v.startHour,
		EndHour:         v.endHour,
		ActiveDays:      v.activeDays,
		DailyBudgetIDR:  req.DailyBudgetIDR,
		TotalBudgetIDR:  req.TotalBudgetIDR,
	}

	if err := s.repo.CreateCampaignWithRouters(ctx, ad, v.cleanRouterIDs); err != nil {
		return nil, err
	}

	return s.GetAdvertiserCampaign(ctx, advertiserID, ad.ID)
}

func (s *marketplaceService) UpdateCampaign(ctx context.Context, advertiserID, campaignID string, req dto.UpdateCampaignRequest) (*dto.CampaignResponse, error) {
	ad, err := s.repo.FindCampaignByID(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	if ad.AdvertiserID == nil || *ad.AdvertiserID != advertiserID {
		return nil, apperror.ErrForbidden
	}

	v, err := s.validateCampaignInput(ctx, dto.CreateCampaignRequest(req))
	if err != nil {
		return nil, err
	}

	newTitle := strings.TrimSpace(req.Title)
	newBody := strings.TrimSpace(req.Body)
	newMediaType := strings.ToLower(strings.TrimSpace(req.MediaType))
	newLayoutMode := strings.ToLower(strings.TrimSpace(req.LayoutMode))

	creativeChanged := ad.Title != newTitle ||
		ad.Body != newBody ||
		normalizeAdMediaURL(ad.ImageURL) != v.imageURL ||
		ad.TargetURL != v.targetURL ||
		!strings.EqualFold(ad.MediaType, newMediaType)

	if ad.Status == model.AdStatusRejected {
		if v.setting.RequireAdApproval {
			ad.Status = model.AdStatusPendingReview
		} else {
			ad.Status = model.AdStatusActive
		}
		ad.RejectionReason = ""
	} else if creativeChanged && v.setting.RequireAdApproval {
		ad.Status = model.AdStatusPendingReview
		ad.RejectionReason = ""
	} else if ad.Status == model.AdStatusCompleted && (req.TotalBudgetIDR == 0 || req.TotalBudgetIDR > ad.SpentAmountIDR) {
		ad.Status = model.AdStatusActive
	}

	ad.Title = newTitle
	ad.Body = newBody
	ad.ImageURL = v.imageURL
	ad.TargetURL = v.targetURL
	ad.MediaType = newMediaType
	ad.LayoutMode = newLayoutMode
	ad.DurationSeconds = req.DurationSeconds
	ad.StartDate = v.startDate
	ad.EndDate = v.endDate
	ad.StartHour = v.startHour
	ad.EndHour = v.endHour
	ad.ActiveDays = v.activeDays
	ad.DailyBudgetIDR = req.DailyBudgetIDR
	ad.TotalBudgetIDR = req.TotalBudgetIDR
	ad.UpdatedAt = time.Now().UTC()

	if err := s.repo.UpdateCampaignWithRouters(ctx, ad, v.cleanRouterIDs); err != nil {
		return nil, err
	}

	return s.GetAdvertiserCampaign(ctx, advertiserID, ad.ID)
}

func (s *marketplaceService) ListAdvertiserCampaigns(ctx context.Context, advertiserID string, query dto.CampaignListQuery) ([]dto.CampaignResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	items, total, err := s.repo.ListCampaigns(ctx, repository.CampaignFilter{
		Page:         page,
		PerPage:      perPage,
		AdvertiserID: advertiserID,
		Status:       query.Status,
		Search:       query.Search,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}
	res, err := s.enrichCampaignResponses(ctx, items)
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}
	meta := dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}
	return res, meta, nil
}

func (s *marketplaceService) GetAdvertiserCampaign(ctx context.Context, advertiserID, campaignID string) (*dto.CampaignResponse, error) {
	ad, err := s.repo.FindCampaignByID(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	if ad.AdvertiserID == nil || *ad.AdvertiserID != advertiserID {
		return nil, apperror.ErrForbidden
	}
	list, err := s.enrichCampaignResponses(ctx, []model.Advertisement{*ad})
	if err != nil || len(list) == 0 {
		return nil, err
	}
	return &list[0], nil
}

func (s *marketplaceService) ToggleAdvertiserCampaignStatus(ctx context.Context, advertiserID, campaignID string, req dto.UpdateCampaignStatusRequest) (*dto.CampaignResponse, error) {
	ad, err := s.repo.FindCampaignByID(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	if ad.AdvertiserID == nil || *ad.AdvertiserID != advertiserID {
		return nil, apperror.ErrForbidden
	}
	switch req.Action {
	case "PAUSE":
		if ad.Status != model.AdStatusActive {
			return nil, apperror.New(apperror.ErrBadRequest, "Hanya iklan berstatus Aktif yang dapat dijeda")
		}
		ad.Status = model.AdStatusPaused
	case "RESUME":
		if ad.Status != model.AdStatusPaused {
			return nil, apperror.New(apperror.ErrBadRequest, "Hanya iklan yang sedang dijeda yang dapat dilanjutkan")
		}
		ad.Status = model.AdStatusActive
	}
	ad.UpdatedAt = time.Now().UTC()
	if err := s.repo.UpdateCampaign(ctx, ad); err != nil {
		return nil, err
	}
	return s.GetAdvertiserCampaign(ctx, advertiserID, ad.ID)
}

func (s *marketplaceService) DeleteAdvertiserCampaign(ctx context.Context, advertiserID, campaignID string) error {
	return s.repo.DeleteCampaign(ctx, campaignID, advertiserID)
}

// ==================== WALLET & TOP-UP ====================

func (s *marketplaceService) CreateTopupInvoice(ctx context.Context, advertiserID string, req dto.CreateTopupRequest) (*dto.TopupInvoiceResponse, error) {
	setting, err := s.repo.GetPlatformSetting(ctx)
	if err != nil {
		return nil, err
	}
	if req.AmountIDR < setting.MinTopupAmountIDR {
		return nil, apperror.New(apperror.ErrBadRequest, fmt.Sprintf("Nominal minimal Top-Up adalah Rp %d", setting.MinTopupAmountIDR))
	}
	pm, err := s.repo.FindPaymentMethodByID(ctx, req.PaymentMethodID)
	if err != nil || !pm.IsActive {
		return nil, apperror.New(apperror.ErrBadRequest, "Metode pembayaran tidak tersedia")
	}

	now := time.Now().UTC()
	invNum := generateInvoiceNumber(now)
	status := model.TopupStatusPendingProof
	if strings.TrimSpace(req.ProofImageURL) != "" {
		status = model.TopupStatusWaitingVerification
	}

	pmID := pm.ID
	inv := &model.TopupInvoice{
		Base:                model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		InvoiceNumber:       invNum,
		AdvertiserID:        advertiserID,
		PaymentMethodID:     &pmID,
		PaymentChannel:      model.TopupChannelManual,
		PaymentProviderName: pm.ProviderName,
		AmountIDR:           req.AmountIDR,
		ProofImageURL:       strings.TrimSpace(req.ProofImageURL),
		SenderName:          strings.TrimSpace(req.SenderName),
		Status:              status,
	}
	if err := s.repo.CreateTopupInvoice(ctx, inv); err != nil {
		return nil, err
	}
	res := toTopupInvoiceDTO(inv, nil)
	return &res, nil
}

func (s *marketplaceService) SubmitTopupProof(ctx context.Context, advertiserID, invoiceID string, req dto.SubmitTopupProofRequest) (*dto.TopupInvoiceResponse, error) {
	inv, err := s.repo.FindTopupByID(ctx, invoiceID)
	if err != nil {
		return nil, err
	}
	if inv.AdvertiserID != advertiserID {
		return nil, apperror.ErrForbidden
	}
	if inv.Status == model.TopupStatusPaid {
		return nil, apperror.New(apperror.ErrConflict, "Tagihan ini sudah lunas")
	}
	inv.SenderName = strings.TrimSpace(req.SenderName)
	inv.ProofImageURL = strings.TrimSpace(req.ProofImageURL)
	inv.Status = model.TopupStatusWaitingVerification
	inv.UpdatedAt = time.Now().UTC()
	if err := s.repo.UpdateTopupInvoice(ctx, inv); err != nil {
		return nil, err
	}
	res := toTopupInvoiceDTO(inv, nil)
	return &res, nil
}

func (s *marketplaceService) ListAdvertiserTopups(ctx context.Context, advertiserID string, query dto.TopupListQuery) ([]dto.TopupInvoiceResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	items, total, err := s.repo.ListTopupInvoices(ctx, repository.TopupFilter{
		Page:         page,
		PerPage:      perPage,
		AdvertiserID: advertiserID,
		Status:       query.Status,
		Search:       query.Search,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}
	out := make([]dto.TopupInvoiceResponse, 0, len(items))
	for _, item := range items {
		out = append(out, toTopupInvoiceDTO(&item, nil))
	}
	meta := dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}
	return out, meta, nil
}

func (s *marketplaceService) ListAdvertiserWalletTransactions(ctx context.Context, advertiserID string, query dto.WalletTransactionListQuery) ([]dto.WalletTransactionResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	items, total, err := s.repo.ListWalletTransactions(ctx, repository.WalletTxFilter{
		Page:         page,
		PerPage:      perPage,
		AdvertiserID: advertiserID,
		Type:         query.Type,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}
	out := make([]dto.WalletTransactionResponse, 0, len(items))
	for _, tx := range items {
		out = append(out, dto.WalletTransactionResponse{
			ID:              tx.ID,
			Type:            tx.Type,
			AmountIDR:       tx.AmountIDR,
			BalanceAfterIDR: tx.BalanceAfterIDR,
			ReferenceType:   tx.ReferenceType,
			ReferenceID:     tx.ReferenceID,
			Description:     tx.Description,
			CreatedAt:       tx.CreatedAt,
		})
	}
	meta := dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}
	return out, meta, nil
}

// ==================== OVERVIEW & ANALYTICS ====================

func (s *marketplaceService) GetAdvertiserOverview(ctx context.Context, advertiserID string) (*dto.AdvertiserOverviewResponse, error) {
	adv, err := s.repo.FindAdvertiserByID(ctx, advertiserID)
	if err != nil {
		return nil, err
	}
	activeCount, pendingCount, err := s.repo.CountCampaignsByAdvertiser(ctx, advertiserID)
	if err != nil {
		return nil, err
	}

	loc, locErr := time.LoadLocation("Asia/Jakarta")
	if locErr != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	nowLocal := time.Now().In(loc)
	startOfDay := time.Date(nowLocal.Year(), nowLocal.Month(), nowLocal.Day(), 0, 0, 0, 0, loc)
	since30d := startOfDay.AddDate(0, 0, -29).UTC()

	impressions, err := s.repo.ListImpressionsSince(ctx, advertiserID, "", "", since30d)
	if err != nil {
		return nil, err
	}

	// Totals across all advertiser campaigns
	campaigns, _, _ := s.repo.ListCampaigns(ctx, repository.CampaignFilter{Page: 1, PerPage: 100, AdvertiserID: advertiserID})
	var totalImp, totalClicks, totalSpent int64
	for _, c := range campaigns {
		totalImp += c.ImpressionsCount
		totalClicks += c.ClicksCount
		totalSpent += c.SpentAmountIDR
	}

	trendToday := buildTodayBuckets(impressions, startOfDay, loc)
	trend7d := build7dBuckets(impressions, startOfDay, loc)
	trend30d := build30dBuckets(impressions, startOfDay, loc)

	return &dto.AdvertiserOverviewResponse{
		WalletBalanceIDR:      adv.WalletBalanceIDR,
		ActiveCampaignsCount:  activeCount,
		PendingCampaignsCount: pendingCount,
		TotalImpressions:      totalImp,
		TotalClicks:           totalClicks,
		TotalSpentIDR:         totalSpent,
		TrendToday:            trendToday,
		Trend7d:               trend7d,
		Trend30d:              trend30d,
	}, nil
}

func (s *marketplaceService) GetAdvertiserAnalytics(ctx context.Context, advertiserID string, query dto.AnalyticsQuery) (*dto.AdvertiserAnalyticsResponse, error) {
	loc, locErr := time.LoadLocation("Asia/Jakarta")
	if locErr != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	nowLocal := time.Now().In(loc)
	startOfDay := time.Date(nowLocal.Year(), nowLocal.Month(), nowLocal.Day(), 0, 0, 0, 0, loc)

	var since time.Time
	switch query.Range {
	case "today":
		since = startOfDay.UTC()
	case "30d":
		since = startOfDay.AddDate(0, 0, -29).UTC()
	default:
		since = startOfDay.AddDate(0, 0, -6).UTC()
	}

	impressions, err := s.repo.ListImpressionsSince(ctx, advertiserID, query.CampaignID, query.RouterID, since)
	if err != nil {
		return nil, err
	}

	var series []dto.AdvertiserChartPoint
	switch query.Range {
	case "today":
		series = buildTodayBuckets(impressions, startOfDay, loc)
	case "30d":
		series = build30dBuckets(impressions, startOfDay, loc)
	default:
		series = build7dBuckets(impressions, startOfDay, loc)
	}

	routers, _ := s.routers.ListActive(ctx)
	routerMap := make(map[string]model.Router, len(routers))
	for _, r := range routers {
		routerMap[r.ID] = r
	}

	type rAgg struct {
		imp    int64
		clicks int64
		spent  int64
	}
	byRouterAgg := make(map[string]*rAgg)
	var totalImp, totalClicks, totalSpent int64
	for _, imp := range impressions {
		totalImp++
		totalSpent += imp.CostChargedIDR
		if imp.ClickedAt != nil {
			totalClicks++
		}
		agg, ok := byRouterAgg[imp.RouterID]
		if !ok {
			agg = &rAgg{}
			byRouterAgg[imp.RouterID] = agg
		}
		agg.imp++
		agg.spent += imp.CostChargedIDR
		if imp.ClickedAt != nil {
			agg.clicks++
		}
	}

	partnerMap := make(map[string]model.Partner)
	if s.partners != nil {
		if allP, pErr := s.partners.ListAllPartners(ctx); pErr == nil {
			for _, p := range allP {
				partnerMap[p.ID] = p
			}
		}
	}

	byRouter := make([]dto.RouterAnalyticsBreakdown, 0, len(byRouterAgg))
	for rid, agg := range byRouterAgg {
		rm := routerMap[rid]
		displayName, address, venueCat, _, _, _ := ResolveRouterPartnerDisplay(&rm, partnerMap)
		if displayName == "" {
			displayName = "Lokasi Wi-Fi"
		}
		ctr := 0.0
		if agg.imp > 0 {
			ctr = math.Round((float64(agg.clicks)*100.0/float64(agg.imp))*10) / 10
		}
		byRouter = append(byRouter, dto.RouterAnalyticsBreakdown{
			RouterID:        rid,
			RouterName:      displayName,
			VenueCategory:   venueCat,
			LocationAddress: address,
			Impressions:     agg.imp,
			Clicks:          agg.clicks,
			CTRPercent:      ctr,
			SpentIDR:        agg.spent,
		})
	}

	totalCTR := 0.0
	if totalImp > 0 {
		totalCTR = math.Round((float64(totalClicks)*100.0/float64(totalImp))*10) / 10
	}

	return &dto.AdvertiserAnalyticsResponse{
		TotalImpressions: totalImp,
		TotalClicks:      totalClicks,
		CTRPercent:       totalCTR,
		TotalSpentIDR:    totalSpent,
		Series:           series,
		ByRouter:         byRouter,
	}, nil
}

// ==================== ADMIN MODERATION & VERIFICATION ====================

func (s *marketplaceService) AdminListAdvertisers(ctx context.Context, query dto.AdminAdvertiserListQuery) ([]dto.AdvertiserProfileResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	items, total, err := s.repo.ListAdvertisers(ctx, page, perPage, query.Search)
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}

	advIDs := make([]string, 0, len(items))
	for _, adv := range items {
		advIDs = append(advIDs, adv.ID)
	}
	var summaries map[string]repository.AdvertiserSummaryAgg
	if s.partners != nil {
		summaries, _ = s.partners.GetAdvertiserSummaries(ctx, advIDs)
	}

	out := make([]dto.AdvertiserProfileResponse, 0, len(items))
	for _, adv := range items {
		row := toAdvertiserProfileDTO(&adv)
		if summaries != nil {
			agg := summaries[adv.ID]
			row.ActiveCampaignsCount = agg.ActiveCampaigns
			row.TotalCampaignsCount = agg.TotalCampaigns
			row.TotalTopupIDR = agg.TotalTopupIDR
			row.TotalSpentIDR = agg.TotalSpentIDR
		}
		out = append(out, row)
	}
	meta := dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}
	return out, meta, nil
}

func (s *marketplaceService) AdminToggleAdvertiserStatus(ctx context.Context, advertiserID string, req dto.AdminToggleStatusRequest) (*dto.AdvertiserProfileResponse, error) {
	adv, err := s.repo.FindAdvertiserByID(ctx, advertiserID)
	if err != nil {
		return nil, err
	}
	adv.IsActive = req.IsActive
	adv.UpdatedAt = time.Now().UTC()
	if err := s.repo.UpdateAdvertiser(ctx, adv); err != nil {
		return nil, err
	}
	res := toAdvertiserProfileDTO(adv)
	return &res, nil
}

func (s *marketplaceService) AdminAdjustAdvertiserBalance(ctx context.Context, advertiserID string, req dto.AdminAdjustBalanceRequest) (*dto.AdvertiserProfileResponse, error) {
	if req.AmountIDR == 0 {
		return nil, apperror.New(apperror.ErrBadRequest, "Nominal penyesuaian tidak boleh 0")
	}
	adv, err := s.repo.AdminAdjustBalance(ctx, advertiserID, req.AmountIDR, req.Description, time.Now().UTC())
	if err != nil {
		return nil, err
	}
	res := toAdvertiserProfileDTO(adv)
	return &res, nil
}

func (s *marketplaceService) AdminListCampaigns(ctx context.Context, query dto.CampaignListQuery) ([]dto.CampaignResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	items, total, err := s.repo.ListCampaigns(ctx, repository.CampaignFilter{
		Page:         page,
		PerPage:      perPage,
		AdvertiserID: query.AdvertiserID,
		OnlyPaid:     query.AdvertiserID == "",
		Status:       query.Status,
		Search:       query.Search,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}
	res, err := s.enrichCampaignResponses(ctx, items)
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}
	meta := dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}
	return res, meta, nil
}

func (s *marketplaceService) AdminModerateCampaign(ctx context.Context, campaignID string, req dto.AdminModerateCampaignRequest) (*dto.CampaignResponse, error) {
	ad, err := s.repo.FindCampaignByID(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	switch req.Action {
	case "APPROVE":
		ad.Status = model.AdStatusActive
		ad.IsActive = true
		ad.RejectionReason = ""
	case "REJECT":
		ad.Status = model.AdStatusRejected
		reason := strings.TrimSpace(req.RejectionReason)
		if reason == "" {
			reason = "Materi iklan belum memenuhi ketentuan penayangan."
		}
		ad.RejectionReason = reason
	case "PAUSE":
		ad.Status = model.AdStatusPaused
	}
	ad.UpdatedAt = time.Now().UTC()
	if err := s.repo.UpdateCampaign(ctx, ad); err != nil {
		return nil, err
	}
	list, err := s.enrichCampaignResponses(ctx, []model.Advertisement{*ad})
	if err != nil || len(list) == 0 {
		return nil, err
	}
	return &list[0], nil
}

func (s *marketplaceService) AdminListTopups(ctx context.Context, query dto.TopupListQuery) ([]dto.TopupInvoiceResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	items, total, err := s.repo.ListTopupInvoices(ctx, repository.TopupFilter{
		Page:         page,
		PerPage:      perPage,
		AdvertiserID: query.AdvertiserID,
		Status:       query.Status,
		Search:       query.Search,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}
	advIDs := make([]string, 0, len(items))
	for _, inv := range items {
		advIDs = append(advIDs, inv.AdvertiserID)
	}
	advMap, _ := s.repo.FindAdvertisersByIDs(ctx, advIDs)

	out := make([]dto.TopupInvoiceResponse, 0, len(items))
	for _, inv := range items {
		var advPtr *model.Advertiser
		if a, ok := advMap[inv.AdvertiserID]; ok {
			advCopy := a
			advPtr = &advCopy
		}
		out = append(out, toTopupInvoiceDTO(&inv, advPtr))
	}
	meta := dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}
	return out, meta, nil
}

func (s *marketplaceService) AdminVerifyTopup(ctx context.Context, adminID, invoiceID string, req dto.AdminVerifyTopupRequest) (*dto.TopupInvoiceResponse, error) {
	approve := req.Action == "APPROVE"
	inv, err := s.repo.VerifyTopupInvoice(ctx, invoiceID, adminID, approve, req.AdminNote, time.Now().UTC())
	if err != nil {
		return nil, err
	}
	adv, _ := s.repo.FindAdvertiserByID(ctx, inv.AdvertiserID)
	res := toTopupInvoiceDTO(inv, adv)
	return &res, nil
}

// ==================== INTERNAL MAPPERS & HELPERS ====================

func (s *marketplaceService) enrichCampaignResponses(ctx context.Context, ads []model.Advertisement) ([]dto.CampaignResponse, error) {
	if len(ads) == 0 {
		return []dto.CampaignResponse{}, nil
	}
	setting, err := s.repo.GetPlatformSetting(ctx)
	if err != nil {
		return nil, err
	}
	tiers, _ := s.repo.ListLocationTiers(ctx, false)
	routers, _ := s.routers.ListActive(ctx)
	routerMap := make(map[string]model.Router, len(routers))
	for _, r := range routers {
		routerMap[r.ID] = r
	}

	partnerMap := make(map[string]model.Partner)
	trafficMap := make(map[string]repository.RouterTrafficStat)
	if s.partners != nil {
		if allP, pErr := s.partners.ListAllPartners(ctx); pErr == nil {
			for _, p := range allP {
				partnerMap[p.ID] = p
			}
		}
		trafficMap, _ = s.partners.GetRouterTraffic7d(ctx, time.Now().UTC().AddDate(0, 0, -7))
	}

	adIDs := make([]string, 0, len(ads))
	advIDs := make([]string, 0, len(ads))
	for _, a := range ads {
		adIDs = append(adIDs, a.ID)
		if a.AdvertiserID != nil {
			advIDs = append(advIDs, *a.AdvertiserID)
		}
	}

	targetRouterMap, _ := s.repo.GetTargetRouterIDsByAdIDs(ctx, adIDs)
	advMap, _ := s.repo.FindAdvertisersByIDs(ctx, advIDs)

	loc, locErr := time.LoadLocation("Asia/Jakarta")
	if locErr != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	nowLocal := time.Now().In(loc)
	startOfDay := time.Date(nowLocal.Year(), nowLocal.Month(), nowLocal.Day(), 0, 0, 0, 0, loc)
	dailySpentMap, _ := s.repo.DailySpentByAdIDs(ctx, adIDs, startOfDay.UTC())

	out := make([]dto.CampaignResponse, 0, len(ads))
	for _, a := range ads {
		advID := ""
		advName := ""
		advCompany := ""
		if a.AdvertiserID != nil {
			advID = *a.AdvertiserID
			if adv, ok := advMap[advID]; ok {
				advName = adv.Name
				advCompany = adv.CompanyName
			}
		}

		basePrice := setting.BasePriceImageIDR
		if strings.EqualFold(a.MediaType, "video") {
			basePrice = setting.BasePriceVideoIDR
		}

		rids := targetRouterMap[a.ID]
		rSummaries := make([]dto.CampaignRouterSummary, 0, len(rids))
		for _, rid := range rids {
			rm, ok := routerMap[rid]
			if !ok {
				continue
			}
			tr := trafficMap[rm.ID]
			_, tName, mult := ResolveEffectiveRouterTier(&rm, tiers, computeAvg7d(tr.TotalConnects7d), computeAvg7d(tr.TotalImpressions7d))
			displayName, address, venueCat, lat, lng, _ := ResolveRouterPartnerDisplay(&rm, partnerMap)
			unitPrice := int64(math.Round(float64(basePrice) * mult))
			if unitPrice < 1 {
				unitPrice = 1
			}
			rSummaries = append(rSummaries, dto.CampaignRouterSummary{
				RouterID:        rm.ID,
				RouterName:      displayName,
				LocationAddress: address,
				VenueCategory:   venueCat,
				Latitude:        lat,
				Longitude:       lng,
				TierName:        tName,
				Multiplier:      mult,
				UnitPriceIDR:    unitPrice,
			})
		}

		out = append(out, dto.CampaignResponse{
			ID:                 a.ID,
			AdvertiserID:       advID,
			AdvertiserName:     advName,
			AdvertiserCompany:  advCompany,
			Title:              a.Title,
			Body:               a.Body,
			ImageURL:           normalizeAdMediaURL(a.ImageURL),
			TargetURL:          a.TargetURL,
			MediaType:          a.MediaType,
			LayoutMode:         a.LayoutMode,
			DurationSeconds:    a.DurationSeconds,
			Status:             a.Status,
			IsActive:           a.IsActive,
			RejectionReason:    a.RejectionReason,
			StartDate:          a.StartDate,
			EndDate:            a.EndDate,
			StartHour:          a.StartHour,
			EndHour:            a.EndHour,
			ActiveDays:         a.ActiveDays,
			DailyBudgetIDR:     a.DailyBudgetIDR,
			TotalBudgetIDR:     a.TotalBudgetIDR,
			SpentAmountIDR:     a.SpentAmountIDR,
			DailySpentTodayIDR: dailySpentMap[a.ID],
			ImpressionsCount:   a.ImpressionsCount,
			ClicksCount:        a.ClicksCount,
			TargetRouters:      rSummaries,
			CreatedAt:          a.CreatedAt,
			UpdatedAt:          a.UpdatedAt,
		})
	}
	return out, nil
}

func buildTodayBuckets(impressions []model.AdImpression, startOfDay time.Time, loc *time.Location) []dto.AdvertiserChartPoint {
	labels := []string{"00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"}
	buckets := make([]dto.AdvertiserChartPoint, 8)
	for i := 0; i < 8; i++ {
		buckets[i] = dto.AdvertiserChartPoint{Label: labels[i]}
	}
	for _, imp := range impressions {
		tLocal := imp.CreatedAt.In(loc)
		if !tLocal.Before(startOfDay) {
			idx := tLocal.Hour() / 3
			if idx >= 0 && idx < 8 {
				buckets[idx].Impressions++
				buckets[idx].SpentIDR += imp.CostChargedIDR
				if imp.ClickedAt != nil {
					buckets[idx].Clicks++
				}
			}
		}
	}
	return buckets
}

func build7dBuckets(impressions []model.AdImpression, startOfDay time.Time, loc *time.Location) []dto.AdvertiserChartPoint {
	buckets := make([]dto.AdvertiserChartPoint, 7)
	for i := 0; i < 7; i++ {
		d := startOfDay.AddDate(0, 0, -(6 - i))
		buckets[i] = dto.AdvertiserChartPoint{Label: d.Format("02 Jan")}
	}
	for _, imp := range impressions {
		tLocal := imp.CreatedAt.In(loc)
		dayStart := time.Date(tLocal.Year(), tLocal.Month(), tLocal.Day(), 0, 0, 0, 0, loc)
		diffDays := int(startOfDay.Sub(dayStart).Hours() / 24)
		if diffDays >= 0 && diffDays < 7 {
			idx := 6 - diffDays
			buckets[idx].Impressions++
			buckets[idx].SpentIDR += imp.CostChargedIDR
			if imp.ClickedAt != nil {
				buckets[idx].Clicks++
			}
		}
	}
	return buckets
}

func build30dBuckets(impressions []model.AdImpression, startOfDay time.Time, loc *time.Location) []dto.AdvertiserChartPoint {
	buckets := make([]dto.AdvertiserChartPoint, 6)
	for i := 0; i < 6; i++ {
		d := startOfDay.AddDate(0, 0, -((5 - i) * 5))
		buckets[i] = dto.AdvertiserChartPoint{Label: d.Format("02 Jan")}
	}
	for _, imp := range impressions {
		tLocal := imp.CreatedAt.In(loc)
		dayStart := time.Date(tLocal.Year(), tLocal.Month(), tLocal.Day(), 0, 0, 0, 0, loc)
		diffDays := int(startOfDay.Sub(dayStart).Hours() / 24)
		if diffDays >= 0 && diffDays < 30 {
			idx := 5 - (diffDays / 5)
			if idx >= 0 && idx < 6 {
				buckets[idx].Impressions++
				buckets[idx].SpentIDR += imp.CostChargedIDR
				if imp.ClickedAt != nil {
					buckets[idx].Clicks++
				}
			}
		}
	}
	return buckets
}

func generateInvoiceNumber(now time.Time) string {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	suffix := int64(100000)
	if err == nil {
		suffix += n.Int64()
	}
	return fmt.Sprintf("INV-%s-%d", now.Format("20060102"), suffix)
}

func toLocationTierDTO(t *model.LocationTier) dto.LocationTierResponse {
	return dto.LocationTierResponse{
		ID:                  t.ID,
		Name:                t.Name,
		Multiplier:          t.Multiplier,
		MinDailyConnects:    t.MinDailyConnects,
		MinDailyImpressions: t.MinDailyImpressions,
		Description:         t.Description,
		SortOrder:           t.SortOrder,
		IsActive:            t.IsActive,
		CreatedAt:           t.CreatedAt,
		UpdatedAt:           t.UpdatedAt,
	}
}

func toPaymentMethodDTO(pm *model.PaymentMethod) dto.PaymentMethodResponse {
	return dto.PaymentMethodResponse{
		ID:            pm.ID,
		Type:          pm.Type,
		ProviderName:  pm.ProviderName,
		AccountNumber: pm.AccountNumber,
		AccountHolder: pm.AccountHolder,
		QrisImageURL:  pm.QrisImageURL,
		Instructions:  pm.Instructions,
		SortOrder:     pm.SortOrder,
		IsActive:      pm.IsActive,
		CreatedAt:     pm.CreatedAt,
	}
}

func toAdvertiserProfileDTO(adv *model.Advertiser) dto.AdvertiserProfileResponse {
	return dto.AdvertiserProfileResponse{
		ID:               adv.ID,
		Name:             adv.Name,
		CompanyName:      adv.CompanyName,
		Email:            adv.Email,
		Phone:            adv.Phone,
		WalletBalanceIDR: adv.WalletBalanceIDR,
		IsActive:         adv.IsActive,
		LastLoginAt:      adv.LastLoginAt,
		CreatedAt:        adv.CreatedAt,
	}
}

func toTopupInvoiceDTO(inv *model.TopupInvoice, adv *model.Advertiser) dto.TopupInvoiceResponse {
	res := dto.TopupInvoiceResponse{
		ID:                  inv.ID,
		InvoiceNumber:       inv.InvoiceNumber,
		AdvertiserID:        inv.AdvertiserID,
		PaymentMethodID:     inv.PaymentMethodID,
		PaymentChannel:      inv.PaymentChannel,
		PaymentProviderName: inv.PaymentProviderName,
		AmountIDR:           inv.AmountIDR,
		ProofImageURL:       inv.ProofImageURL,
		SenderName:          inv.SenderName,
		Status:              inv.Status,
		AdminNote:           inv.AdminNote,
		VerifiedAt:          inv.VerifiedAt,
		CreatedAt:           inv.CreatedAt,
	}
	if adv != nil {
		res.AdvertiserName = adv.Name
		res.AdvertiserEmail = adv.Email
		res.AdvertiserCompany = adv.CompanyName
	}
	return res
}
