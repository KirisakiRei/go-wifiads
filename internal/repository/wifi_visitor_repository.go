package repository

import (
	"context"
	"strings"
	"time"

	"gorm.io/gorm"

	"wifiads/internal/model"
)

type wifiVisitorRepository struct {
	db *gorm.DB
}

// NewWifiVisitorRepository builds the visitor repository.
func NewWifiVisitorRepository(db *gorm.DB) WifiVisitorRepository {
	return &wifiVisitorRepository{db: db}
}

func (r *wifiVisitorRepository) Create(ctx context.Context, visitor *model.WifiVisitor) error {
	return r.db.WithContext(ctx).Create(visitor).Error
}

func (r *wifiVisitorRepository) FindByPortalSessionID(ctx context.Context, portalSessionID string) (*model.WifiVisitor, error) {
	var visitor model.WifiVisitor
	if err := r.db.WithContext(ctx).
		Where("portal_session_id = ?", portalSessionID).
		First(&visitor).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &visitor, nil
}

func (r *wifiVisitorRepository) AttachVoucher(ctx context.Context, portalSessionID, voucherID, username string, at time.Time) error {
	return r.db.WithContext(ctx).Model(&model.WifiVisitor{}).
		Where("portal_session_id = ?", portalSessionID).
		Updates(map[string]any{
			"voucher_id":         voucherID,
			"username":           username,
			"last_accounting_at": at,
		}).Error
}

func (r *wifiVisitorRepository) MarkConnected(ctx context.Context, username string, at time.Time) error {
	if strings.TrimSpace(username) == "" {
		return nil
	}
	return r.db.WithContext(ctx).Model(&model.WifiVisitor{}).
		Where("username = ? AND status IN ?", username, []string{model.VisitorStatusPending, model.VisitorStatusConnected, model.VisitorStatusStale, model.VisitorStatusClosed}).
		Updates(map[string]any{
			"status":             model.VisitorStatusConnected,
			"connected_at":       at,
			"last_accounting_at": at,
			"disconnected_at":    nil,
		}).Error
}

func (r *wifiVisitorRepository) MarkInterim(ctx context.Context, username string, at time.Time, sessionTimeSeconds int64) error {
	if strings.TrimSpace(username) == "" {
		return nil
	}
	updates := map[string]any{
		"status":             model.VisitorStatusConnected,
		"last_accounting_at": at,
	}
	if sessionTimeSeconds > 0 {
		updates["session_time_seconds"] = sessionTimeSeconds
	}
	return r.db.WithContext(ctx).Model(&model.WifiVisitor{}).
		Where("username = ?", username).
		Updates(updates).Error
}

func (r *wifiVisitorRepository) MarkDisconnected(ctx context.Context, username string, at time.Time, sessionTimeSeconds int64) error {
	if strings.TrimSpace(username) == "" {
		return nil
	}
	return r.db.WithContext(ctx).Model(&model.WifiVisitor{}).
		Where("username = ? AND status IN ?", username, []string{model.VisitorStatusConnected, model.VisitorStatusPending, model.VisitorStatusStale}).
		Updates(map[string]any{
			"status":               model.VisitorStatusClosed,
			"disconnected_at":      at,
			"last_accounting_at":   at,
			"session_time_seconds": sessionTimeSeconds,
		}).Error
}

func (r *wifiVisitorRepository) CloseOtherActiveByMAC(ctx context.Context, mac, keepUsername string, at time.Time) error {
	if strings.TrimSpace(mac) == "" {
		return nil
	}
	return r.db.WithContext(ctx).Model(&model.WifiVisitor{}).
		Where("mac = ? AND username <> ? AND status IN ?", mac, keepUsername, []string{model.VisitorStatusPending, model.VisitorStatusConnected, model.VisitorStatusStale}).
		Updates(map[string]any{
			"status":             model.VisitorStatusClosed,
			"disconnected_at":    at,
			"last_accounting_at": at,
		}).Error
}

func (r *wifiVisitorRepository) MarkStale(ctx context.Context, username string) error {
	if strings.TrimSpace(username) == "" {
		return nil
	}
	return r.db.WithContext(ctx).Model(&model.WifiVisitor{}).
		Where("username = ? AND status = ?", username, model.VisitorStatusConnected).
		Update("status", model.VisitorStatusStale).Error
}

func (r *wifiVisitorRepository) List(ctx context.Context, filter VisitorFilter) ([]model.WifiVisitor, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.WifiVisitor{})

	if search := strings.TrimSpace(filter.Search); search != "" {
		pattern := likePattern(search)
		query = query.Where("(mac ILIKE ? OR username ILIKE ? OR ip ILIKE ?)", pattern, pattern, pattern)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var visitors []model.WifiVisitor
	if err := query.
		Order(orderClause("created_at", filter.Order)).
		Limit(filter.PerPage).
		Offset((filter.Page - 1) * filter.PerPage).
		Find(&visitors).Error; err != nil {
		return nil, 0, err
	}
	return visitors, total, nil
}

func (r *wifiVisitorRepository) CountByStatus(ctx context.Context) (map[string]int64, error) {
	type row struct {
		Status string
		Total  int64
	}
	var rows []row
	if err := r.db.WithContext(ctx).Model(&model.WifiVisitor{}).
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
