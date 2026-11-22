package repository

import (
	"context"
	"errors"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"wifiads/internal/model"
	"wifiads/pkg/apperror"
	"wifiads/pkg/utils"
)

type CampaignFilter struct {
	Page         int
	PerPage      int
	AdvertiserID string
	OnlyPaid     bool
	Status       string
	Search       string
}

type TopupFilter struct {
	Page         int
	PerPage      int
	AdvertiserID string
	Status       string
	Search       string
}

type WalletTxFilter struct {
	Page         int
	PerPage      int
	AdvertiserID string
	Type         string
}

type MarketplaceRepository interface {
	// Location Tiers & Platform Settings & Payment Methods
	ListLocationTiers(ctx context.Context, onlyActive bool) ([]model.LocationTier, error)
	FindLocationTierByID(ctx context.Context, id string) (*model.LocationTier, error)
	CreateLocationTier(ctx context.Context, tier *model.LocationTier) error
	UpdateLocationTier(ctx context.Context, tier *model.LocationTier) error
	DeleteLocationTier(ctx context.Context, id string) error

	GetPlatformSetting(ctx context.Context) (*model.PlatformAdSetting, error)
	SavePlatformSetting(ctx context.Context, setting *model.PlatformAdSetting) error

	ListPaymentMethods(ctx context.Context, onlyActive bool) ([]model.PaymentMethod, error)
	FindPaymentMethodByID(ctx context.Context, id string) (*model.PaymentMethod, error)
	CreatePaymentMethod(ctx context.Context, pm *model.PaymentMethod) error
	UpdatePaymentMethod(ctx context.Context, pm *model.PaymentMethod) error
	DeletePaymentMethod(ctx context.Context, id string) error

	// Advertisers
	CreateAdvertiser(ctx context.Context, adv *model.Advertiser) error
	FindAdvertiserByEmail(ctx context.Context, email string) (*model.Advertiser, error)
	FindAdvertiserByID(ctx context.Context, id string) (*model.Advertiser, error)
	FindAdvertisersByIDs(ctx context.Context, ids []string) (map[string]model.Advertiser, error)
	UpdateAdvertiser(ctx context.Context, adv *model.Advertiser) error
	TouchAdvertiserLogin(ctx context.Context, id string, at time.Time) error
	ListAdvertisers(ctx context.Context, page, perPage int, search string) ([]model.Advertiser, int64, error)

	// Campaigns & Router Targeting
	CreateCampaignWithRouters(ctx context.Context, ad *model.Advertisement, routerIDs []string) error
	UpdateCampaignWithRouters(ctx context.Context, ad *model.Advertisement, routerIDs []string) error
	FindCampaignByID(ctx context.Context, id string) (*model.Advertisement, error)
	ListCampaigns(ctx context.Context, filter CampaignFilter) ([]model.Advertisement, int64, error)
	GetTargetRouterIDsByAdIDs(ctx context.Context, adIDs []string) (map[string][]string, error)
	UpdateCampaign(ctx context.Context, ad *model.Advertisement) error
	DeleteCampaign(ctx context.Context, id string, advertiserID string) error
	CountCampaignsByAdvertiser(ctx context.Context, advertiserID string) (active int64, pending int64, err error)
	DailySpentByAdIDs(ctx context.Context, adIDs []string, since time.Time) (map[string]int64, error)

	// Ad Delivery, Billing & Clicks
	SelectEligibleCampaignForRouter(ctx context.Context, routerID string, multiplier float64, setting *model.PlatformAdSetting, localNow time.Time) (*model.Advertisement, int64, error)
	TouchCampaignLastShown(ctx context.Context, adID string, at time.Time) error
	AssignSessionAd(ctx context.Context, sessionID string, adID string, costSnapshotIDR int64) error
	SettlePortalSessionAd(ctx context.Context, sessionID string, now time.Time) (*model.Advertisement, error)
	RecordAdClickByPortalSession(ctx context.Context, sessionID string, now time.Time) (string, error)

	// Wallet & Top-Up
	CreateTopupInvoice(ctx context.Context, inv *model.TopupInvoice) error
	FindTopupByID(ctx context.Context, id string) (*model.TopupInvoice, error)
	UpdateTopupInvoice(ctx context.Context, inv *model.TopupInvoice) error
	ListTopupInvoices(ctx context.Context, filter TopupFilter) ([]model.TopupInvoice, int64, error)
	VerifyTopupInvoice(ctx context.Context, invoiceID, adminID string, approve bool, adminNote string, now time.Time) (*model.TopupInvoice, error)
	AdminAdjustBalance(ctx context.Context, advertiserID string, amountIDR int64, description string, now time.Time) (*model.Advertiser, error)
	ListWalletTransactions(ctx context.Context, filter WalletTxFilter) ([]model.WalletTransaction, int64, error)

	// Analytics & Traffic Helpers
	ListImpressionsSince(ctx context.Context, advertiserID, campaignID, routerID string, since time.Time) ([]model.AdImpression, error)
	CountVisitorsByRouterSince(ctx context.Context, since time.Time) (map[string]int64, error)
}

type marketplaceRepository struct {
	db *gorm.DB
}

func NewMarketplaceRepository(db *gorm.DB) MarketplaceRepository {
	return &marketplaceRepository{db: db}
}

// ==================== TIERS, SETTINGS & PAYMENT METHODS ====================

func (r *marketplaceRepository) ListLocationTiers(ctx context.Context, onlyActive bool) ([]model.LocationTier, error) {
	var items []model.LocationTier
	q := r.db.WithContext(ctx).Order("sort_order ASC, multiplier ASC")
	if onlyActive {
		q = q.Where("is_active = ?", true)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *marketplaceRepository) FindLocationTierByID(ctx context.Context, id string) (*model.LocationTier, error) {
	var item model.LocationTier
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&item).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &item, nil
}

func (r *marketplaceRepository) CreateLocationTier(ctx context.Context, tier *model.LocationTier) error {
	return r.db.WithContext(ctx).Create(tier).Error
}

func (r *marketplaceRepository) UpdateLocationTier(ctx context.Context, tier *model.LocationTier) error {
	return r.db.WithContext(ctx).Save(tier).Error
}

func (r *marketplaceRepository) DeleteLocationTier(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.LocationTier{}).Error
}

func (r *marketplaceRepository) GetPlatformSetting(ctx context.Context) (*model.PlatformAdSetting, error) {
	var item model.PlatformAdSetting
	err := r.db.WithContext(ctx).Order("created_at ASC").First(&item).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			now := time.Now().UTC()
			def := model.PlatformAdSetting{
				Base:                       model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
				BasePriceImageIDR:          50,
				BasePriceVideoIDR:          50,
				MaxAdDurationSeconds:       30,
				MinTopupAmountIDR:          50000,
				DefaultPartnerSharePercent: 20,
				MinWithdrawalAmountIDR:     50000,
				RequireAdApproval:          true,
			}
			_ = r.db.WithContext(ctx).Create(&def).Error
			return &def, nil
		}
		return nil, err
	}
	return &item, nil
}

func (r *marketplaceRepository) SavePlatformSetting(ctx context.Context, setting *model.PlatformAdSetting) error {
	return r.db.WithContext(ctx).Save(setting).Error
}

func (r *marketplaceRepository) ListPaymentMethods(ctx context.Context, onlyActive bool) ([]model.PaymentMethod, error) {
	var items []model.PaymentMethod
	q := r.db.WithContext(ctx).Order("sort_order ASC, created_at ASC")
	if onlyActive {
		q = q.Where("is_active = ?", true)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *marketplaceRepository) FindPaymentMethodByID(ctx context.Context, id string) (*model.PaymentMethod, error) {
	var item model.PaymentMethod
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&item).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &item, nil
}

func (r *marketplaceRepository) CreatePaymentMethod(ctx context.Context, pm *model.PaymentMethod) error {
	return r.db.WithContext(ctx).Create(pm).Error
}

func (r *marketplaceRepository) UpdatePaymentMethod(ctx context.Context, pm *model.PaymentMethod) error {
	return r.db.WithContext(ctx).Save(pm).Error
}

func (r *marketplaceRepository) DeletePaymentMethod(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.PaymentMethod{}).Error
}

// ==================== ADVERTISERS ====================

func (r *marketplaceRepository) CreateAdvertiser(ctx context.Context, adv *model.Advertiser) error {
	if err := r.db.WithContext(ctx).Create(adv).Error; err != nil {
		if isUniqueViolation(err) {
			return apperror.New(apperror.ErrAlreadyExists, "Email sudah terdaftar")
		}
		return err
	}
	return nil
}

func (r *marketplaceRepository) FindAdvertiserByEmail(ctx context.Context, email string) (*model.Advertiser, error) {
	var adv model.Advertiser
	if err := r.db.WithContext(ctx).Where("LOWER(email) = LOWER(?)", strings.TrimSpace(email)).First(&adv).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &adv, nil
}

func (r *marketplaceRepository) FindAdvertiserByID(ctx context.Context, id string) (*model.Advertiser, error) {
	var adv model.Advertiser
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&adv).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &adv, nil
}

func (r *marketplaceRepository) FindAdvertisersByIDs(ctx context.Context, ids []string) (map[string]model.Advertiser, error) {
	out := make(map[string]model.Advertiser)
	if len(ids) == 0 {
		return out, nil
	}
	var list []model.Advertiser
	if err := r.db.WithContext(ctx).Where("id IN ?", ids).Find(&list).Error; err != nil {
		return nil, err
	}
	for _, item := range list {
		out[item.ID] = item
	}
	return out, nil
}

func (r *marketplaceRepository) UpdateAdvertiser(ctx context.Context, adv *model.Advertiser) error {
	return r.db.WithContext(ctx).Save(adv).Error
}

func (r *marketplaceRepository) TouchAdvertiserLogin(ctx context.Context, id string, at time.Time) error {
	return r.db.WithContext(ctx).Model(&model.Advertiser{}).Where("id = ?", id).Update("last_login_at", at).Error
}

func (r *marketplaceRepository) ListAdvertisers(ctx context.Context, page, perPage int, search string) ([]model.Advertiser, int64, error) {
	_, limit, offset := utils.NormalizePage(page, perPage)
	q := r.db.WithContext(ctx).Model(&model.Advertiser{})
	if s := strings.TrimSpace(search); s != "" {
		like := "%" + s + "%"
		q = q.Where("name ILIKE ? OR company_name ILIKE ? OR email ILIKE ? OR phone ILIKE ?", like, like, like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.Advertiser
	if err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// ==================== CAMPAIGNS ====================

func (r *marketplaceRepository) CreateCampaignWithRouters(ctx context.Context, ad *model.Advertisement, routerIDs []string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(ad).Error; err != nil {
			return err
		}
		now := time.Now().UTC()
		seen := make(map[string]bool)
		mappings := make([]model.AdvertisementRouter, 0, len(routerIDs))
		for _, rid := range routerIDs {
			rid = strings.TrimSpace(rid)
			if rid == "" || seen[rid] {
				continue
			}
			seen[rid] = true
			mappings = append(mappings, model.AdvertisementRouter{
				ID:              uuid.NewString(),
				AdvertisementID: ad.ID,
				RouterID:        rid,
				CreatedAt:       now,
			})
		}
		if len(mappings) > 0 {
			if err := tx.Create(&mappings).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *marketplaceRepository) FindCampaignByID(ctx context.Context, id string) (*model.Advertisement, error) {
	var ad model.Advertisement
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&ad).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &ad, nil
}

func (r *marketplaceRepository) ListCampaigns(ctx context.Context, filter CampaignFilter) ([]model.Advertisement, int64, error) {
	_, limit, offset := utils.NormalizePage(filter.Page, filter.PerPage)
	q := r.db.WithContext(ctx).Model(&model.Advertisement{})
	if filter.AdvertiserID != "" {
		q = q.Where("advertiser_id = ?", filter.AdvertiserID)
	} else if filter.OnlyPaid {
		q = q.Where("advertiser_id IS NOT NULL")
	}
	if filter.Status != "" {
		q = q.Where("status = ?", filter.Status)
	}
	if s := strings.TrimSpace(filter.Search); s != "" {
		like := "%" + s + "%"
		q = q.Where("title ILIKE ? OR body ILIKE ?", like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.Advertisement
	if err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *marketplaceRepository) GetTargetRouterIDsByAdIDs(ctx context.Context, adIDs []string) (map[string][]string, error) {
	out := make(map[string][]string)
	if len(adIDs) == 0 {
		return out, nil
	}
	var rows []model.AdvertisementRouter
	if err := r.db.WithContext(ctx).Where("advertisement_id IN ?", adIDs).Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.AdvertisementID] = append(out[row.AdvertisementID], row.RouterID)
	}
	return out, nil
}

func (r *marketplaceRepository) UpdateCampaign(ctx context.Context, ad *model.Advertisement) error {
	return r.db.WithContext(ctx).Save(ad).Error
}

func (r *marketplaceRepository) UpdateCampaignWithRouters(ctx context.Context, ad *model.Advertisement, routerIDs []string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(ad).Error; err != nil {
			return err
		}
		if err := tx.Where("advertisement_id = ?", ad.ID).Delete(&model.AdvertisementRouter{}).Error; err != nil {
			return err
		}
		now := time.Now().UTC()
		seen := make(map[string]bool)
		mappings := make([]model.AdvertisementRouter, 0, len(routerIDs))
		for _, rid := range routerIDs {
			rid = strings.TrimSpace(rid)
			if rid == "" || seen[rid] {
				continue
			}
			seen[rid] = true
			mappings = append(mappings, model.AdvertisementRouter{
				ID:              uuid.NewString(),
				AdvertisementID: ad.ID,
				RouterID:        rid,
				CreatedAt:       now,
			})
		}
		if len(mappings) > 0 {
			if err := tx.Create(&mappings).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *marketplaceRepository) DeleteCampaign(ctx context.Context, id string, advertiserID string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		q := tx.Where("id = ?", id)
		if advertiserID != "" {
			q = q.Where("advertiser_id = ?", advertiserID)
		}
		res := q.Delete(&model.Advertisement{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return apperror.ErrNotFound
		}
		return tx.Where("advertisement_id = ?", id).Delete(&model.AdvertisementRouter{}).Error
	})
}

func (r *marketplaceRepository) CountCampaignsByAdvertiser(ctx context.Context, advertiserID string) (int64, int64, error) {
	var active, pending int64
	if err := r.db.WithContext(ctx).Model(&model.Advertisement{}).
		Where("advertiser_id = ? AND status = ?", advertiserID, model.AdStatusActive).
		Count(&active).Error; err != nil {
		return 0, 0, err
	}
	if err := r.db.WithContext(ctx).Model(&model.Advertisement{}).
		Where("advertiser_id = ? AND status = ?", advertiserID, model.AdStatusPendingReview).
		Count(&pending).Error; err != nil {
		return 0, 0, err
	}
	return active, pending, nil
}

func (r *marketplaceRepository) DailySpentByAdIDs(ctx context.Context, adIDs []string, since time.Time) (map[string]int64, error) {
	out := make(map[string]int64)
	if len(adIDs) == 0 {
		return out, nil
	}
	type row struct {
		AdvertisementID string
		Total           int64
	}
	var rows []row
	if err := r.db.WithContext(ctx).Model(&model.AdImpression{}).
		Select("advertisement_id, COALESCE(SUM(cost_charged_id_r), 0) AS total").
		Where("advertisement_id IN ? AND created_at >= ?", adIDs, since).
		Group("advertisement_id").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, item := range rows {
		out[item.AdvertisementID] = item.Total
	}
	return out, nil
}

// ==================== AD SELECTION, ATOMIC BILLING & CLICKS ====================

func (r *marketplaceRepository) SelectEligibleCampaignForRouter(
	ctx context.Context,
	routerID string,
	multiplier float64,
	setting *model.PlatformAdSetting,
	localNow time.Time,
) (*model.Advertisement, int64, error) {
	if routerID == "" {
		return nil, 0, apperror.ErrNotFound
	}
	if multiplier <= 0 {
		multiplier = 1.0
	}

	var candidates []model.Advertisement
	err := r.db.WithContext(ctx).
		Table("app.advertisements AS a").
		Select("a.*").
		Joins("JOIN app.advertisement_routers ar ON ar.advertisement_id = a.id").
		Joins("JOIN app.advertisers adv ON adv.id = a.advertiser_id").
		Where("ar.router_id = ? AND a.status = ? AND a.is_active = ? AND adv.is_active = ? AND a.deleted_at IS NULL AND adv.deleted_at IS NULL",
			routerID, model.AdStatusActive, true, true).
		Order("a.last_shown_at ASC NULLS FIRST, a.created_at ASC").
		Limit(30).
		Find(&candidates).Error
	if err != nil {
		return nil, 0, err
	}
	if len(candidates) == 0 {
		return nil, 0, apperror.ErrNotFound
	}

	advIDs := make([]string, 0, len(candidates))
	adIDs := make([]string, 0, len(candidates))
	for _, c := range candidates {
		adIDs = append(adIDs, c.ID)
		if c.AdvertiserID != nil {
			advIDs = append(advIDs, *c.AdvertiserID)
		}
	}

	advMap, err := r.FindAdvertisersByIDs(ctx, advIDs)
	if err != nil {
		return nil, 0, err
	}

	startOfLocalDay := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, localNow.Location())
	dailySpentMap, err := r.DailySpentByAdIDs(ctx, adIDs, startOfLocalDay.UTC())
	if err != nil {
		return nil, 0, err
	}

	hour := localNow.Hour()
	isoDay := int(localNow.Weekday())
	if isoDay == 0 {
		isoDay = 7 // Sunday = 7
	}
	isoDayStr := strconv.Itoa(isoDay)

	for i := range candidates {
		ad := &candidates[i]
		if ad.AdvertiserID == nil {
			continue
		}
		adv, ok := advMap[*ad.AdvertiserID]
		if !ok || !adv.IsActive {
			continue
		}

		// Check date window
		if ad.StartDate != nil {
			sd := ad.StartDate.In(localNow.Location())
			startBound := time.Date(sd.Year(), sd.Month(), sd.Day(), 0, 0, 0, 0, localNow.Location())
			if localNow.Before(startBound) {
				continue
			}
		}
		if ad.EndDate != nil {
			ed := ad.EndDate.In(localNow.Location())
			endBound := time.Date(ed.Year(), ed.Month(), ed.Day(), 23, 59, 59, 0, localNow.Location())
			if localNow.After(endBound) {
				continue
			}
		}

		// Check hour window
		endH := ad.EndHour
		if endH <= 0 {
			endH = 24
		}
		if hour < ad.StartHour || hour >= endH {
			continue
		}

		// Check active weekday
		if days := strings.TrimSpace(ad.ActiveDays); days != "" {
			matchedDay := false
			for _, part := range strings.Split(days, ",") {
				if strings.TrimSpace(part) == isoDayStr {
					matchedDay = true
					break
				}
			}
			if !matchedDay {
				continue
			}
		}

		// Calculate exact unit price
		basePrice := setting.BasePriceImageIDR
		if strings.EqualFold(ad.MediaType, "video") {
			basePrice = setting.BasePriceVideoIDR
		}
		unitCost := int64(math.Round(float64(basePrice) * multiplier))
		if unitCost < 1 {
			unitCost = 1
		}

		// Check wallet balance & campaign caps
		if adv.WalletBalanceIDR < unitCost {
			continue
		}
		if ad.TotalBudgetIDR > 0 && ad.SpentAmountIDR+unitCost > ad.TotalBudgetIDR {
			continue
		}
		if ad.DailyBudgetIDR > 0 && dailySpentMap[ad.ID]+unitCost > ad.DailyBudgetIDR {
			continue
		}

		return ad, unitCost, nil
	}

	return nil, 0, apperror.ErrNotFound
}

func (r *marketplaceRepository) TouchCampaignLastShown(ctx context.Context, adID string, at time.Time) error {
	return r.db.WithContext(ctx).Model(&model.Advertisement{}).Where("id = ?", adID).Update("last_shown_at", at).Error
}

func (r *marketplaceRepository) AssignSessionAd(ctx context.Context, sessionID string, adID string, costSnapshotIDR int64) error {
	return r.db.WithContext(ctx).Model(&model.PortalSession{}).
		Where("id = ?", sessionID).
		Updates(map[string]any{
			"advertisement_id":      adID,
			"ad_cost_snapshot_id_r": costSnapshotIDR,
		}).Error
}

func (r *marketplaceRepository) SettlePortalSessionAd(ctx context.Context, sessionID string, now time.Time) (*model.Advertisement, error) {
	var settledAd *model.Advertisement
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var sess model.PortalSession
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", sessionID).
			First(&sess).Error; err != nil {
			return translateNotFound(err)
		}
		if sess.AdvertisementID == nil || *sess.AdvertisementID == "" {
			return nil
		}

		var ad model.Advertisement
		if err := tx.Where("id = ?", *sess.AdvertisementID).First(&ad).Error; err != nil {
			return nil
		}
		settledAd = &ad

		// Idempotency guard: already billed
		if sess.AdBilledAt != nil {
			return nil
		}
		var existingImpCount int64
		if err := tx.Model(&model.AdImpression{}).Where("portal_session_id = ?", sess.ID).Count(&existingImpCount).Error; err != nil {
			return err
		}
		if existingImpCount > 0 {
			return tx.Model(&model.PortalSession{}).Where("id = ?", sess.ID).Update("ad_billed_at", now).Error
		}

		charged := int64(0)
		cost := sess.AdCostSnapshotIDR

		if ad.AdvertiserID != nil && *ad.AdvertiserID != "" && cost > 0 {
			// Atomic conditional wallet deduction to prevent negative balances under concurrency
			deductRes := tx.Model(&model.Advertiser{}).
				Where("id = ? AND wallet_balance_id_r >= ?", *ad.AdvertiserID, cost).
				Updates(map[string]any{
					"wallet_balance_id_r": gorm.Expr("wallet_balance_id_r - ?", cost),
					"updated_at":          now,
				})
			if deductRes.Error != nil {
				return deductRes.Error
			}
			if deductRes.RowsAffected > 0 {
				charged = cost
				var updatedAdv model.Advertiser
				if err := tx.Select("wallet_balance_id_r").Where("id = ?", *ad.AdvertiserID).First(&updatedAdv).Error; err != nil {
					return err
				}
				wtx := model.WalletTransaction{
					ID:              uuid.NewString(),
					AdvertiserID:    *ad.AdvertiserID,
					Type:            model.WalletTxAdImpression,
					AmountIDR:       -charged,
					BalanceAfterIDR: updatedAdv.WalletBalanceIDR,
					ReferenceType:   "CAMPAIGN",
					ReferenceID:     ad.ID,
					Description:     "Penayangan iklan: " + ad.Title,
					CreatedAt:       now,
				}
				if err := tx.Create(&wtx).Error; err != nil {
					return err
				}
			}
		}

		var partnerIDPtr *string
		partnerShare := int64(0)
		platformShare := charged

		if charged > 0 && sess.RouterID != "" {
			var rtr model.Router
			if rErr := tx.Select("id, partner_id").Where("id = ?", sess.RouterID).First(&rtr).Error; rErr == nil && rtr.PartnerID != nil && *rtr.PartnerID != "" {
				var partner model.Partner
				if pErr := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
					Where("id = ? AND is_active = ?", *rtr.PartnerID, true).
					First(&partner).Error; pErr == nil {
					pIDCopy := partner.ID
					partnerIDPtr = &pIDCopy
					pct := partner.RevenueSharePercent
					if pct < 0 {
						pct = 0
					}
					if pct > 95 {
						pct = 95
					}
					partnerShare = int64(math.Round(float64(charged) * pct / 100.0))
					if partnerShare > charged {
						partnerShare = charged
					}
					if partnerShare < 0 {
						partnerShare = 0
					}
					platformShare = charged - partnerShare

					if partnerShare > 0 {
						newPartnerBal := partner.WalletBalanceIDR + partnerShare
						if err := tx.Model(&model.Partner{}).
							Where("id = ?", partner.ID).
							Updates(map[string]any{
								"wallet_balance_id_r": gorm.Expr("wallet_balance_id_r + ?", partnerShare),
								"total_earned_id_r":   gorm.Expr("total_earned_id_r + ?", partnerShare),
								"updated_at":          now,
							}).Error; err != nil {
							return err
						}
						ptx := model.PartnerWalletTransaction{
							ID:              uuid.NewString(),
							PartnerID:       partner.ID,
							Type:            model.PartnerTxAdRevenue,
							AmountIDR:       partnerShare,
							BalanceAfterIDR: newPartnerBal,
							ReferenceID:     ad.ID,
							Description:     "Pendapatan tayangan iklan: " + ad.Title,
							CreatedAt:       now,
						}
						if err := tx.Create(&ptx).Error; err != nil {
							return err
						}
					}
				}
			}
		}

		imp := model.AdImpression{
			ID:               uuid.NewString(),
			AdvertisementID:  ad.ID,
			AdvertiserID:     ad.AdvertiserID,
			PartnerID:        partnerIDPtr,
			RouterID:         sess.RouterID,
			PortalSessionID:  sess.ID,
			DeviceMAC:        sess.DeviceMAC,
			CostChargedIDR:   charged,
			PartnerShareIDR:  partnerShare,
			PlatformShareIDR: platformShare,
			CreatedAt:        now,
		}
		if err := tx.Create(&imp).Error; err != nil {
			return err
		}

		adUpdates := map[string]any{
			"impressions_count": gorm.Expr("impressions_count + 1"),
			"spent_amount_id_r": gorm.Expr("spent_amount_id_r + ?", charged),
			"updated_at":        now,
		}
		if ad.TotalBudgetIDR > 0 && ad.SpentAmountIDR+charged >= ad.TotalBudgetIDR {
			adUpdates["status"] = model.AdStatusCompleted
		}
		if err := tx.Model(&model.Advertisement{}).Where("id = ?", ad.ID).Updates(adUpdates).Error; err != nil {
			return err
		}

		return tx.Model(&model.PortalSession{}).Where("id = ?", sess.ID).Update("ad_billed_at", now).Error
	})
	return settledAd, err
}

func (r *marketplaceRepository) RecordAdClickByPortalSession(ctx context.Context, sessionID string, now time.Time) (string, error) {
	var targetURL string
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var sess model.PortalSession
		if err := tx.Where("id = ?", sessionID).First(&sess).Error; err != nil {
			return translateNotFound(err)
		}
		if sess.AdvertisementID == nil || *sess.AdvertisementID == "" {
			return apperror.ErrNotFound
		}
		var ad model.Advertisement
		if err := tx.Where("id = ?", *sess.AdvertisementID).First(&ad).Error; err != nil {
			return translateNotFound(err)
		}
		targetURL = strings.TrimSpace(ad.TargetURL)

		// Mark click once per portal session
		res := tx.Model(&model.AdImpression{}).
			Where("portal_session_id = ? AND clicked_at IS NULL", sessionID).
			Update("clicked_at", now)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected > 0 {
			if err := tx.Model(&model.Advertisement{}).
				Where("id = ?", ad.ID).
				Update("clicks_count", gorm.Expr("clicks_count + 1")).Error; err != nil {
				return err
			}
		}
		return nil
	})
	return targetURL, err
}

// ==================== WALLET & TOP-UP ====================

func (r *marketplaceRepository) CreateTopupInvoice(ctx context.Context, inv *model.TopupInvoice) error {
	return r.db.WithContext(ctx).Create(inv).Error
}

func (r *marketplaceRepository) FindTopupByID(ctx context.Context, id string) (*model.TopupInvoice, error) {
	var inv model.TopupInvoice
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&inv).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &inv, nil
}

func (r *marketplaceRepository) UpdateTopupInvoice(ctx context.Context, inv *model.TopupInvoice) error {
	return r.db.WithContext(ctx).Save(inv).Error
}

func (r *marketplaceRepository) ListTopupInvoices(ctx context.Context, filter TopupFilter) ([]model.TopupInvoice, int64, error) {
	_, limit, offset := utils.NormalizePage(filter.Page, filter.PerPage)
	q := r.db.WithContext(ctx).Model(&model.TopupInvoice{})
	if filter.AdvertiserID != "" {
		q = q.Where("advertiser_id = ?", filter.AdvertiserID)
	}
	if filter.Status != "" {
		q = q.Where("status = ?", filter.Status)
	}
	if s := strings.TrimSpace(filter.Search); s != "" {
		like := "%" + s + "%"
		q = q.Where("invoice_number ILIKE ? OR sender_name ILIKE ?", like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.TopupInvoice
	if err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *marketplaceRepository) VerifyTopupInvoice(
	ctx context.Context,
	invoiceID, adminID string,
	approve bool,
	adminNote string,
	now time.Time,
) (*model.TopupInvoice, error) {
	var resultInv *model.TopupInvoice
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var inv model.TopupInvoice
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", invoiceID).
			First(&inv).Error; err != nil {
			return translateNotFound(err)
		}
		if inv.Status == model.TopupStatusPaid {
			return apperror.New(apperror.ErrConflict, "Tagihan Top-Up ini sudah dikonfirmasi sebelumnya")
		}

		var verifier *string
		if adminID != "" {
			verifier = &adminID
		}
		inv.AdminNote = strings.TrimSpace(adminNote)
		inv.VerifiedBy = verifier
		inv.VerifiedAt = &now
		inv.UpdatedAt = now

		if !approve {
			inv.Status = model.TopupStatusRejected
			if err := tx.Save(&inv).Error; err != nil {
				return err
			}
			resultInv = &inv
			return nil
		}

		inv.Status = model.TopupStatusPaid
		if err := tx.Save(&inv).Error; err != nil {
			return err
		}

		if err := tx.Model(&model.Advertiser{}).
			Where("id = ?", inv.AdvertiserID).
			Updates(map[string]any{
				"wallet_balance_id_r": gorm.Expr("wallet_balance_id_r + ?", inv.AmountIDR),
				"updated_at":          now,
			}).Error; err != nil {
			return err
		}

		var updatedAdv model.Advertiser
		if err := tx.Select("wallet_balance_id_r").Where("id = ?", inv.AdvertiserID).First(&updatedAdv).Error; err != nil {
			return err
		}

		wtx := model.WalletTransaction{
			ID:              uuid.NewString(),
			AdvertiserID:    inv.AdvertiserID,
			Type:            model.WalletTxTopup,
			AmountIDR:       inv.AmountIDR,
			BalanceAfterIDR: updatedAdv.WalletBalanceIDR,
			ReferenceType:   "TOPUP_INVOICE",
			ReferenceID:     inv.ID,
			Description:     "Top-Up Saldo (" + inv.InvoiceNumber + ")",
			CreatedAt:       now,
		}
		if err := tx.Create(&wtx).Error; err != nil {
			return err
		}

		resultInv = &inv
		return nil
	})
	return resultInv, err
}

func (r *marketplaceRepository) AdminAdjustBalance(
	ctx context.Context,
	advertiserID string,
	amountIDR int64,
	description string,
	now time.Time,
) (*model.Advertiser, error) {
	var updatedAdv *model.Advertiser
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var adv model.Advertiser
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", advertiserID).
			First(&adv).Error; err != nil {
			return translateNotFound(err)
		}
		newBal := adv.WalletBalanceIDR + amountIDR
		if newBal < 0 {
			return apperror.New(apperror.ErrBadRequest, "Saldo tidak boleh kurang dari Rp 0")
		}
		adv.WalletBalanceIDR = newBal
		adv.UpdatedAt = now
		if err := tx.Save(&adv).Error; err != nil {
			return err
		}
		wtx := model.WalletTransaction{
			ID:              uuid.NewString(),
			AdvertiserID:    adv.ID,
			Type:            model.WalletTxAdminAdjustment,
			AmountIDR:       amountIDR,
			BalanceAfterIDR: newBal,
			ReferenceType:   "ADMIN",
			Description:     strings.TrimSpace(description),
			CreatedAt:       now,
		}
		if err := tx.Create(&wtx).Error; err != nil {
			return err
		}
		updatedAdv = &adv
		return nil
	})
	return updatedAdv, err
}

func (r *marketplaceRepository) ListWalletTransactions(ctx context.Context, filter WalletTxFilter) ([]model.WalletTransaction, int64, error) {
	_, limit, offset := utils.NormalizePage(filter.Page, filter.PerPage)
	q := r.db.WithContext(ctx).Model(&model.WalletTransaction{})
	if filter.AdvertiserID != "" {
		q = q.Where("advertiser_id = ?", filter.AdvertiserID)
	}
	if filter.Type != "" {
		q = q.Where("type = ?", filter.Type)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.WalletTransaction
	if err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// ==================== ANALYTICS & TRAFFIC HELPERS ====================

func (r *marketplaceRepository) ListImpressionsSince(
	ctx context.Context,
	advertiserID, campaignID, routerID string,
	since time.Time,
) ([]model.AdImpression, error) {
	q := r.db.WithContext(ctx).Model(&model.AdImpression{}).Where("created_at >= ?", since)
	if advertiserID != "" {
		q = q.Where("advertiser_id = ?", advertiserID)
	}
	if campaignID != "" {
		q = q.Where("advertisement_id = ?", campaignID)
	}
	if routerID != "" {
		q = q.Where("router_id = ?", routerID)
	}
	var items []model.AdImpression
	if err := q.Order("created_at ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *marketplaceRepository) CountVisitorsByRouterSince(ctx context.Context, since time.Time) (map[string]int64, error) {
	out := make(map[string]int64)
	type row struct {
		RouterID string
		Total    int64
	}
	var rows []row
	if err := r.db.WithContext(ctx).Model(&model.WifiVisitor{}).
		Select("router_id, COUNT(*) AS total").
		Where("created_at >= ?", since).
		Group("router_id").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, item := range rows {
		out[item.RouterID] = item.Total
	}
	return out, nil
}
