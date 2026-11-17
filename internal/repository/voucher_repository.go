package repository

import (
	"context"
	"strings"
	"time"

	"gorm.io/gorm"

	"wifiads/internal/model"
	"wifiads/pkg/apperror"
	"wifiads/pkg/utils"
)

type voucherRepository struct {
	db *gorm.DB
}

// NewVoucherRepository builds the voucher repository.
func NewVoucherRepository(db *gorm.DB) VoucherRepository {
	return &voucherRepository{db: db}
}

func (r *voucherRepository) Create(ctx context.Context, voucher *model.Voucher) error {
	if err := r.db.WithContext(ctx).Create(voucher).Error; err != nil {
		if isUniqueViolation(err) {
			return apperror.ErrAlreadyExists
		}
		return err
	}
	return nil
}

// CreateForPortalSession creates a voucher that belongs to exactly one portal
// session. It enforces the "one portal session = one voucher" rule at the
// database level so that two concurrent Connect clicks can never both succeed:
// the loser receives ErrAlreadyExists and the service returns the winner.
func (r *voucherRepository) CreateForPortalSession(ctx context.Context, voucher *model.Voucher) error {
	if voucher.PortalSessionID == nil || *voucher.PortalSessionID == "" {
		return apperror.New(apperror.ErrBadRequest, "portal_session_id is required")
	}
	tx := r.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return tx.Error
	}

	var count int64
	if err := tx.Model(&model.Voucher{}).
		Where("portal_session_id = ?", *voucher.PortalSessionID).
		Count(&count).Error; err != nil {
		tx.Rollback()
		return err
	}
	if count > 0 {
		tx.Rollback()
		return apperror.ErrAlreadyExists
	}

	if err := tx.Create(voucher).Error; err != nil {
		tx.Rollback()
		if isUniqueViolation(err) {
			return apperror.ErrAlreadyExists
		}
		return err
	}
	return tx.Commit().Error
}

func (r *voucherRepository) FindByUsername(ctx context.Context, username string) (*model.Voucher, error) {
	var voucher model.Voucher
	if err := r.db.WithContext(ctx).Where("username = ?", username).First(&voucher).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &voucher, nil
}

func (r *voucherRepository) FindByUsernames(ctx context.Context, usernames []string) ([]model.Voucher, error) {
	if len(usernames) == 0 {
		return nil, nil
	}
	var vouchers []model.Voucher
	err := r.db.WithContext(ctx).Where("username IN ?", usernames).Find(&vouchers).Error
	return vouchers, err
}

func (r *voucherRepository) FindByID(ctx context.Context, id string) (*model.Voucher, error) {
	var voucher model.Voucher
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&voucher).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &voucher, nil
}

func (r *voucherRepository) FindByPortalSessionID(ctx context.Context, portalSessionID string) (*model.Voucher, error) {
	var voucher model.Voucher
	if err := r.db.WithContext(ctx).
		Where("portal_session_id = ?", portalSessionID).
		Order("created_at ASC").
		First(&voucher).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &voucher, nil
}

func (r *voucherRepository) UpdateStatus(ctx context.Context, id, status string) error {
	return r.db.WithContext(ctx).Model(&model.Voucher{}).
		Where("id = ?", id).
		Update("status", status).Error
}

func (r *voucherRepository) MarkUsed(ctx context.Context, id string, at time.Time) error {
	return r.db.WithContext(ctx).Model(&model.Voucher{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"status":  model.VoucherStatusUsed,
			"used_at": at,
		}).Error
}

func (r *voucherRepository) MarkExpiredBefore(ctx context.Context, now time.Time) (int64, error) {
	result := r.db.WithContext(ctx).Model(&model.Voucher{}).
		Where("status = ? AND expires_at < ?", model.VoucherStatusIssued, now).
		Update("status", model.VoucherStatusExpired)
	if result.Error != nil {
		return 0, result.Error
	}
	return result.RowsAffected, nil
}

func (r *voucherRepository) List(ctx context.Context, filter VoucherFilter) ([]model.Voucher, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Voucher{})

	if search := strings.TrimSpace(filter.Search); search != "" {
		query = query.Where("username ILIKE ?", likePattern(search))
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.RouterID != "" {
		query = query.Where("router_id = ?", filter.RouterID)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var vouchers []model.Voucher
	if err := query.
		Order(orderClause("created_at", filter.Order)).
		Limit(filter.PerPage).
		Offset((filter.Page - 1) * filter.PerPage).
		Find(&vouchers).Error; err != nil {
		return nil, 0, err
	}
	return vouchers, total, nil
}

func (r *voucherRepository) CountByStatus(ctx context.Context) (map[string]int64, error) {
	type row struct {
		Status string
		Total  int64
	}
	var rows []row
	if err := r.db.WithContext(ctx).Model(&model.Voucher{}).
		Select("status, COUNT(*) AS total").
		Group("status").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	result := make(map[string]int64, len(rows))
	for _, item := range rows {
		result[item.Status] = item.Total
	}
	return result, nil
}

func (r *voucherRepository) FindLatestByMAC(ctx context.Context, mac string, routerID string) (*model.Voucher, error) {
	norm := utils.NormalizeMAC(mac)
	if norm == "" {
		return nil, apperror.ErrNotFound
	}
	var voucher model.Voucher
	query := r.db.WithContext(ctx).Where("expected_mac = ?", norm)
	if routerID != "" {
		query = query.Where("router_id = ?", routerID)
	}
	if err := query.Order("created_at DESC").First(&voucher).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &voucher, nil
}

func (r *voucherRepository) UpdatePortalSessionID(ctx context.Context, voucherID string, portalSessionID string) error {
	return r.db.WithContext(ctx).Model(&model.Voucher{}).
		Where("id = ?", voucherID).
		Update("portal_session_id", portalSessionID).Error
}
