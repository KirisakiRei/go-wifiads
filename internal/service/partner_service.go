package service

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"math/big"
	"sort"
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

// ResolveEffectiveRouterTier determines a router's pricing tier & multiplier:
//   - If LocationTierAuto is false and LocationTierID is set, uses the locked manual tier.
//   - Otherwise evaluates 7-day rolling avgDailyConnects & avgDailyImpressions against active tiers.
func ResolveEffectiveRouterTier(
	r *model.Router,
	tiers []model.LocationTier,
	avgDailyConnects, avgDailyImpressions int64,
) (tierID, tierName string, multiplier float64) {
	if r == nil {
		return "", "Standard", 1.0
	}

	if !r.LocationTierAuto && r.LocationTierID != nil && *r.LocationTierID != "" {
		for _, t := range tiers {
			if t.ID == *r.LocationTierID {
				m := t.Multiplier
				if m <= 0 {
					m = 1.0
				}
				return t.ID, t.Name, m
			}
		}
	}

	active := make([]model.LocationTier, 0, len(tiers))
	for _, t := range tiers {
		if t.IsActive {
			active = append(active, t)
		}
	}
	if len(active) == 0 {
		return "", "Standard", 1.0
	}

	sort.Slice(active, func(i, j int) bool {
		if active[i].Multiplier != active[j].Multiplier {
			return active[i].Multiplier > active[j].Multiplier
		}
		return active[i].SortOrder > active[j].SortOrder
	})

	for _, t := range active {
		if avgDailyConnects >= t.MinDailyConnects && avgDailyImpressions >= t.MinDailyImpressions {
			m := t.Multiplier
			if m <= 0 {
				m = 1.0
			}
			return t.ID, t.Name, m
		}
	}

	lowest := active[len(active)-1]
	m := lowest.Multiplier
	if m <= 0 {
		m = 1.0
	}
	return lowest.ID, lowest.Name, m
}

// ResolveRouterPartnerDisplay returns the venue label, address, category, and coordinates
// inherited from the linked Partner (if any), falling back to the router's own fields.
func ResolveRouterPartnerDisplay(
	r *model.Router,
	partnerMap map[string]model.Partner,
) (displayName, address, category string, lat, lng *float64, partner *model.Partner) {
	if r == nil {
		return "Lokasi Wi-Fi", "", "Kafe", nil, nil, nil
	}
	displayName = r.Name
	address = r.LocationAddress
	category = r.VenueCategory
	if category == "" {
		category = "Kafe"
	}
	lat = r.Latitude
	lng = r.Longitude

	if r.PartnerID != nil && *r.PartnerID != "" && partnerMap != nil {
		if p, ok := partnerMap[*r.PartnerID]; ok {
			pCopy := p
			partner = &pCopy
			if v := strings.TrimSpace(p.VenueName); v != "" {
				displayName = v
			} else if n := strings.TrimSpace(p.Name); n != "" {
				displayName = n
			}
			if p.Latitude != nil && p.Longitude != nil {
				lat = p.Latitude
				lng = p.Longitude
			}
			if a := strings.TrimSpace(p.Address); a != "" {
				address = a
			}
			if c := strings.TrimSpace(p.VenueCategory); c != "" {
				category = c
			}
		}
	}
	return displayName, address, category, lat, lng, partner
}

func computeAvg7d(total7d int64) int64 {
	if total7d <= 0 {
		return 0
	}
	avg := int64(math.Round(float64(total7d) / 7.0))
	if avg == 0 {
		avg = 1
	}
	return avg
}

// PartnerService manages Admin Partner/Finance operations and Partner Portal self-service endpoints.
type PartnerService interface {
	// Admin Badges & Finance
	AdminGetBadges(ctx context.Context) (*dto.AdminSidebarBadgesResponse, error)
	AdminGetFinanceSummary(ctx context.Context, query dto.AdminFinanceQuery) (*dto.AdminFinanceSummaryResponse, error)
	AdminListGlobalWalletTransactions(ctx context.Context, query dto.WalletTransactionListQuery) ([]dto.WalletTransactionResponse, dto.PaginationMeta, error)

	// Admin Partner Invite, Settings & Withdrawals
	AdminListPartners(ctx context.Context, query dto.AdminPartnerListQuery) ([]dto.AdminPartnerResponse, dto.PaginationMeta, error)
	AdminGetPartner(ctx context.Context, id string) (*dto.AdminPartnerResponse, error)
	AdminCreatePartnerInvite(ctx context.Context, req dto.AdminCreatePartnerInviteRequest) (*dto.AdminPartnerResponse, error)
	AdminRegeneratePartnerInvite(ctx context.Context, id string) (*dto.AdminPartnerResponse, error)
	AdminUpdatePartnerSettings(ctx context.Context, id string, req dto.AdminUpdatePartnerSettingsRequest) (*dto.AdminPartnerResponse, error)
	AdminChangePartnerPassword(ctx context.Context, id string, req dto.AdminChangePartnerPasswordRequest) error
	AdminDeletePartner(ctx context.Context, id string) error
	AdminListWithdrawals(ctx context.Context, query dto.WithdrawalListQuery) ([]dto.AdminWithdrawalResponse, dto.PaginationMeta, error)
	AdminProcessWithdrawal(ctx context.Context, adminID, withdrawalID string, req dto.AdminProcessWithdrawalRequest) (*dto.AdminWithdrawalResponse, error)

	// Partner Invite Onboarding & Portal Self-Service (Revenue % strictly hidden)
	GetPartnerInviteInfo(ctx context.Context, token string) (*dto.PartnerInviteInfoResponse, error)
	ActivatePartnerInvite(ctx context.Context, token string, req dto.PartnerActivateInviteRequest) (*dto.PartnerAuthResponse, error)
	LoginPartner(ctx context.Context, req dto.PartnerLoginRequest) (*dto.PartnerAuthResponse, error)
	GetPartnerProfile(ctx context.Context, partnerID string) (*dto.PartnerProfileResponse, error)
	UpdatePartnerProfile(ctx context.Context, partnerID string, req dto.UpdatePartnerProfileRequest) (*dto.PartnerProfileResponse, error)
	ChangePartnerPassword(ctx context.Context, partnerID string, req dto.ChangePartnerPasswordRequest) error
	GetPartnerOverview(ctx context.Context, partnerID string) (*dto.PartnerOverviewResponse, error)
	ListPartnerAds(ctx context.Context, partnerID string) ([]dto.PartnerAdItem, error)
	ListPartnerRouters(ctx context.Context, partnerID string) ([]dto.PartnerRouterItem, error)
	CreatePartnerWithdrawal(ctx context.Context, partnerID string, req dto.CreatePartnerWithdrawalRequest) (*dto.PartnerWithdrawalResponse, error)
	ListPartnerWithdrawals(ctx context.Context, partnerID string, query dto.WithdrawalListQuery) ([]dto.PartnerWithdrawalResponse, dto.PaginationMeta, error)
	ListPartnerTransactions(ctx context.Context, partnerID string, query dto.PaginationQuery) ([]dto.PartnerWalletTxResponse, dto.PaginationMeta, error)
}

type partnerService struct {
	partners    repository.PartnerRepository
	marketplace repository.MarketplaceRepository
	routers     repository.RouterRepository
	accounts    repository.AccountingRepository
	logger      *slog.Logger
	jwtSecret   string
	jwtIssuer   string
	jwtTTL      time.Duration
}

func NewPartnerService(
	partners repository.PartnerRepository,
	marketplace repository.MarketplaceRepository,
	routers repository.RouterRepository,
	accounts repository.AccountingRepository,
	logger *slog.Logger,
	jwtSecret string,
	jwtIssuer string,
	jwtTTL time.Duration,
) PartnerService {
	return &partnerService{
		partners:    partners,
		marketplace: marketplace,
		routers:     routers,
		accounts:    accounts,
		logger:      logger,
		jwtSecret:   jwtSecret,
		jwtIssuer:   jwtIssuer,
		jwtTTL:      jwtTTL,
	}
}

// ==================== ADMIN BADGES & FINANCE ====================

func (s *partnerService) AdminGetBadges(ctx context.Context) (*dto.AdminSidebarBadgesResponse, error) {
	pc, wt, pw, err := s.partners.GetAdminBadges(ctx)
	if err != nil {
		return nil, err
	}
	return &dto.AdminSidebarBadgesResponse{
		PendingCampaignsCount:   pc,
		WaitingTopupsCount:      wt,
		PendingWithdrawalsCount: pw,
	}, nil
}

func (s *partnerService) AdminGetFinanceSummary(ctx context.Context, query dto.AdminFinanceQuery) (*dto.AdminFinanceSummaryResponse, error) {
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
	case "7d":
		since = startOfDay.AddDate(0, 0, -6).UTC()
	default:
		since = startOfDay.AddDate(0, 0, -29).UTC()
	}

	snap, err := s.partners.GetFinanceTotals(ctx, since)
	if err != nil {
		return nil, err
	}

	impressions, err := s.partners.ListAllImpressionsSince(ctx, since)
	if err != nil {
		return nil, err
	}

	var periodGross, periodPartner, periodNet int64
	type routerAgg struct {
		imp     int64
		clicks  int64
		gross   int64
		partner int64
		net     int64
	}
	byRouterMap := make(map[string]*routerAgg)

	for _, imp := range impressions {
		gross := imp.CostChargedIDR
		ps := imp.PartnerShareIDR
		ns := imp.PlatformShareIDR
		if ns == 0 && ps == 0 && gross > 0 {
			ns = gross
		}
		periodGross += gross
		periodPartner += ps
		periodNet += ns

		agg, ok := byRouterMap[imp.RouterID]
		if !ok {
			agg = &routerAgg{}
			byRouterMap[imp.RouterID] = agg
		}
		agg.imp++
		if imp.ClickedAt != nil {
			agg.clicks++
		}
		agg.gross += gross
		agg.partner += ps
		agg.net += ns
	}

	var series []dto.AdminFinanceChartPoint
	switch query.Range {
	case "today":
		labels := []string{"00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"}
		series = make([]dto.AdminFinanceChartPoint, 8)
		for i := 0; i < 8; i++ {
			series[i].Label = labels[i]
		}
		for _, imp := range impressions {
			tLocal := imp.CreatedAt.In(loc)
			if !tLocal.Before(startOfDay) {
				idx := tLocal.Hour() / 3
				if idx >= 0 && idx < 8 {
					ns := imp.PlatformShareIDR
					if ns == 0 && imp.PartnerShareIDR == 0 {
						ns = imp.CostChargedIDR
					}
					series[idx].Impressions++
					series[idx].GrossAdSpendIDR += imp.CostChargedIDR
					series[idx].PartnerShareIDR += imp.PartnerShareIDR
					series[idx].NetPlatformIDR += ns
				}
			}
		}
	case "7d":
		series = make([]dto.AdminFinanceChartPoint, 7)
		for i := 0; i < 7; i++ {
			d := startOfDay.AddDate(0, 0, -(6 - i))
			series[i].Label = d.Format("02 Jan")
		}
		for _, imp := range impressions {
			tLocal := imp.CreatedAt.In(loc)
			dayStart := time.Date(tLocal.Year(), tLocal.Month(), tLocal.Day(), 0, 0, 0, 0, loc)
			diff := int(startOfDay.Sub(dayStart).Hours() / 24)
			if diff >= 0 && diff < 7 {
				idx := 6 - diff
				ns := imp.PlatformShareIDR
				if ns == 0 && imp.PartnerShareIDR == 0 {
					ns = imp.CostChargedIDR
				}
				series[idx].Impressions++
				series[idx].GrossAdSpendIDR += imp.CostChargedIDR
				series[idx].PartnerShareIDR += imp.PartnerShareIDR
				series[idx].NetPlatformIDR += ns
			}
		}
	default:
		series = make([]dto.AdminFinanceChartPoint, 6)
		for i := 0; i < 6; i++ {
			d := startOfDay.AddDate(0, 0, -((5 - i) * 5))
			series[i].Label = d.Format("02 Jan")
		}
		for _, imp := range impressions {
			tLocal := imp.CreatedAt.In(loc)
			dayStart := time.Date(tLocal.Year(), tLocal.Month(), tLocal.Day(), 0, 0, 0, 0, loc)
			diff := int(startOfDay.Sub(dayStart).Hours() / 24)
			if diff >= 0 && diff < 30 {
				idx := 5 - (diff / 5)
				if idx >= 0 && idx < 6 {
					ns := imp.PlatformShareIDR
					if ns == 0 && imp.PartnerShareIDR == 0 {
						ns = imp.CostChargedIDR
					}
					series[idx].Impressions++
					series[idx].GrossAdSpendIDR += imp.CostChargedIDR
					series[idx].PartnerShareIDR += imp.PartnerShareIDR
					series[idx].NetPlatformIDR += ns
				}
			}
		}
	}

	activeRouters, _ := s.routers.ListActive(ctx)
	allPartners, _ := s.partners.ListAllPartners(ctx)
	partnerMap := make(map[string]model.Partner, len(allPartners))
	for _, p := range allPartners {
		partnerMap[p.ID] = p
	}
	tiers, _ := s.marketplace.ListLocationTiers(ctx, false)
	traffic7d, _ := s.partners.GetRouterTraffic7d(ctx, time.Now().UTC().AddDate(0, 0, -7))

	routerMap := make(map[string]model.Router, len(activeRouters))
	for _, r := range activeRouters {
		routerMap[r.ID] = r
	}

	byRouter := make([]dto.AdminRouterRevenueItem, 0, len(byRouterMap))
	for rid, agg := range byRouterMap {
		rm := routerMap[rid]
		rName := rm.Name
		if rName == "" {
			rName = "Router Hotspot"
		}
		venueName, _, _, _, _, pPtr := ResolveRouterPartnerDisplay(&rm, partnerMap)
		pName := ""
		if pPtr != nil {
			pName = pPtr.Name
		}
		tr := traffic7d[rid]
		_, tierName, _ := ResolveEffectiveRouterTier(&rm, tiers, computeAvg7d(tr.TotalConnects7d), computeAvg7d(tr.TotalImpressions7d))

		byRouter = append(byRouter, dto.AdminRouterRevenueItem{
			RouterID:        rid,
			RouterName:      rName,
			VenueName:       venueName,
			PartnerName:     pName,
			TierName:        tierName,
			Impressions:     agg.imp,
			Clicks:          agg.clicks,
			GrossAdSpendIDR: agg.gross,
			PartnerShareIDR: agg.partner,
			NetPlatformIDR:  agg.net,
		})
	}
	sort.Slice(byRouter, func(i, j int) bool {
		return byRouter[i].GrossAdSpendIDR > byRouter[j].GrossAdSpendIDR
	})

	return &dto.AdminFinanceSummaryResponse{
		TotalTopupPaidIDR:       snap.TotalTopupPaidIDR,
		PeriodTopupPaidIDR:      snap.PeriodTopupPaidIDR,
		WaitingTopupCount:       snap.WaitingTopupCount,
		WaitingTopupIDR:         snap.WaitingTopupIDR,
		TotalGrossAdSpendIDR:    snap.TotalGrossAdSpendIDR,
		PeriodGrossAdSpendIDR:   periodGross,
		TotalPartnerShareIDR:    snap.TotalPartnerShareIDR,
		PeriodPartnerShareIDR:   periodPartner,
		TotalNetPlatformIDR:     snap.TotalNetPlatformIDR,
		PeriodNetPlatformIDR:    periodNet,
		TotalWithdrawalsPaidIDR: snap.TotalWithdrawalsPaidIDR,
		PendingWithdrawalsCount: snap.PendingWithdrawalsCount,
		PendingWithdrawalsIDR:   snap.PendingWithdrawalsIDR,
		TotalClientWalletIDR:    snap.TotalClientWalletIDR,
		TotalPartnerWalletIDR:   snap.TotalPartnerWalletIDR,
		Series:                  series,
		ByRouter:                byRouter,
	}, nil
}

func (s *partnerService) AdminListGlobalWalletTransactions(
	ctx context.Context,
	query dto.WalletTransactionListQuery,
) ([]dto.WalletTransactionResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	items, total, err := s.marketplace.ListWalletTransactions(ctx, repository.WalletTxFilter{
		Page:         page,
		PerPage:      perPage,
		AdvertiserID: query.AdvertiserID,
		Type:         query.Type,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}
	advIDs := make([]string, 0, len(items))
	for _, tx := range items {
		advIDs = append(advIDs, tx.AdvertiserID)
	}
	advMap, _ := s.marketplace.FindAdvertisersByIDs(ctx, advIDs)

	out := make([]dto.WalletTransactionResponse, 0, len(items))
	for _, tx := range items {
		adv := advMap[tx.AdvertiserID]
		out = append(out, dto.WalletTransactionResponse{
			ID:                tx.ID,
			AdvertiserID:      tx.AdvertiserID,
			AdvertiserName:    adv.Name,
			AdvertiserCompany: adv.CompanyName,
			Type:              tx.Type,
			AmountIDR:         tx.AmountIDR,
			BalanceAfterIDR:   tx.BalanceAfterIDR,
			ReferenceType:     tx.ReferenceType,
			ReferenceID:       tx.ReferenceID,
			Description:       tx.Description,
			CreatedAt:         tx.CreatedAt,
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

// ==================== ADMIN PARTNER CRUD & WITHDRAWALS ====================

func (s *partnerService) AdminListPartners(
	ctx context.Context,
	query dto.AdminPartnerListQuery,
) ([]dto.AdminPartnerResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	items, total, err := s.partners.ListPartners(ctx, page, perPage, query.Search)
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}

	activeRouters, _ := s.routers.ListActive(ctx)
	routersByPartner := make(map[string][]string)
	for _, r := range activeRouters {
		if r.PartnerID != nil && *r.PartnerID != "" {
			routersByPartner[*r.PartnerID] = append(routersByPartner[*r.PartnerID], r.Name)
		}
	}

	out := make([]dto.AdminPartnerResponse, 0, len(items))
	for _, p := range items {
		rNames := routersByPartner[p.ID]
		if rNames == nil {
			rNames = []string{}
		}
		out = append(out, toAdminPartnerDTO(&p, rNames))
	}
	meta := dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}
	return out, meta, nil
}

func (s *partnerService) AdminGetPartner(ctx context.Context, id string) (*dto.AdminPartnerResponse, error) {
	p, err := s.partners.FindPartnerByID(ctx, id)
	if err != nil {
		return nil, err
	}
	rtrs, _ := s.partners.ListRoutersByPartnerID(ctx, p.ID)
	rNames := make([]string, 0, len(rtrs))
	for _, r := range rtrs {
		rNames = append(rNames, r.Name)
	}
	res := toAdminPartnerDTO(p, rNames)
	return &res, nil
}

func (s *partnerService) AdminCreatePartnerInvite(ctx context.Context, req dto.AdminCreatePartnerInviteRequest) (*dto.AdminPartnerResponse, error) {
	setting, _ := s.marketplace.GetPlatformSetting(ctx)
	sharePct := 20.0
	if setting != nil && setting.DefaultPartnerSharePercent > 0 {
		sharePct = setting.DefaultPartnerSharePercent
	}
	if req.RevenueSharePercent != nil && *req.RevenueSharePercent >= 0 && *req.RevenueSharePercent <= 95 {
		sharePct = *req.RevenueSharePercent
	}

	inviteToken, err := utils.SecureToken(24)
	if err != nil {
		return nil, apperror.ErrInternalServer
	}

	now := time.Now().UTC()
	expiresAt := now.Add(7 * 24 * time.Hour)
	p := &model.Partner{
		Base:                model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		VenueName:           strings.TrimSpace(req.VenueName),
		VenueCategory:       "Kafe",
		RevenueSharePercent: sharePct,
		Status:              model.PartnerStatusInvited,
		InviteToken:         &inviteToken,
		InviteExpiresAt:     &expiresAt,
		IsActive:            true,
	}
	if err := s.partners.CreatePartner(ctx, p); err != nil {
		return nil, err
	}
	res := toAdminPartnerDTO(p, []string{})
	return &res, nil
}

func (s *partnerService) AdminRegeneratePartnerInvite(ctx context.Context, id string) (*dto.AdminPartnerResponse, error) {
	p, err := s.partners.FindPartnerByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.Status == model.PartnerStatusActive && p.Username != nil && *p.Username != "" {
		return nil, apperror.New(apperror.ErrBadRequest, "Akun mitra ini sudah aktif")
	}
	inviteToken, err := utils.SecureToken(24)
	if err != nil {
		return nil, apperror.ErrInternalServer
	}
	now := time.Now().UTC()
	expiresAt := now.Add(7 * 24 * time.Hour)
	p.Status = model.PartnerStatusInvited
	p.InviteToken = &inviteToken
	p.InviteExpiresAt = &expiresAt
	p.UpdatedAt = now
	if err := s.partners.UpdatePartner(ctx, p); err != nil {
		return nil, err
	}
	return s.AdminGetPartner(ctx, p.ID)
}

func (s *partnerService) AdminUpdatePartnerSettings(ctx context.Context, id string, req dto.AdminUpdatePartnerSettingsRequest) (*dto.AdminPartnerResponse, error) {
	p, err := s.partners.FindPartnerByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.Status == model.PartnerStatusInvited && strings.TrimSpace(req.VenueName) != "" {
		p.VenueName = strings.TrimSpace(req.VenueName)
	}
	p.RevenueSharePercent = req.RevenueSharePercent
	p.IsActive = req.IsActive
	p.UpdatedAt = time.Now().UTC()

	if err := s.partners.UpdatePartner(ctx, p); err != nil {
		return nil, err
	}
	return s.AdminGetPartner(ctx, p.ID)
}

func (s *partnerService) AdminChangePartnerPassword(ctx context.Context, id string, req dto.AdminChangePartnerPasswordRequest) error {
	p, err := s.partners.FindPartnerByID(ctx, id)
	if err != nil {
		return err
	}
	hash, err := utils.HashPassword(req.Password)
	if err != nil {
		return apperror.ErrInternalServer
	}
	p.PasswordHash = hash
	p.UpdatedAt = time.Now().UTC()
	return s.partners.UpdatePartner(ctx, p)
}

func (s *partnerService) AdminDeletePartner(ctx context.Context, id string) error {
	return s.partners.DeletePartner(ctx, id)
}

func (s *partnerService) AdminListWithdrawals(
	ctx context.Context,
	query dto.WithdrawalListQuery,
) ([]dto.AdminWithdrawalResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	items, total, err := s.partners.ListWithdrawals(ctx, repository.WithdrawalFilter{
		Page:      page,
		PerPage:   perPage,
		PartnerID: query.PartnerID,
		Status:    query.Status,
		Search:    query.Search,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}

	pIDs := make([]string, 0, len(items))
	for _, wd := range items {
		pIDs = append(pIDs, wd.PartnerID)
	}
	pMap, _ := s.partners.FindPartnersByIDs(ctx, pIDs)

	out := make([]dto.AdminWithdrawalResponse, 0, len(items))
	for _, wd := range items {
		p := pMap[wd.PartnerID]
		pEmail := derefStr(p.Email)
		if pEmail == "" {
			pEmail = derefStr(p.Username)
		}
		out = append(out, dto.AdminWithdrawalResponse{
			ID:                wd.ID,
			WithdrawalNumber:  wd.WithdrawalNumber,
			PartnerID:         wd.PartnerID,
			PartnerName:       p.Name,
			VenueName:         p.VenueName,
			PartnerEmail:      pEmail,
			AmountIDR:         wd.AmountIDR,
			BankName:          wd.BankName,
			BankAccountNumber: wd.BankAccountNumber,
			BankAccountHolder: wd.BankAccountHolder,
			Status:            wd.Status,
			ProofImageURL:     wd.ProofImageURL,
			AdminNote:         wd.AdminNote,
			ProcessedAt:       wd.ProcessedAt,
			CreatedAt:         wd.CreatedAt,
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

func (s *partnerService) AdminProcessWithdrawal(
	ctx context.Context,
	adminID, withdrawalID string,
	req dto.AdminProcessWithdrawalRequest,
) (*dto.AdminWithdrawalResponse, error) {
	approve := req.Action == "APPROVE"
	wd, err := s.partners.ProcessWithdrawal(ctx, withdrawalID, adminID, approve, req.ProofImageURL, req.AdminNote, time.Now().UTC())
	if err != nil {
		return nil, err
	}
	p, _ := s.partners.FindPartnerByID(ctx, wd.PartnerID)
	res := dto.AdminWithdrawalResponse{
		ID:                wd.ID,
		WithdrawalNumber:  wd.WithdrawalNumber,
		PartnerID:         wd.PartnerID,
		AmountIDR:         wd.AmountIDR,
		BankName:          wd.BankName,
		BankAccountNumber: wd.BankAccountNumber,
		BankAccountHolder: wd.BankAccountHolder,
		Status:            wd.Status,
		ProofImageURL:     wd.ProofImageURL,
		AdminNote:         wd.AdminNote,
		ProcessedAt:       wd.ProcessedAt,
		CreatedAt:         wd.CreatedAt,
	}
	if p != nil {
		res.PartnerName = p.Name
		res.VenueName = p.VenueName
		res.PartnerEmail = derefStr(p.Email)
		if res.PartnerEmail == "" {
			res.PartnerEmail = derefStr(p.Username)
		}
	}
	return &res, nil
}

// ==================== PARTNER PORTAL (STRICT PRIVACY) ====================

func (s *partnerService) GetPartnerInviteInfo(ctx context.Context, token string) (*dto.PartnerInviteInfoResponse, error) {
	p, err := s.partners.FindPartnerByInviteToken(ctx, strings.TrimSpace(token))
	if err != nil {
		if errors.Is(err, apperror.ErrNotFound) {
			return nil, apperror.New(apperror.ErrNotFound, "Tautan undangan mitra tidak valid atau sudah digunakan")
		}
		return nil, err
	}
	if !p.IsActive {
		return nil, apperror.New(apperror.ErrForbidden, "Undangan mitra sedang dinonaktifkan")
	}
	if p.Status == model.PartnerStatusActive && p.Username != nil && *p.Username != "" {
		return nil, apperror.New(apperror.ErrConflict, "Akun mitra ini sudah diaktifkan, silakan masuk melalui halaman login")
	}
	if p.InviteExpiresAt != nil && time.Now().UTC().After(*p.InviteExpiresAt) {
		return nil, apperror.New(apperror.ErrBadRequest, "Masa berlaku tautan undangan sudah habis, silakan minta tautan baru dari Admin")
	}
	cat := p.VenueCategory
	if cat == "" {
		cat = "Kafe"
	}
	return &dto.PartnerInviteInfoResponse{
		VenueName:     p.VenueName,
		VenueCategory: cat,
		Status:        p.Status,
		ExpiresAt:     p.InviteExpiresAt,
	}, nil
}

func (s *partnerService) ActivatePartnerInvite(ctx context.Context, token string, req dto.PartnerActivateInviteRequest) (*dto.PartnerAuthResponse, error) {
	p, err := s.partners.FindPartnerByInviteToken(ctx, strings.TrimSpace(token))
	if err != nil {
		if errors.Is(err, apperror.ErrNotFound) {
			return nil, apperror.New(apperror.ErrNotFound, "Tautan undangan mitra tidak valid atau sudah digunakan")
		}
		return nil, err
	}
	if !p.IsActive {
		return nil, apperror.New(apperror.ErrForbidden, "Undangan mitra sedang dinonaktifkan")
	}
	if p.Status == model.PartnerStatusActive && p.Username != nil && *p.Username != "" {
		return nil, apperror.New(apperror.ErrConflict, "Akun mitra ini sudah diaktifkan sebelumnya")
	}
	if p.InviteExpiresAt != nil && time.Now().UTC().After(*p.InviteExpiresAt) {
		return nil, apperror.New(apperror.ErrBadRequest, "Masa berlaku tautan undangan sudah habis, silakan minta tautan baru dari Admin")
	}
	if req.Latitude == nil || req.Longitude == nil {
		return nil, apperror.New(apperror.ErrBadRequest, "Titik lokasi tempat usaha wajib ditentukan pada peta")
	}

	username := strings.ToLower(strings.TrimSpace(req.Username))
	for _, ch := range username {
		valid := (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '_' || ch == '.' || ch == '-'
		if !valid {
			return nil, apperror.New(apperror.ErrBadRequest, "Username hanya boleh berisi huruf kecil, angka, titik, garis bawah, atau tanda hubung")
		}
	}
	if existingUser, uErr := s.partners.FindPartnerByUsername(ctx, username); uErr == nil && existingUser != nil && existingUser.ID != p.ID {
		return nil, apperror.New(apperror.ErrAlreadyExists, "Username sudah digunakan mitra lain, silakan pilih username lain")
	}

	var emailPtr *string
	if cleanEmail := strings.ToLower(strings.TrimSpace(req.Email)); cleanEmail != "" {
		if existingEmail, eErr := s.partners.FindPartnerByEmail(ctx, cleanEmail); eErr == nil && existingEmail != nil && existingEmail.ID != p.ID {
			return nil, apperror.New(apperror.ErrAlreadyExists, "Email sudah terdaftar pada akun mitra lain")
		}
		emailPtr = &cleanEmail
	}

	hash, err := utils.HashPassword(req.Password)
	if err != nil {
		return nil, apperror.ErrInternalServer
	}

	now := time.Now().UTC()
	cat := strings.TrimSpace(req.VenueCategory)
	if cat == "" {
		cat = "Kafe"
	}

	p.Username = &username
	p.Email = emailPtr
	p.Phone = strings.TrimSpace(req.Phone)
	p.Name = strings.TrimSpace(req.Name)
	p.PasswordHash = hash
	p.VenueName = strings.TrimSpace(req.VenueName)
	p.VenueCategory = cat
	p.Address = strings.TrimSpace(req.Address)
	p.Latitude = req.Latitude
	p.Longitude = req.Longitude
	p.BankName = strings.TrimSpace(req.BankName)
	p.BankAccountNumber = strings.TrimSpace(req.BankAccountNumber)
	p.BankAccountHolder = strings.TrimSpace(req.BankAccountHolder)
	p.Status = model.PartnerStatusActive
	p.InviteToken = nil
	p.InviteExpiresAt = nil
	p.ActivatedAt = &now
	p.LastLoginAt = &now
	p.UpdatedAt = now

	if err := s.partners.UpdatePartner(ctx, p); err != nil {
		return nil, err
	}
	_ = s.partners.SyncPartnerLocationToRouters(ctx, p)

	jwtTok, err := utils.GenerateJWT(s.jwtSecret, s.jwtIssuer, p.ID, username, middleware.RolePartner, s.jwtTTL)
	if err != nil {
		return nil, apperror.ErrInternalServer
	}

	setting, _ := s.marketplace.GetPlatformSetting(ctx)
	minWd := int64(50000)
	if setting != nil && setting.MinWithdrawalAmountIDR > 0 {
		minWd = setting.MinWithdrawalAmountIDR
	}

	return &dto.PartnerAuthResponse{
		Token:     jwtTok,
		ExpiresAt: now.Add(s.jwtTTL),
		Partner:   toPartnerProfileDTO(p, minWd),
	}, nil
}

func (s *partnerService) LoginPartner(ctx context.Context, req dto.PartnerLoginRequest) (*dto.PartnerAuthResponse, error) {
	identifier := strings.TrimSpace(req.Identifier)
	if identifier == "" {
		identifier = strings.TrimSpace(req.Email)
	}
	if identifier == "" {
		return nil, apperror.New(apperror.ErrBadRequest, "Username atau email wajib diisi")
	}

	p, err := s.partners.FindPartnerByIdentifier(ctx, identifier)
	if err != nil {
		if errors.Is(err, apperror.ErrNotFound) {
			return nil, apperror.New(apperror.ErrUnauthorized, "Username/email atau kata sandi mitra salah")
		}
		return nil, err
	}
	if !p.IsActive {
		return nil, apperror.New(apperror.ErrForbidden, "Akun mitra sedang dinonaktifkan")
	}
	if p.Status == model.PartnerStatusInvited || strings.TrimSpace(p.PasswordHash) == "" {
		return nil, apperror.New(apperror.ErrForbidden, "Akun mitra belum diaktifkan, silakan buka tautan undangan terlebih dahulu")
	}
	if !utils.CheckPasswordHash(req.Password, p.PasswordHash) {
		return nil, apperror.New(apperror.ErrUnauthorized, "Username/email atau kata sandi mitra salah")
	}

	now := time.Now().UTC()
	_ = s.partners.TouchPartnerLogin(ctx, p.ID, now)
	p.LastLoginAt = &now

	subIdent := derefStr(p.Username)
	if subIdent == "" {
		subIdent = derefStr(p.Email)
	}
	token, err := utils.GenerateJWT(s.jwtSecret, s.jwtIssuer, p.ID, subIdent, middleware.RolePartner, s.jwtTTL)
	if err != nil {
		return nil, apperror.ErrInternalServer
	}

	setting, _ := s.marketplace.GetPlatformSetting(ctx)
	minWd := int64(50000)
	if setting != nil && setting.MinWithdrawalAmountIDR > 0 {
		minWd = setting.MinWithdrawalAmountIDR
	}

	return &dto.PartnerAuthResponse{
		Token:     token,
		ExpiresAt: now.Add(s.jwtTTL),
		Partner:   toPartnerProfileDTO(p, minWd),
	}, nil
}

func (s *partnerService) GetPartnerProfile(ctx context.Context, partnerID string) (*dto.PartnerProfileResponse, error) {
	p, err := s.partners.FindPartnerByID(ctx, partnerID)
	if err != nil {
		return nil, err
	}
	setting, _ := s.marketplace.GetPlatformSetting(ctx)
	minWd := int64(50000)
	if setting != nil && setting.MinWithdrawalAmountIDR > 0 {
		minWd = setting.MinWithdrawalAmountIDR
	}
	res := toPartnerProfileDTO(p, minWd)
	return &res, nil
}

func (s *partnerService) UpdatePartnerProfile(ctx context.Context, partnerID string, req dto.UpdatePartnerProfileRequest) (*dto.PartnerProfileResponse, error) {
	p, err := s.partners.FindPartnerByID(ctx, partnerID)
	if err != nil {
		return nil, err
	}
	if req.Latitude == nil || req.Longitude == nil {
		return nil, apperror.New(apperror.ErrBadRequest, "Titik koordinat lokasi wajib dipilih pada peta")
	}

	if cleanEmail := strings.ToLower(strings.TrimSpace(req.Email)); cleanEmail != "" {
		if existingEmail, eErr := s.partners.FindPartnerByEmail(ctx, cleanEmail); eErr == nil && existingEmail != nil && existingEmail.ID != p.ID {
			return nil, apperror.New(apperror.ErrAlreadyExists, "Email sudah digunakan akun mitra lain")
		}
		p.Email = &cleanEmail
	} else {
		p.Email = nil
	}

	p.Name = strings.TrimSpace(req.Name)
	p.VenueName = strings.TrimSpace(req.VenueName)
	p.VenueCategory = strings.TrimSpace(req.VenueCategory)
	p.Phone = strings.TrimSpace(req.Phone)
	p.Address = strings.TrimSpace(req.Address)
	p.Latitude = req.Latitude
	p.Longitude = req.Longitude
	p.BankName = strings.TrimSpace(req.BankName)
	p.BankAccountNumber = strings.TrimSpace(req.BankAccountNumber)
	p.BankAccountHolder = strings.TrimSpace(req.BankAccountHolder)
	p.UpdatedAt = time.Now().UTC()

	if err := s.partners.UpdatePartner(ctx, p); err != nil {
		return nil, err
	}
	// Automatically sync coordinates, address & category to all routers assigned to this partner!
	_ = s.partners.SyncPartnerLocationToRouters(ctx, p)

	return s.GetPartnerProfile(ctx, p.ID)
}

func (s *partnerService) ChangePartnerPassword(ctx context.Context, partnerID string, req dto.ChangePartnerPasswordRequest) error {
	p, err := s.partners.FindPartnerByID(ctx, partnerID)
	if err != nil {
		return err
	}
	if !utils.CheckPasswordHash(req.CurrentPassword, p.PasswordHash) {
		return apperror.New(apperror.ErrBadRequest, "Kata sandi lama tidak sesuai")
	}
	hash, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		return apperror.ErrInternalServer
	}
	p.PasswordHash = hash
	p.UpdatedAt = time.Now().UTC()
	return s.partners.UpdatePartner(ctx, p)
}

func (s *partnerService) GetPartnerOverview(ctx context.Context, partnerID string) (*dto.PartnerOverviewResponse, error) {
	p, err := s.partners.FindPartnerByID(ctx, partnerID)
	if err != nil {
		return nil, err
	}
	routers, _ := s.partners.ListRoutersByPartnerID(ctx, p.ID)
	routerIDs := make([]string, 0, len(routers))
	nasSet := make(map[string]bool)
	for _, r := range routers {
		routerIDs = append(routerIDs, r.ID)
		if k := strings.ToLower(strings.TrimSpace(r.NASIdentifier)); k != "" {
			nasSet[k] = true
		}
	}

	onlineRouters := 0
	if s.accounts != nil && len(nasSet) > 0 {
		seenNAS := make(map[string]bool)
		if sessions, _, sErr := s.accounts.ListSessions(ctx, repository.SessionFilter{Page: 1, PerPage: 300, Order: "desc"}); sErr == nil {
			for _, sess := range sessions {
				k := strings.ToLower(strings.TrimSpace(sess.NASIdentifier))
				if nasSet[k] && !seenNAS[k] {
					seenNAS[k] = true
					onlineRouters++
				}
			}
		}
	}

	loc, locErr := time.LoadLocation("Asia/Jakarta")
	if locErr != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	nowLocal := time.Now().In(loc)
	startOfDay := time.Date(nowLocal.Year(), nowLocal.Month(), nowLocal.Day(), 0, 0, 0, 0, loc)
	startOfMonth := time.Date(nowLocal.Year(), nowLocal.Month(), 1, 0, 0, 0, 0, loc)
	since30d := startOfDay.AddDate(0, 0, -29).UTC()
	if startOfMonth.UTC().Before(since30d) {
		since30d = startOfMonth.UTC()
	}

	imps, _ := s.partners.ListPartnerImpressionsSince(ctx, p.ID, routerIDs, since30d)
	visitors, _ := s.partners.ListVisitorsByRoutersSince(ctx, routerIDs, since30d)

	var todayEarned, monthEarned, todayVisitors int64
	for _, imp := range imps {
		tLocal := imp.CreatedAt.In(loc)
		if !tLocal.Before(startOfDay) {
			todayEarned += imp.PartnerShareIDR
		}
		if !tLocal.Before(startOfMonth) {
			monthEarned += imp.PartnerShareIDR
		}
	}
	for _, v := range visitors {
		tLocal := v.CreatedAt.In(loc)
		if !tLocal.Before(startOfDay) {
			todayVisitors++
		}
	}

	ads, _ := s.partners.ListAdsTargetingRouters(ctx, routerIDs)
	var activeAdsCount int64
	for _, a := range ads {
		if a.Status == model.AdStatusActive && a.IsActive {
			activeAdsCount++
		}
	}

	// Compute Rank Progress across partner's routers
	tiers, _ := s.marketplace.ListLocationTiers(ctx, true)
	traffic7d, _ := s.partners.GetRouterTraffic7d(ctx, time.Now().UTC().AddDate(0, 0, -7))
	var totalConn7d, totalImp7d int64
	for _, rid := range routerIDs {
		tr := traffic7d[rid]
		totalConn7d += tr.TotalConnects7d
		totalImp7d += tr.TotalImpressions7d
	}
	avgConn := computeAvg7d(totalConn7d)
	avgImp := computeAvg7d(totalImp7d)

	rankProg := dto.PartnerRankProgress{
		CurrentTierName:     "Standard",
		AvgDailyConnects:    avgConn,
		AvgDailyImpressions: avgImp,
	}
	if len(routers) > 0 {
		_, tName, curMult := ResolveEffectiveRouterTier(&routers[0], tiers, avgConn, avgImp)
		rankProg.CurrentTierName = tName

		// Find immediate next higher tier
		var nextTier *model.LocationTier
		for i := range tiers {
			t := tiers[i]
			if t.Multiplier > curMult {
				if nextTier == nil || t.Multiplier < nextTier.Multiplier {
					tCopy := t
					nextTier = &tCopy
				}
			}
		}
		if nextTier != nil {
			rankProg.NextTierName = nextTier.Name
			rankProg.NextTierMinConnects = nextTier.MinDailyConnects
		}
	}

	trendToday := buildPartnerTodayBuckets(visitors, imps, startOfDay, loc)
	trend7d := buildPartner7dBuckets(visitors, imps, startOfDay, loc)
	trend30d := buildPartner30dBuckets(visitors, imps, startOfDay, loc)

	needsLoc := p.Latitude == nil || p.Longitude == nil || strings.TrimSpace(p.Address) == ""

	return &dto.PartnerOverviewResponse{
		WalletBalanceIDR:   p.WalletBalanceIDR,
		TotalEarnedIDR:     p.TotalEarnedIDR,
		TodayEarnedIDR:     todayEarned,
		MonthEarnedIDR:     monthEarned,
		TodayVisitors:      todayVisitors,
		ActiveAdsCount:     activeAdsCount,
		RoutersCount:       len(routers),
		OnlineRoutersCount: onlineRouters,
		NeedsLocationSetup: needsLoc,
		Rank:               rankProg,
		TrendToday:         trendToday,
		Trend7d:            trend7d,
		Trend30d:           trend30d,
	}, nil
}

func (s *partnerService) ListPartnerAds(ctx context.Context, partnerID string) ([]dto.PartnerAdItem, error) {
	routers, err := s.partners.ListRoutersByPartnerID(ctx, partnerID)
	if err != nil {
		return nil, err
	}
	routerIDs := make([]string, 0, len(routers))
	for _, r := range routers {
		routerIDs = append(routerIDs, r.ID)
	}
	ads, err := s.partners.ListAdsTargetingRouters(ctx, routerIDs)
	if err != nil {
		return nil, err
	}
	statsMap, _ := s.partners.GetPartnerAdStatsByRouters(ctx, partnerID, routerIDs)

	advIDs := make([]string, 0, len(ads))
	for _, a := range ads {
		if a.AdvertiserID != nil {
			advIDs = append(advIDs, *a.AdvertiserID)
		}
	}
	advMap, _ := s.marketplace.FindAdvertisersByIDs(ctx, advIDs)

	out := make([]dto.PartnerAdItem, 0, len(ads))
	for _, a := range ads {
		advLabel := "Pengiklan"
		if a.AdvertiserID != nil {
			if adv, ok := advMap[*a.AdvertiserID]; ok {
				if adv.CompanyName != "" {
					advLabel = adv.CompanyName
				} else if adv.Name != "" {
					advLabel = adv.Name
				}
			}
		}
		st := statsMap[a.ID]
		out = append(out, dto.PartnerAdItem{
			ID:                 a.ID,
			Title:              a.Title,
			Body:               a.Body,
			ImageURL:           normalizeAdMediaURL(a.ImageURL),
			TargetURL:          a.TargetURL,
			MediaType:          a.MediaType,
			LayoutMode:         a.LayoutMode,
			DurationSeconds:    a.DurationSeconds,
			AdvertiserName:     advLabel,
			Status:             a.Status,
			StartHour:          a.StartHour,
			EndHour:            a.EndHour,
			ImpressionsAtVenue: st.Impressions,
			ClicksAtVenue:      st.Clicks,
			EarnedIDR:          st.EarnedIDR,
		})
	}
	return out, nil
}

func (s *partnerService) ListPartnerRouters(ctx context.Context, partnerID string) ([]dto.PartnerRouterItem, error) {
	p, err := s.partners.FindPartnerByID(ctx, partnerID)
	if err != nil {
		return nil, err
	}
	routers, err := s.partners.ListRoutersByPartnerID(ctx, partnerID)
	if err != nil {
		return nil, err
	}
	tiers, _ := s.marketplace.ListLocationTiers(ctx, true)
	traffic7d, _ := s.partners.GetRouterTraffic7d(ctx, time.Now().UTC().AddDate(0, 0, -7))

	type nasTel struct {
		active   int64
		lastSeen *time.Time
	}
	telMap := make(map[string]*nasTel)
	if s.accounts != nil {
		if sessions, _, sErr := s.accounts.ListSessions(ctx, repository.SessionFilter{Page: 1, PerPage: 300, Order: "desc"}); sErr == nil {
			for _, sess := range sessions {
				k := strings.ToLower(strings.TrimSpace(sess.NASIdentifier))
				if k == "" {
					continue
				}
				entry, ok := telMap[k]
				if !ok {
					entry = &nasTel{}
					telMap[k] = entry
				}
				if sess.Status == model.AccountingSessionStatusActive {
					entry.active++
				}
				ts := sess.LastAccountingAt
				if ts == nil {
					ts = sess.StartedAt
				}
				if ts != nil && (entry.lastSeen == nil || ts.After(*entry.lastSeen)) {
					entry.lastSeen = ts
				}
			}
		}
	}

	out := make([]dto.PartnerRouterItem, 0, len(routers))
	for _, r := range routers {
		tr := traffic7d[r.ID]
		avgConn := computeAvg7d(tr.TotalConnects7d)
		avgImp := computeAvg7d(tr.TotalImpressions7d)
		_, tierName, _ := ResolveEffectiveRouterTier(&r, tiers, avgConn, avgImp)
		k := strings.ToLower(strings.TrimSpace(r.NASIdentifier))
		tel := telMap[k]
		var activeCnt int64
		lastSeen := r.LastSeenAt
		if tel != nil {
			activeCnt = tel.active
			if tel.lastSeen != nil && (lastSeen == nil || tel.lastSeen.After(*lastSeen)) {
				lastSeen = tel.lastSeen
			}
		}
		addr := p.Address
		if addr == "" {
			addr = r.LocationAddress
		}
		out = append(out, dto.PartnerRouterItem{
			ID:                  r.ID,
			Name:                r.Name,
			VenueName:           p.VenueName,
			Address:             addr,
			IsConnected:         IsRouterOnline(lastSeen),
			LastSeenAt:          lastSeen,
			ActiveSessionsCount: activeCnt,
			AvgDailyVisitors:    avgConn,
			TierName:            tierName,
		})
	}
	return out, nil
}

func (s *partnerService) CreatePartnerWithdrawal(
	ctx context.Context,
	partnerID string,
	req dto.CreatePartnerWithdrawalRequest,
) (*dto.PartnerWithdrawalResponse, error) {
	setting, _ := s.marketplace.GetPlatformSetting(ctx)
	minWd := int64(50000)
	if setting != nil && setting.MinWithdrawalAmountIDR > 0 {
		minWd = setting.MinWithdrawalAmountIDR
	}
	if req.AmountIDR < minWd {
		return nil, apperror.New(apperror.ErrBadRequest, fmt.Sprintf("Minimal pencairan dana adalah Rp %d", minWd))
	}

	now := time.Now().UTC()
	wdNum := generateWithdrawalNumber(now)
	wd, err := s.partners.CreateWithdrawal(ctx, partnerID, req.AmountIDR, wdNum, now)
	if err != nil {
		return nil, err
	}
	res := toPartnerWithdrawalDTO(wd)
	return &res, nil
}

func (s *partnerService) ListPartnerWithdrawals(
	ctx context.Context,
	partnerID string,
	query dto.WithdrawalListQuery,
) ([]dto.PartnerWithdrawalResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	items, total, err := s.partners.ListWithdrawals(ctx, repository.WithdrawalFilter{
		Page:      page,
		PerPage:   perPage,
		PartnerID: partnerID,
		Status:    query.Status,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}
	out := make([]dto.PartnerWithdrawalResponse, 0, len(items))
	for _, wd := range items {
		out = append(out, toPartnerWithdrawalDTO(&wd))
	}
	meta := dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}
	return out, meta, nil
}

func (s *partnerService) ListPartnerTransactions(
	ctx context.Context,
	partnerID string,
	query dto.PaginationQuery,
) ([]dto.PartnerWalletTxResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	items, total, err := s.partners.ListPartnerTransactions(ctx, repository.PartnerTxFilter{
		Page:      page,
		PerPage:   perPage,
		PartnerID: partnerID,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}
	out := make([]dto.PartnerWalletTxResponse, 0, len(items))
	for _, tx := range items {
		out = append(out, dto.PartnerWalletTxResponse{
			ID:              tx.ID,
			Type:            tx.Type,
			AmountIDR:       tx.AmountIDR,
			BalanceAfterIDR: tx.BalanceAfterIDR,
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

// ==================== INTERNAL MAPPERS & CHART HELPERS ====================

func generateWithdrawalNumber(now time.Time) string {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	suffix := int64(100000)
	if err == nil {
		suffix += n.Int64()
	}
	return fmt.Sprintf("WD-%s-%d", now.Format("20060102"), suffix)
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func toAdminPartnerDTO(p *model.Partner, routerNames []string) dto.AdminPartnerResponse {
	hasCoords := p.Latitude != nil && p.Longitude != nil && strings.TrimSpace(p.Address) != ""
	status := p.Status
	if status == "" {
		status = model.PartnerStatusActive
	}
	return dto.AdminPartnerResponse{
		ID:                  p.ID,
		Username:            derefStr(p.Username),
		Name:                p.Name,
		VenueName:           p.VenueName,
		VenueCategory:       p.VenueCategory,
		Email:               derefStr(p.Email),
		Phone:               p.Phone,
		Address:             p.Address,
		Latitude:            p.Latitude,
		Longitude:           p.Longitude,
		HasCoordinates:      hasCoords,
		RevenueSharePercent: p.RevenueSharePercent,
		WalletBalanceIDR:    p.WalletBalanceIDR,
		TotalEarnedIDR:      p.TotalEarnedIDR,
		BankName:            p.BankName,
		BankAccountNumber:   p.BankAccountNumber,
		BankAccountHolder:   p.BankAccountHolder,
		RoutersCount:        len(routerNames),
		RouterNames:         routerNames,
		Status:              status,
		InviteToken:         derefStr(p.InviteToken),
		InviteExpiresAt:     p.InviteExpiresAt,
		ActivatedAt:         p.ActivatedAt,
		IsActive:            p.IsActive,
		LastLoginAt:         p.LastLoginAt,
		CreatedAt:           p.CreatedAt,
	}
}

func toPartnerProfileDTO(p *model.Partner, minWithdrawalIDR int64) dto.PartnerProfileResponse {
	hasCoords := p.Latitude != nil && p.Longitude != nil && strings.TrimSpace(p.Address) != ""
	status := p.Status
	if status == "" {
		status = model.PartnerStatusActive
	}
	return dto.PartnerProfileResponse{
		ID:                     p.ID,
		Username:               derefStr(p.Username),
		Name:                   p.Name,
		VenueName:              p.VenueName,
		VenueCategory:          p.VenueCategory,
		Email:                  derefStr(p.Email),
		Phone:                  p.Phone,
		Address:                p.Address,
		Latitude:               p.Latitude,
		Longitude:              p.Longitude,
		HasCoordinates:         hasCoords,
		WalletBalanceIDR:       p.WalletBalanceIDR,
		TotalEarnedIDR:         p.TotalEarnedIDR,
		MinWithdrawalAmountIDR: minWithdrawalIDR,
		BankName:               p.BankName,
		BankAccountNumber:      p.BankAccountNumber,
		BankAccountHolder:      p.BankAccountHolder,
		Status:                 status,
		IsActive:               p.IsActive,
		LastLoginAt:            p.LastLoginAt,
		CreatedAt:              p.CreatedAt,
	}
}

func toPartnerWithdrawalDTO(wd *model.PartnerWithdrawal) dto.PartnerWithdrawalResponse {
	return dto.PartnerWithdrawalResponse{
		ID:                wd.ID,
		WithdrawalNumber:  wd.WithdrawalNumber,
		AmountIDR:         wd.AmountIDR,
		BankName:          wd.BankName,
		BankAccountNumber: wd.BankAccountNumber,
		BankAccountHolder: wd.BankAccountHolder,
		Status:            wd.Status,
		ProofImageURL:     wd.ProofImageURL,
		AdminNote:         wd.AdminNote,
		ProcessedAt:       wd.ProcessedAt,
		CreatedAt:         wd.CreatedAt,
	}
}

func buildPartnerTodayBuckets(visitors []model.WifiVisitor, imps []model.AdImpression, startOfDay time.Time, loc *time.Location) []dto.PartnerChartPoint {
	labels := []string{"00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"}
	b := make([]dto.PartnerChartPoint, 8)
	for i := 0; i < 8; i++ {
		b[i].Label = labels[i]
	}
	for _, v := range visitors {
		tLocal := v.CreatedAt.In(loc)
		if !tLocal.Before(startOfDay) {
			idx := tLocal.Hour() / 3
			if idx >= 0 && idx < 8 {
				b[idx].Visitors++
			}
		}
	}
	for _, imp := range imps {
		tLocal := imp.CreatedAt.In(loc)
		if !tLocal.Before(startOfDay) {
			idx := tLocal.Hour() / 3
			if idx >= 0 && idx < 8 {
				b[idx].Impressions++
				b[idx].EarnedIDR += imp.PartnerShareIDR
			}
		}
	}
	return b
}

func buildPartner7dBuckets(visitors []model.WifiVisitor, imps []model.AdImpression, startOfDay time.Time, loc *time.Location) []dto.PartnerChartPoint {
	b := make([]dto.PartnerChartPoint, 7)
	for i := 0; i < 7; i++ {
		d := startOfDay.AddDate(0, 0, -(6 - i))
		b[i].Label = d.Format("02 Jan")
	}
	for _, v := range visitors {
		tLocal := v.CreatedAt.In(loc)
		ds := time.Date(tLocal.Year(), tLocal.Month(), tLocal.Day(), 0, 0, 0, 0, loc)
		diff := int(startOfDay.Sub(ds).Hours() / 24)
		if diff >= 0 && diff < 7 {
			b[6-diff].Visitors++
		}
	}
	for _, imp := range imps {
		tLocal := imp.CreatedAt.In(loc)
		ds := time.Date(tLocal.Year(), tLocal.Month(), tLocal.Day(), 0, 0, 0, 0, loc)
		diff := int(startOfDay.Sub(ds).Hours() / 24)
		if diff >= 0 && diff < 7 {
			b[6-diff].Impressions++
			b[6-diff].EarnedIDR += imp.PartnerShareIDR
		}
	}
	return b
}

func buildPartner30dBuckets(visitors []model.WifiVisitor, imps []model.AdImpression, startOfDay time.Time, loc *time.Location) []dto.PartnerChartPoint {
	b := make([]dto.PartnerChartPoint, 6)
	for i := 0; i < 6; i++ {
		d := startOfDay.AddDate(0, 0, -((5 - i) * 5))
		b[i].Label = d.Format("02 Jan")
	}
	for _, v := range visitors {
		tLocal := v.CreatedAt.In(loc)
		ds := time.Date(tLocal.Year(), tLocal.Month(), tLocal.Day(), 0, 0, 0, 0, loc)
		diff := int(startOfDay.Sub(ds).Hours() / 24)
		if diff >= 0 && diff < 30 {
			idx := 5 - (diff / 5)
			if idx >= 0 && idx < 6 {
				b[idx].Visitors++
			}
		}
	}
	for _, imp := range imps {
		tLocal := imp.CreatedAt.In(loc)
		ds := time.Date(tLocal.Year(), tLocal.Month(), tLocal.Day(), 0, 0, 0, 0, loc)
		diff := int(startOfDay.Sub(ds).Hours() / 24)
		if diff >= 0 && diff < 30 {
			idx := 5 - (diff / 5)
			if idx >= 0 && idx < 6 {
				b[idx].Impressions++
				b[idx].EarnedIDR += imp.PartnerShareIDR
			}
		}
	}
	return b
}
