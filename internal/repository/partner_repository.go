package repository

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"wifiads/internal/model"
	"wifiads/pkg/apperror"
	"wifiads/pkg/utils"
)

type WithdrawalFilter struct {
	Page      int
	PerPage   int
	PartnerID string
	Status    string
	Search    string
}

type PartnerTxFilter struct {
	Page      int
	PerPage   int
	PartnerID string
}

type RouterTrafficStat struct {
	TotalConnects7d    int64
	TotalImpressions7d int64
}

type FinanceTotalsSnapshot struct {
	TotalTopupPaidIDR       int64
	PeriodTopupPaidIDR      int64
	WaitingTopupCount       int64
	WaitingTopupIDR         int64
	TotalGrossAdSpendIDR    int64
	TotalPartnerShareIDR    int64
	TotalNetPlatformIDR     int64
	TotalWithdrawalsPaidIDR int64
	PendingWithdrawalsCount int64
	PendingWithdrawalsIDR   int64
	TotalClientWalletIDR    int64
	TotalPartnerWalletIDR   int64
}

type AdvertiserSummaryAgg struct {
	ActiveCampaigns int64
	TotalCampaigns  int64
	TotalTopupIDR   int64
	TotalSpentIDR   int64
}

type PartnerAdVenueStat struct {
	AdvertisementID string
	Impressions     int64
	Clicks          int64
	EarnedIDR       int64
}

type PartnerRepository interface {
	// Partner CRUD
	CreatePartner(ctx context.Context, p *model.Partner) error
	UpdatePartner(ctx context.Context, p *model.Partner) error
	DeletePartner(ctx context.Context, id string) error
	FindPartnerByID(ctx context.Context, id string) (*model.Partner, error)
	FindPartnerByEmail(ctx context.Context, email string) (*model.Partner, error)
	FindPartnersByIDs(ctx context.Context, ids []string) (map[string]model.Partner, error)
	ListAllPartners(ctx context.Context) ([]model.Partner, error)
	ListPartners(ctx context.Context, page, perPage int, search string) ([]model.Partner, int64, error)
	TouchPartnerLogin(ctx context.Context, id string, at time.Time) error
	SyncPartnerLocationToRouters(ctx context.Context, p *model.Partner) error
	ListRoutersByPartnerID(ctx context.Context, partnerID string) ([]model.Router, error)

	// Partner Withdrawals & Ledger
	CreateWithdrawal(ctx context.Context, partnerID string, amountIDR int64, withdrawalNum string, now time.Time) (*model.PartnerWithdrawal, error)
	ProcessWithdrawal(ctx context.Context, withdrawalID, adminID string, approve bool, proofURL, adminNote string, now time.Time) (*model.PartnerWithdrawal, error)
	ListWithdrawals(ctx context.Context, filter WithdrawalFilter) ([]model.PartnerWithdrawal, int64, error)
	ListPartnerTransactions(ctx context.Context, filter PartnerTxFilter) ([]model.PartnerWalletTransaction, int64, error)

	// Partner Portal Queries
	ListAdsTargetingRouters(ctx context.Context, routerIDs []string) ([]model.Advertisement, error)
	GetPartnerAdStatsByRouters(ctx context.Context, partnerID string, routerIDs []string) (map[string]PartnerAdVenueStat, error)
	ListPartnerImpressionsSince(ctx context.Context, partnerID string, routerIDs []string, since time.Time) ([]model.AdImpression, error)
	ListVisitorsByRoutersSince(ctx context.Context, routerIDs []string, since time.Time) ([]model.WifiVisitor, error)

	// Ranking Traffic & Admin Finance / Badges
	GetRouterTraffic7d(ctx context.Context, since time.Time) (map[string]RouterTrafficStat, error)
	GetAdvertiserSummaries(ctx context.Context, advertiserIDs []string) (map[string]AdvertiserSummaryAgg, error)
	GetAdminBadges(ctx context.Context) (pendingCampaigns, waitingTopups, pendingWithdrawals int64, err error)
	GetFinanceTotals(ctx context.Context, periodSince time.Time) (*FinanceTotalsSnapshot, error)
	ListAllImpressionsSince(ctx context.Context, since time.Time) ([]model.AdImpression, error)
}

type partnerRepository struct {
	db *gorm.DB
}

func NewPartnerRepository(db *gorm.DB) PartnerRepository {
	return &partnerRepository{db: db}
}

func (r *partnerRepository) CreatePartner(ctx context.Context, p *model.Partner) error {
	if err := r.db.WithContext(ctx).Create(p).Error; err != nil {
		if isUniqueViolation(err) {
			return apperror.New(apperror.ErrAlreadyExists, "Alamat email mitra sudah terdaftar")
		}
		return err
	}
	return nil
}

func (r *partnerRepository) UpdatePartner(ctx context.Context, p *model.Partner) error {
	if err := r.db.WithContext(ctx).Save(p).Error; err != nil {
		if isUniqueViolation(err) {
			return apperror.New(apperror.ErrAlreadyExists, "Alamat email sudah digunakan mitra lain")
		}
		return err
	}
	return nil
}

func (r *partnerRepository) DeletePartner(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.Router{}).Where("partner_id = ?", id).Update("partner_id", nil).Error; err != nil {
			return err
		}
		res := tx.Where("id = ?", id).Delete(&model.Partner{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return apperror.ErrNotFound
		}
		return nil
	})
}

func (r *partnerRepository) FindPartnerByID(ctx context.Context, id string) (*model.Partner, error) {
	var p model.Partner
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&p).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &p, nil
}

func (r *partnerRepository) FindPartnerByEmail(ctx context.Context, email string) (*model.Partner, error) {
	var p model.Partner
	if err := r.db.WithContext(ctx).Where("LOWER(email) = LOWER(?)", strings.TrimSpace(email)).First(&p).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &p, nil
}

func (r *partnerRepository) FindPartnersByIDs(ctx context.Context, ids []string) (map[string]model.Partner, error) {
	out := make(map[string]model.Partner)
	if len(ids) == 0 {
		return out, nil
	}
	var list []model.Partner
	if err := r.db.WithContext(ctx).Where("id IN ?", ids).Find(&list).Error; err != nil {
		return nil, err
	}
	for _, p := range list {
		out[p.ID] = p
	}
	return out, nil
}

func (r *partnerRepository) ListAllPartners(ctx context.Context) ([]model.Partner, error) {
	var items []model.Partner
	if err := r.db.WithContext(ctx).Order("venue_name ASC, name ASC").Limit(500).Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *partnerRepository) ListPartners(ctx context.Context, page, perPage int, search string) ([]model.Partner, int64, error) {
	_, limit, offset := utils.NormalizePage(page, perPage)
	q := r.db.WithContext(ctx).Model(&model.Partner{})
	if s := strings.TrimSpace(search); s != "" {
		like := "%" + s + "%"
		q = q.Where("name ILIKE ? OR venue_name ILIKE ? OR email ILIKE ? OR phone ILIKE ? OR address ILIKE ?", like, like, like, like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.Partner
	if err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *partnerRepository) TouchPartnerLogin(ctx context.Context, id string, at time.Time) error {
	return r.db.WithContext(ctx).Model(&model.Partner{}).Where("id = ?", id).Update("last_login_at", at).Error
}

func (r *partnerRepository) SyncPartnerLocationToRouters(ctx context.Context, p *model.Partner) error {
	if p == nil || p.ID == "" {
		return nil
	}
	updates := map[string]any{
		"updated_at": time.Now().UTC(),
	}
	if p.Latitude != nil && p.Longitude != nil {
		updates["latitude"] = *p.Latitude
		updates["longitude"] = *p.Longitude
	}
	if strings.TrimSpace(p.Address) != "" {
		updates["location_address"] = strings.TrimSpace(p.Address)
	}
	if strings.TrimSpace(p.VenueCategory) != "" {
		updates["venue_category"] = strings.TrimSpace(p.VenueCategory)
	}
	return r.db.WithContext(ctx).Model(&model.Router{}).Where("partner_id = ?", p.ID).Updates(updates).Error
}

func (r *partnerRepository) ListRoutersByPartnerID(ctx context.Context, partnerID string) ([]model.Router, error) {
	var routers []model.Router
	if err := r.db.WithContext(ctx).
		Where("partner_id = ? AND status = ?", partnerID, model.RouterStatusActive).
		Order("created_at ASC").
		Find(&routers).Error; err != nil {
		return nil, err
	}
	return routers, nil
}

func (r *partnerRepository) CreateWithdrawal(
	ctx context.Context,
	partnerID string,
	amountIDR int64,
	withdrawalNum string,
	now time.Time,
) (*model.PartnerWithdrawal, error) {
	var created *model.PartnerWithdrawal
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var p model.Partner
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", partnerID).
			First(&p).Error; err != nil {
			return translateNotFound(err)
		}
		if strings.TrimSpace(p.BankName) == "" || strings.TrimSpace(p.BankAccountNumber) == "" {
			return apperror.New(apperror.ErrBadRequest, "Lengkapi informasi rekening bank terlebih dahulu di halaman Profil")
		}
		if p.WalletBalanceIDR < amountIDR {
			return apperror.New(apperror.ErrBadRequest, "Saldo pendapatan tidak mencukupi untuk nominal penarikan ini")
		}

		newBal := p.WalletBalanceIDR - amountIDR
		if err := tx.Model(&model.Partner{}).
			Where("id = ?", p.ID).
			Updates(map[string]any{
				"wallet_balance_idr": newBal,
				"updated_at":         now,
			}).Error; err != nil {
			return err
		}

		wd := model.PartnerWithdrawal{
			Base:              model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
			WithdrawalNumber:  withdrawalNum,
			PartnerID:         p.ID,
			AmountIDR:         amountIDR,
			BankName:          p.BankName,
			BankAccountNumber: p.BankAccountNumber,
			BankAccountHolder: p.BankAccountHolder,
			Status:            model.WithdrawalStatusPending,
		}
		if err := tx.Create(&wd).Error; err != nil {
			return err
		}

		ptx := model.PartnerWalletTransaction{
			ID:              uuid.NewString(),
			PartnerID:       p.ID,
			Type:            model.PartnerTxWithdrawal,
			AmountIDR:       -amountIDR,
			BalanceAfterIDR: newBal,
			ReferenceID:     wd.ID,
			Description:     "Pengajuan pencairan dana (" + wd.WithdrawalNumber + ")",
			CreatedAt:       now,
		}
		if err := tx.Create(&ptx).Error; err != nil {
			return err
		}

		created = &wd
		return nil
	})
	return created, err
}

func (r *partnerRepository) ProcessWithdrawal(
	ctx context.Context,
	withdrawalID, adminID string,
	approve bool,
	proofURL, adminNote string,
	now time.Time,
) (*model.PartnerWithdrawal, error) {
	var updated *model.PartnerWithdrawal
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var wd model.PartnerWithdrawal
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", withdrawalID).
			First(&wd).Error; err != nil {
			return translateNotFound(err)
		}
		if wd.Status != model.WithdrawalStatusPending {
			return apperror.New(apperror.ErrConflict, "Pengajuan pencairan ini sudah diproses sebelumnya")
		}

		var procBy *string
		if adminID != "" {
			procBy = &adminID
		}
		wd.AdminNote = strings.TrimSpace(adminNote)
		if pURL := strings.TrimSpace(proofURL); pURL != "" {
			wd.ProofImageURL = pURL
		}
		wd.ProcessedBy = procBy
		wd.ProcessedAt = &now
		wd.UpdatedAt = now

		if approve {
			wd.Status = model.WithdrawalStatusPaid
			if err := tx.Save(&wd).Error; err != nil {
				return err
			}
			updated = &wd
			return nil
		}

		// Rejected: refund balance back to partner
		wd.Status = model.WithdrawalStatusRejected
		if err := tx.Save(&wd).Error; err != nil {
			return err
		}

		var p model.Partner
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", wd.PartnerID).
			First(&p).Error; err != nil {
			return err
		}
		newBal := p.WalletBalanceIDR + wd.AmountIDR
		if err := tx.Model(&model.Partner{}).
			Where("id = ?", p.ID).
			Updates(map[string]any{
				"wallet_balance_idr": newBal,
				"updated_at":         now,
			}).Error; err != nil {
			return err
		}

		ptx := model.PartnerWalletTransaction{
			ID:              uuid.NewString(),
			PartnerID:       p.ID,
			Type:            model.PartnerTxWithdrawalRefund,
			AmountIDR:       wd.AmountIDR,
			BalanceAfterIDR: newBal,
			ReferenceID:     wd.ID,
			Description:     "Pengembalian dana pencairan ditolak (" + wd.WithdrawalNumber + ")",
			CreatedAt:       now,
		}
		if err := tx.Create(&ptx).Error; err != nil {
			return err
		}

		updated = &wd
		return nil
	})
	return updated, err
}

func (r *partnerRepository) ListWithdrawals(ctx context.Context, filter WithdrawalFilter) ([]model.PartnerWithdrawal, int64, error) {
	_, limit, offset := utils.NormalizePage(filter.Page, filter.PerPage)
	q := r.db.WithContext(ctx).Model(&model.PartnerWithdrawal{})
	if filter.PartnerID != "" {
		q = q.Where("partner_id = ?", filter.PartnerID)
	}
	if filter.Status != "" {
		q = q.Where("status = ?", filter.Status)
	}
	if s := strings.TrimSpace(filter.Search); s != "" {
		like := "%" + s + "%"
		q = q.Where("withdrawal_number ILIKE ? OR bank_account_holder ILIKE ? OR bank_name ILIKE ?", like, like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.PartnerWithdrawal
	if err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *partnerRepository) ListPartnerTransactions(ctx context.Context, filter PartnerTxFilter) ([]model.PartnerWalletTransaction, int64, error) {
	_, limit, offset := utils.NormalizePage(filter.Page, filter.PerPage)
	q := r.db.WithContext(ctx).Model(&model.PartnerWalletTransaction{})
	if filter.PartnerID != "" {
		q = q.Where("partner_id = ?", filter.PartnerID)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.PartnerWalletTransaction
	if err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *partnerRepository) ListAdsTargetingRouters(ctx context.Context, routerIDs []string) ([]model.Advertisement, error) {
	if len(routerIDs) == 0 {
		return []model.Advertisement{}, nil
	}
	var ads []model.Advertisement
	err := r.db.WithContext(ctx).
		Table("app.advertisements AS a").
		Select("DISTINCT a.*").
		Joins("JOIN app.advertisement_routers ar ON ar.advertisement_id = a.id").
		Where("ar.router_id IN ? AND a.deleted_at IS NULL AND a.status IN ?",
			routerIDs,
			[]string{model.AdStatusActive, model.AdStatusPaused, model.AdStatusCompleted},
		).
		Order("a.created_at DESC").
		Limit(100).
		Find(&ads).Error
	if err != nil {
		return nil, err
	}
	return ads, nil
}

func (r *partnerRepository) GetPartnerAdStatsByRouters(
	ctx context.Context,
	partnerID string,
	routerIDs []string,
) (map[string]PartnerAdVenueStat, error) {
	out := make(map[string]PartnerAdVenueStat)
	if len(routerIDs) == 0 && partnerID == "" {
		return out, nil
	}
	var rows []PartnerAdVenueStat
	q := r.db.WithContext(ctx).Model(&model.AdImpression{}).
		Select("advertisement_id, COUNT(*) AS impressions, COUNT(clicked_at) AS clicks, COALESCE(SUM(partner_share_idr), 0) AS earned_idr")
	if len(routerIDs) > 0 {
		q = q.Where("router_id IN ?", routerIDs)
	} else {
		q = q.Where("partner_id = ?", partnerID)
	}
	if err := q.Group("advertisement_id").Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.AdvertisementID] = row
	}
	return out, nil
}

func (r *partnerRepository) ListPartnerImpressionsSince(
	ctx context.Context,
	partnerID string,
	routerIDs []string,
	since time.Time,
) ([]model.AdImpression, error) {
	var items []model.AdImpression
	q := r.db.WithContext(ctx).Model(&model.AdImpression{}).Where("created_at >= ?", since)
	if len(routerIDs) > 0 {
		q = q.Where("(partner_id = ? OR router_id IN ?)", partnerID, routerIDs)
	} else {
		q = q.Where("partner_id = ?", partnerID)
	}
	if err := q.Order("created_at ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *partnerRepository) ListVisitorsByRoutersSince(
	ctx context.Context,
	routerIDs []string,
	since time.Time,
) ([]model.WifiVisitor, error) {
	if len(routerIDs) == 0 {
		return []model.WifiVisitor{}, nil
	}
	var items []model.WifiVisitor
	if err := r.db.WithContext(ctx).Model(&model.WifiVisitor{}).
		Where("router_id IN ? AND created_at >= ?", routerIDs, since).
		Order("created_at ASC").
		Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *partnerRepository) GetRouterTraffic7d(ctx context.Context, since time.Time) (map[string]RouterTrafficStat, error) {
	out := make(map[string]RouterTrafficStat)
	type row struct {
		RouterID string
		Total    int64
	}
	var connRows []row
	_ = r.db.WithContext(ctx).Model(&model.WifiVisitor{}).
		Select("router_id, COUNT(*) AS total").
		Where("created_at >= ? AND (connected_at IS NOT NULL OR status IN ?)",
			since,
			[]string{model.VisitorStatusConnected, model.VisitorStatusClosed, model.VisitorStatusStale},
		).
		Group("router_id").
		Scan(&connRows).Error
	for _, c := range connRows {
		st := out[c.RouterID]
		st.TotalConnects7d = c.Total
		out[c.RouterID] = st
	}

	// Count all portal sessions where ad played / voucher issued OR ad_impressions recorded
	var impRows []row
	_ = r.db.WithContext(ctx).Model(&model.PortalSession{}).
		Select("router_id, COUNT(*) AS total").
		Where("created_at >= ? AND (ad_billed_at IS NOT NULL OR status = ?)", since, model.PortalSessionStatusVoucherIssued).
		Group("router_id").
		Scan(&impRows).Error
	for _, m := range impRows {
		st := out[m.RouterID]
		st.TotalImpressions7d = m.Total
		out[m.RouterID] = st
	}
	return out, nil
}

func (r *partnerRepository) GetAdvertiserSummaries(ctx context.Context, advertiserIDs []string) (map[string]AdvertiserSummaryAgg, error) {
	out := make(map[string]AdvertiserSummaryAgg)
	if len(advertiserIDs) == 0 {
		return out, nil
	}
	type campRow struct {
		AdvertiserID string
		Status       string
		Count        int64
		Spent        int64
	}
	var campRows []campRow
	_ = r.db.WithContext(ctx).Model(&model.Advertisement{}).
		Select("advertiser_id, status, COUNT(*) AS count, COALESCE(SUM(spent_amount_idr), 0) AS spent").
		Where("advertiser_id IN ?", advertiserIDs).
		Group("advertiser_id, status").
		Scan(&campRows).Error
	for _, row := range campRows {
		agg := out[row.AdvertiserID]
		agg.TotalCampaigns += row.Count
		agg.TotalSpentIDR += row.Spent
		if row.Status == model.AdStatusActive {
			agg.ActiveCampaigns += row.Count
		}
		out[row.AdvertiserID] = agg
	}

	type topRow struct {
		AdvertiserID string
		Total        int64
	}
	var topRows []topRow
	_ = r.db.WithContext(ctx).Model(&model.TopupInvoice{}).
		Select("advertiser_id, COALESCE(SUM(amount_idr), 0) AS total").
		Where("advertiser_id IN ? AND status = ?", advertiserIDs, model.TopupStatusPaid).
		Group("advertiser_id").
		Scan(&topRows).Error
	for _, row := range topRows {
		agg := out[row.AdvertiserID]
		agg.TotalTopupIDR = row.Total
		out[row.AdvertiserID] = agg
	}

	return out, nil
}

func (r *partnerRepository) GetAdminBadges(ctx context.Context) (int64, int64, int64, error) {
	var pendingCamps, waitingTopups, pendingWds int64
	if err := r.db.WithContext(ctx).Model(&model.Advertisement{}).
		Where("advertiser_id IS NOT NULL AND status = ?", model.AdStatusPendingReview).
		Count(&pendingCamps).Error; err != nil {
		return 0, 0, 0, err
	}
	if err := r.db.WithContext(ctx).Model(&model.TopupInvoice{}).
		Where("status = ?", model.TopupStatusWaitingVerification).
		Count(&waitingTopups).Error; err != nil {
		return 0, 0, 0, err
	}
	if err := r.db.WithContext(ctx).Model(&model.PartnerWithdrawal{}).
		Where("status = ?", model.WithdrawalStatusPending).
		Count(&pendingWds).Error; err != nil {
		return 0, 0, 0, err
	}
	return pendingCamps, waitingTopups, pendingWds, nil
}

func (r *partnerRepository) GetFinanceTotals(ctx context.Context, periodSince time.Time) (*FinanceTotalsSnapshot, error) {
	snap := &FinanceTotalsSnapshot{}

	_ = r.db.WithContext(ctx).Model(&model.TopupInvoice{}).
		Select("COALESCE(SUM(amount_idr), 0)").
		Where("status = ?", model.TopupStatusPaid).
		Scan(&snap.TotalTopupPaidIDR).Error

	_ = r.db.WithContext(ctx).Model(&model.TopupInvoice{}).
		Select("COALESCE(SUM(amount_idr), 0)").
		Where("status = ? AND verified_at >= ?", model.TopupStatusPaid, periodSince).
		Scan(&snap.PeriodTopupPaidIDR).Error

	_ = r.db.WithContext(ctx).Model(&model.TopupInvoice{}).
		Where("status = ?", model.TopupStatusWaitingVerification).
		Count(&snap.WaitingTopupCount).Error

	_ = r.db.WithContext(ctx).Model(&model.TopupInvoice{}).
		Select("COALESCE(SUM(amount_idr), 0)").
		Where("status = ?", model.TopupStatusWaitingVerification).
		Scan(&snap.WaitingTopupIDR).Error

	type impTotals struct {
		Gross    int64
		Partner  int64
		Platform int64
	}
	var allImp impTotals
	_ = r.db.WithContext(ctx).Model(&model.AdImpression{}).
		Select("COALESCE(SUM(cost_charged_idr), 0) AS gross, COALESCE(SUM(partner_share_idr), 0) AS partner, COALESCE(SUM(CASE WHEN platform_share_idr > 0 OR partner_share_idr > 0 THEN platform_share_idr ELSE cost_charged_idr END), 0) AS platform").
		Scan(&allImp).Error
	snap.TotalGrossAdSpendIDR = allImp.Gross
	snap.TotalPartnerShareIDR = allImp.Partner
	snap.TotalNetPlatformIDR = allImp.Platform

	_ = r.db.WithContext(ctx).Model(&model.PartnerWithdrawal{}).
		Select("COALESCE(SUM(amount_idr), 0)").
		Where("status = ?", model.WithdrawalStatusPaid).
		Scan(&snap.TotalWithdrawalsPaidIDR).Error

	_ = r.db.WithContext(ctx).Model(&model.PartnerWithdrawal{}).
		Where("status = ?", model.WithdrawalStatusPending).
		Count(&snap.PendingWithdrawalsCount).Error

	_ = r.db.WithContext(ctx).Model(&model.PartnerWithdrawal{}).
		Select("COALESCE(SUM(amount_idr), 0)").
		Where("status = ?", model.WithdrawalStatusPending).
		Scan(&snap.PendingWithdrawalsIDR).Error

	_ = r.db.WithContext(ctx).Model(&model.Advertiser{}).
		Select("COALESCE(SUM(wallet_balance_idr), 0)").
		Scan(&snap.TotalClientWalletIDR).Error

	_ = r.db.WithContext(ctx).Model(&model.Partner{}).
		Select("COALESCE(SUM(wallet_balance_idr), 0)").
		Scan(&snap.TotalPartnerWalletIDR).Error

	return snap, nil
}

func (r *partnerRepository) ListAllImpressionsSince(ctx context.Context, since time.Time) ([]model.AdImpression, error) {
	var items []model.AdImpression
	if err := r.db.WithContext(ctx).Model(&model.AdImpression{}).
		Where("created_at >= ?", since).
		Order("created_at ASC").
		Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}
