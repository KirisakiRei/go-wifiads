package service_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"wifiads/internal/dto"
	"wifiads/internal/model"
	"wifiads/internal/repository"
	"wifiads/internal/service"
	"wifiads/pkg/apperror"
)

type fakeMarketplaceRepo struct {
	setting     *model.PlatformAdSetting
	tiers       map[string]model.LocationTier
	methods     map[string]model.PaymentMethod
	advertisers map[string]*model.Advertiser
	campaigns   map[string]*model.Advertisement
	adRouters   map[string][]string
	topups      map[string]*model.TopupInvoice
	walletTxs   []model.WalletTransaction
}

func newFakeMarketplaceRepo() *fakeMarketplaceRepo {
	now := time.Now().UTC()
	return &fakeMarketplaceRepo{
		setting: &model.PlatformAdSetting{
			Base:                 model.Base{ID: "set-1", CreatedAt: now, UpdatedAt: now},
			BasePriceImageIDR:    50,
			BasePriceVideoIDR:    50,
			MaxAdDurationSeconds: 30,
			MinTopupAmountIDR:    50000,
			RequireAdApproval:    true,
		},
		tiers: map[string]model.LocationTier{
			"tier-15": {
				Base:       model.Base{ID: "tier-15", CreatedAt: now, UpdatedAt: now},
				Name:       "Premium",
				Multiplier: 1.5,
				IsActive:   true,
			},
		},
		methods: map[string]model.PaymentMethod{
			"pm-bca": {
				Base:          model.Base{ID: "pm-bca", CreatedAt: now, UpdatedAt: now},
				Type:          model.PaymentMethodBankTransfer,
				ProviderName:  "Bank BCA",
				AccountNumber: "1234567890",
				AccountHolder: "PT AdWave",
				IsActive:      true,
			},
		},
		advertisers: make(map[string]*model.Advertiser),
		campaigns:   make(map[string]*model.Advertisement),
		adRouters:   make(map[string][]string),
		topups:      make(map[string]*model.TopupInvoice),
	}
}

func (f *fakeMarketplaceRepo) ListLocationTiers(ctx context.Context, onlyActive bool) ([]model.LocationTier, error) {
	out := make([]model.LocationTier, 0, len(f.tiers))
	for _, t := range f.tiers {
		out = append(out, t)
	}
	return out, nil
}
func (f *fakeMarketplaceRepo) FindLocationTierByID(ctx context.Context, id string) (*model.LocationTier, error) {
	if t, ok := f.tiers[id]; ok {
		return &t, nil
	}
	return nil, apperror.ErrNotFound
}
func (f *fakeMarketplaceRepo) CreateLocationTier(ctx context.Context, t *model.LocationTier) error {
	f.tiers[t.ID] = *t
	return nil
}
func (f *fakeMarketplaceRepo) UpdateLocationTier(ctx context.Context, t *model.LocationTier) error {
	f.tiers[t.ID] = *t
	return nil
}
func (f *fakeMarketplaceRepo) DeleteLocationTier(ctx context.Context, id string) error {
	delete(f.tiers, id)
	return nil
}
func (f *fakeMarketplaceRepo) GetPlatformSetting(ctx context.Context) (*model.PlatformAdSetting, error) {
	return f.setting, nil
}
func (f *fakeMarketplaceRepo) SavePlatformSetting(ctx context.Context, s *model.PlatformAdSetting) error {
	f.setting = s
	return nil
}
func (f *fakeMarketplaceRepo) ListPaymentMethods(ctx context.Context, onlyActive bool) ([]model.PaymentMethod, error) {
	out := make([]model.PaymentMethod, 0, len(f.methods))
	for _, m := range f.methods {
		out = append(out, m)
	}
	return out, nil
}
func (f *fakeMarketplaceRepo) FindPaymentMethodByID(ctx context.Context, id string) (*model.PaymentMethod, error) {
	if m, ok := f.methods[id]; ok {
		return &m, nil
	}
	return nil, apperror.ErrNotFound
}
func (f *fakeMarketplaceRepo) CreatePaymentMethod(ctx context.Context, pm *model.PaymentMethod) error {
	f.methods[pm.ID] = *pm
	return nil
}
func (f *fakeMarketplaceRepo) UpdatePaymentMethod(ctx context.Context, pm *model.PaymentMethod) error {
	f.methods[pm.ID] = *pm
	return nil
}
func (f *fakeMarketplaceRepo) DeletePaymentMethod(ctx context.Context, id string) error {
	delete(f.methods, id)
	return nil
}
func (f *fakeMarketplaceRepo) CreateAdvertiser(ctx context.Context, adv *model.Advertiser) error {
	f.advertisers[adv.ID] = adv
	return nil
}
func (f *fakeMarketplaceRepo) FindAdvertiserByEmail(ctx context.Context, email string) (*model.Advertiser, error) {
	for _, a := range f.advertisers {
		if a.Email == email {
			return a, nil
		}
	}
	return nil, apperror.ErrNotFound
}
func (f *fakeMarketplaceRepo) FindAdvertiserByID(ctx context.Context, id string) (*model.Advertiser, error) {
	if a, ok := f.advertisers[id]; ok {
		return a, nil
	}
	return nil, apperror.ErrNotFound
}
func (f *fakeMarketplaceRepo) FindAdvertisersByIDs(ctx context.Context, ids []string) (map[string]model.Advertiser, error) {
	out := make(map[string]model.Advertiser)
	for _, id := range ids {
		if a, ok := f.advertisers[id]; ok {
			out[id] = *a
		}
	}
	return out, nil
}
func (f *fakeMarketplaceRepo) UpdateAdvertiser(ctx context.Context, adv *model.Advertiser) error {
	f.advertisers[adv.ID] = adv
	return nil
}
func (f *fakeMarketplaceRepo) TouchAdvertiserLogin(ctx context.Context, id string, at time.Time) error {
	return nil
}
func (f *fakeMarketplaceRepo) ListAdvertisers(ctx context.Context, page, perPage int, search string) ([]model.Advertiser, int64, error) {
	out := make([]model.Advertiser, 0, len(f.advertisers))
	for _, a := range f.advertisers {
		out = append(out, *a)
	}
	return out, int64(len(out)), nil
}
func (f *fakeMarketplaceRepo) CreateCampaignWithRouters(ctx context.Context, ad *model.Advertisement, routerIDs []string) error {
	f.campaigns[ad.ID] = ad
	f.adRouters[ad.ID] = routerIDs
	return nil
}
func (f *fakeMarketplaceRepo) UpdateCampaignWithRouters(ctx context.Context, ad *model.Advertisement, routerIDs []string) error {
	f.campaigns[ad.ID] = ad
	f.adRouters[ad.ID] = routerIDs
	return nil
}
func (f *fakeMarketplaceRepo) FindCampaignByID(ctx context.Context, id string) (*model.Advertisement, error) {
	if c, ok := f.campaigns[id]; ok {
		return c, nil
	}
	return nil, apperror.ErrNotFound
}
func (f *fakeMarketplaceRepo) ListCampaigns(ctx context.Context, filter repository.CampaignFilter) ([]model.Advertisement, int64, error) {
	out := make([]model.Advertisement, 0)
	for _, c := range f.campaigns {
		if filter.AdvertiserID != "" && (c.AdvertiserID == nil || *c.AdvertiserID != filter.AdvertiserID) {
			continue
		}
		out = append(out, *c)
	}
	return out, int64(len(out)), nil
}
func (f *fakeMarketplaceRepo) GetTargetRouterIDsByAdIDs(ctx context.Context, adIDs []string) (map[string][]string, error) {
	return f.adRouters, nil
}
func (f *fakeMarketplaceRepo) UpdateCampaign(ctx context.Context, ad *model.Advertisement) error {
	f.campaigns[ad.ID] = ad
	return nil
}
func (f *fakeMarketplaceRepo) DeleteCampaign(ctx context.Context, id string, advertiserID string) error {
	delete(f.campaigns, id)
	return nil
}
func (f *fakeMarketplaceRepo) CountCampaignsByAdvertiser(ctx context.Context, advertiserID string) (int64, int64, error) {
	return 0, 0, nil
}
func (f *fakeMarketplaceRepo) DailySpentByAdIDs(ctx context.Context, adIDs []string, since time.Time) (map[string]int64, error) {
	return map[string]int64{}, nil
}
func (f *fakeMarketplaceRepo) SelectEligibleCampaignForRouter(ctx context.Context, routerID string, multiplier float64, setting *model.PlatformAdSetting, localNow time.Time) (*model.Advertisement, int64, error) {
	return nil, 0, apperror.ErrNotFound
}
func (f *fakeMarketplaceRepo) TouchCampaignLastShown(ctx context.Context, adID string, at time.Time) error {
	return nil
}
func (f *fakeMarketplaceRepo) AssignSessionAd(ctx context.Context, sessionID string, adID string, costSnapshotIDR int64) error {
	return nil
}
func (f *fakeMarketplaceRepo) SettlePortalSessionAd(ctx context.Context, sessionID string, now time.Time) (*model.Advertisement, error) {
	return nil, nil
}
func (f *fakeMarketplaceRepo) RecordAdClickByPortalSession(ctx context.Context, sessionID string, now time.Time) (string, error) {
	return "", nil
}
func (f *fakeMarketplaceRepo) CreateTopupInvoice(ctx context.Context, inv *model.TopupInvoice) error {
	f.topups[inv.ID] = inv
	return nil
}
func (f *fakeMarketplaceRepo) FindTopupByID(ctx context.Context, id string) (*model.TopupInvoice, error) {
	if inv, ok := f.topups[id]; ok {
		return inv, nil
	}
	return nil, apperror.ErrNotFound
}
func (f *fakeMarketplaceRepo) UpdateTopupInvoice(ctx context.Context, inv *model.TopupInvoice) error {
	f.topups[inv.ID] = inv
	return nil
}
func (f *fakeMarketplaceRepo) ListTopupInvoices(ctx context.Context, filter repository.TopupFilter) ([]model.TopupInvoice, int64, error) {
	out := make([]model.TopupInvoice, 0, len(f.topups))
	for _, inv := range f.topups {
		out = append(out, *inv)
	}
	return out, int64(len(out)), nil
}
func (f *fakeMarketplaceRepo) VerifyTopupInvoice(ctx context.Context, invoiceID, adminID string, approve bool, adminNote string, now time.Time) (*model.TopupInvoice, error) {
	inv, ok := f.topups[invoiceID]
	if !ok {
		return nil, apperror.ErrNotFound
	}
	if approve {
		inv.Status = model.TopupStatusPaid
		if adv, okAdv := f.advertisers[inv.AdvertiserID]; okAdv {
			adv.WalletBalanceIDR += inv.AmountIDR
		}
	} else {
		inv.Status = model.TopupStatusRejected
	}
	return inv, nil
}
func (f *fakeMarketplaceRepo) AdminAdjustBalance(ctx context.Context, advertiserID string, amountIDR int64, description string, now time.Time) (*model.Advertiser, error) {
	adv := f.advertisers[advertiserID]
	adv.WalletBalanceIDR += amountIDR
	return adv, nil
}
func (f *fakeMarketplaceRepo) ListWalletTransactions(ctx context.Context, filter repository.WalletTxFilter) ([]model.WalletTransaction, int64, error) {
	return f.walletTxs, int64(len(f.walletTxs)), nil
}
func (f *fakeMarketplaceRepo) ListImpressionsSince(ctx context.Context, advertiserID, campaignID, routerID string, since time.Time) ([]model.AdImpression, error) {
	return nil, nil
}
func (f *fakeMarketplaceRepo) CountVisitorsByRouterSince(ctx context.Context, since time.Time) (map[string]int64, error) {
	return map[string]int64{}, nil
}

type fakeRouterListRepo struct {
	routers []model.Router
}

func (f *fakeRouterListRepo) Create(ctx context.Context, r *model.Router) error { return nil }
func (f *fakeRouterListRepo) Update(ctx context.Context, r *model.Router) error { return nil }
func (f *fakeRouterListRepo) FindByID(ctx context.Context, id string) (*model.Router, error) {
	for _, r := range f.routers {
		if r.ID == id {
			return &r, nil
		}
	}
	return nil, apperror.ErrNotFound
}
func (f *fakeRouterListRepo) FindByNASIdentifier(ctx context.Context, n string) (*model.Router, error) {
	return nil, apperror.ErrNotFound
}
func (f *fakeRouterListRepo) ListActive(ctx context.Context) ([]model.Router, error) {
	return f.routers, nil
}
func (f *fakeRouterListRepo) Count(ctx context.Context) (int64, error) {
	return int64(len(f.routers)), nil
}
func (f *fakeRouterListRepo) UpdateVoucherConfig(ctx context.Context, id string, prefix string, digitCount int, numericOnly bool, defaultProfileID *string, surveyProfileID *string, ttlSeconds int, sessionTimeoutSeconds int) error {
	return nil
}

func TestMarketplaceEndToEndFlow(t *testing.T) {
	ctx := context.Background()
	fakeRepo := newFakeMarketplaceRepo()
	tierID := "tier-15"
	lat, lng := -6.2, 106.8
	fakeRouters := &fakeRouterListRepo{
		routers: []model.Router{
			{
				Base:                model.Base{ID: "r-kafe-1"},
				Name:                "Kafe 1",
				NASIdentifier:       "kafe-1",
				Status:              model.RouterStatusActive,
				Latitude:            &lat,
				Longitude:           &lng,
				VenueCategory:       "Kafe",
				LocationTierID:      &tierID,
				IsPublicMarketplace: true,
			},
			{
				Base:                model.Base{ID: "r-kafe-2"},
				Name:                "Kafe 2",
				NASIdentifier:       "kafe-2",
				Status:              model.RouterStatusActive,
				Latitude:            &lat,
				Longitude:           &lng,
				VenueCategory:       "Restoran",
				IsPublicMarketplace: true,
			},
		},
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := service.NewMarketplaceService(fakeRepo, fakeRouters, nil, logger, "0123456789abcdef0123456789abcdef", "wifiads", 24*time.Hour)

	// 1. Register Advertiser
	authRes, err := svc.RegisterAdvertiser(ctx, dto.AdvertiserRegisterRequest{
		Name:        "Kopi Nusantara",
		CompanyName: "PT Kopi Nusantara",
		Email:       "promo@kopi.id",
		Phone:       "08123456789",
		Password:    "rahasia123",
	})
	if err != nil {
		t.Fatalf("RegisterAdvertiser failed: %v", err)
	}
	advID := authRes.Advertiser.ID

	// 2. Check Router Map Multiplier Pricing (Rp 50 * 1.5x = Rp 75)
	points, err := svc.ListMarketplaceRouters(ctx)
	if err != nil || len(points) != 2 {
		t.Fatalf("ListMarketplaceRouters failed: %v (len=%d)", err, len(points))
	}
	if points[0].PriceImageIDR != 75 {
		t.Fatalf("expected PriceImageIDR=75 (50 * 1.5x), got %d", points[0].PriceImageIDR)
	}

	// 3. Reject campaign exceeding MaxAdDurationSeconds (30s)
	_, err = svc.CreateCampaign(ctx, advID, dto.CreateCampaignRequest{
		Title:           "Terlalu Panjang",
		ImageURL:        "https://cdn.example.com/ad.mp4",
		MediaType:       "video",
		LayoutMode:      "landscape",
		DurationSeconds: 60,
		RouterIDs:       []string{"r-kafe-1"},
		StartHour:       8,
		EndHour:         22,
	})
	if err == nil {
		t.Fatalf("expected error for duration > 30s, got nil")
	}

	// 4. Create valid campaign -> enters PENDING_REVIEW
	camp, err := svc.CreateCampaign(ctx, advID, dto.CreateCampaignRequest{
		Title:           "Diskon Kopi 50%",
		Body:            "Klaim hari ini",
		ImageURL:        "https://cdn.example.com/ad.jpg",
		TargetURL:       "https://instagram.com/kopi",
		MediaType:       "image",
		LayoutMode:      "landscape",
		DurationSeconds: 15,
		RouterIDs:       []string{"r-kafe-1"},
		StartHour:       10,
		EndHour:         22,
		DailyBudgetIDR:  25000,
		TotalBudgetIDR:  150000,
	})
	if err != nil {
		t.Fatalf("CreateCampaign failed: %v", err)
	}
	if camp.Status != model.AdStatusPendingReview {
		t.Fatalf("expected status PENDING_REVIEW, got %s", camp.Status)
	}
	if len(camp.TargetRouters) != 1 || camp.TargetRouters[0].UnitPriceIDR != 75 {
		t.Fatalf("expected target router unit price 75, got %+v", camp.TargetRouters)
	}

	// 5. Top-Up Wallet & Admin Verification
	inv, err := svc.CreateTopupInvoice(ctx, advID, dto.CreateTopupRequest{
		AmountIDR:       100000,
		PaymentMethodID: "pm-bca",
		SenderName:      "PT Kopi Nusantara",
		ProofImageURL:   "https://cdn.example.com/bukti.jpg",
	})
	if err != nil {
		t.Fatalf("CreateTopupInvoice failed: %v", err)
	}
	if inv.Status != model.TopupStatusWaitingVerification {
		t.Fatalf("expected status WAITING_VERIFICATION, got %s", inv.Status)
	}

	_, err = svc.AdminVerifyTopup(ctx, "admin-1", inv.ID, dto.AdminVerifyTopupRequest{Action: "APPROVE"})
	if err != nil {
		t.Fatalf("AdminVerifyTopup failed: %v", err)
	}

	prof, err := svc.GetAdvertiserProfile(ctx, advID)
	if err != nil || prof.WalletBalanceIDR != 100000 {
		t.Fatalf("expected WalletBalanceIDR=100000 after topup verification, got %d (err=%v)", prof.WalletBalanceIDR, err)
	}

	// 6. Admin Approves Campaign -> ACTIVE
	approved, err := svc.AdminModerateCampaign(ctx, camp.ID, dto.AdminModerateCampaignRequest{Action: "APPROVE"})
	if err != nil || approved.Status != model.AdStatusActive {
		t.Fatalf("expected status ACTIVE after approval, got %v (err=%v)", approved, err)
	}

	// 7. Advertiser Updates Locations & Schedule (creative unchanged) -> stays ACTIVE with 2 locations
	updatedLoc, err := svc.UpdateCampaign(ctx, advID, camp.ID, dto.UpdateCampaignRequest{
		Title:           "Diskon Kopi 50%",
		Body:            "Klaim hari ini",
		ImageURL:        "https://cdn.example.com/ad.jpg",
		TargetURL:       "https://instagram.com/kopi",
		MediaType:       "image",
		LayoutMode:      "landscape",
		DurationSeconds: 15,
		RouterIDs:       []string{"r-kafe-1", "r-kafe-2"},
		StartHour:       8,
		EndHour:         23,
		DailyBudgetIDR:  35000,
		TotalBudgetIDR:  200000,
	})
	if err != nil {
		t.Fatalf("UpdateCampaign (locations) failed: %v", err)
	}
	if updatedLoc.Status != model.AdStatusActive {
		t.Fatalf("expected status ACTIVE when only locations/schedule changed, got %s", updatedLoc.Status)
	}
	if len(updatedLoc.TargetRouters) != 2 {
		t.Fatalf("expected 2 target routers after update, got %d", len(updatedLoc.TargetRouters))
	}

	// 8. Advertiser Updates Creative (Title + Video R2 URL) -> enters PENDING_REVIEW & normalizes URL
	updatedCreative, err := svc.UpdateCampaign(ctx, advID, camp.ID, dto.UpdateCampaignRequest{
		Title:           "Promo Baru Video",
		Body:            "Klaim hari ini",
		ImageURL:        "https://pub-demo.r2.dev/ads/pengiklan/u1/media/videos/abc.mp4",
		TargetURL:       "https://instagram.com/kopi",
		MediaType:       "video",
		LayoutMode:      "portrait",
		DurationSeconds: 15,
		RouterIDs:       []string{"r-kafe-2"},
		StartHour:       8,
		EndHour:         23,
	})
	if err != nil {
		t.Fatalf("UpdateCampaign (creative) failed: %v", err)
	}
	if updatedCreative.Status != model.AdStatusPendingReview {
		t.Fatalf("expected status PENDING_REVIEW when creative changed, got %s", updatedCreative.Status)
	}
	if updatedCreative.ImageURL != "/uploads/ads/pengiklan/u1/media/videos/abc.mp4" {
		t.Fatalf("expected normalized /uploads/ URL, got %s", updatedCreative.ImageURL)
	}
}

func TestAutoLocationRankingAndPartnerDisplay(t *testing.T) {
	tiers := []model.LocationTier{
		{Base: model.Base{ID: "t-10"}, Name: "Standard", Multiplier: 1.0, MinDailyConnects: 0, MinDailyImpressions: 0, IsActive: true},
		{Base: model.Base{ID: "t-12"}, Name: "Strategis", Multiplier: 1.2, MinDailyConnects: 30, MinDailyImpressions: 25, IsActive: true},
		{Base: model.Base{ID: "t-15"}, Name: "Premium", Multiplier: 1.5, MinDailyConnects: 80, MinDailyImpressions: 70, IsActive: true},
	}

	rAuto := &model.Router{
		Base:             model.Base{ID: "r-auto"},
		Name:             "MK-Internal-01",
		LocationTierAuto: true,
	}

	// Low traffic -> Standard 1.0x
	_, name1, mult1 := service.ResolveEffectiveRouterTier(rAuto, tiers, 10, 8)
	if name1 != "Standard" || mult1 != 1.0 {
		t.Fatalf("expected Standard 1.0x, got %s %.2f", name1, mult1)
	}

	// Medium traffic -> Strategis 1.2x
	_, name2, mult2 := service.ResolveEffectiveRouterTier(rAuto, tiers, 45, 40)
	if name2 != "Strategis" || mult2 != 1.2 {
		t.Fatalf("expected Strategis 1.2x, got %s %.2f", name2, mult2)
	}

	// High traffic -> Premium 1.5x
	_, name3, mult3 := service.ResolveEffectiveRouterTier(rAuto, tiers, 110, 95)
	if name3 != "Premium" || mult3 != 1.5 {
		t.Fatalf("expected Premium 1.5x, got %s %.2f", name3, mult3)
	}

	// Partner Venue Label & Coordinate Inheritance
	pID := "p-kafe-1"
	pLat, pLng := 3.5952, 98.6722
	rAuto.PartnerID = &pID
	partnerMap := map[string]model.Partner{
		pID: {
			Base:          model.Base{ID: pID},
			Name:          "Budi Santoso",
			VenueName:     "Kafe Kopi Medan",
			VenueCategory: "Kafe",
			Address:       "Jl. Merdeka No. 10",
			Latitude:      &pLat,
			Longitude:     &pLng,
		},
	}
	dispName, addr, cat, lat, lng, _ := service.ResolveRouterPartnerDisplay(rAuto, partnerMap)
	if dispName != "Kafe Kopi Medan" || addr != "Jl. Merdeka No. 10" || cat != "Kafe" || lat == nil || *lat != pLat || lng == nil || *lng != pLng {
		t.Fatalf("unexpected partner display inheritance: name=%s addr=%s cat=%s", dispName, addr, cat)
	}
}
