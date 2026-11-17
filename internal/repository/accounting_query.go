package repository

import (
	"context"
	"strings"
	"time"

	"gorm.io/gorm/clause"

	"wifiads/internal/model"
)

// RecordEvent stores the packet fingerprint and reports false for duplicates.
func (r *accountingRepository) RecordEvent(ctx context.Context, event *model.AccountingEvent) (bool, error) {
	result := r.db.WithContext(ctx).
		Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "event_key"}}, DoNothing: true}).
		Create(event)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

func (r *accountingRepository) ListSessions(ctx context.Context, filter SessionFilter) ([]model.AccountingSession, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.AccountingSession{})

	if search := strings.TrimSpace(filter.Search); search != "" {
		pattern := likePattern(search)
		query = query.Where(
			"(username ILIKE ? OR acct_session_id ILIKE ? OR calling_station_id ILIKE ? OR framed_ip_address ILIKE ?)",
			pattern, pattern, pattern, pattern,
		)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var sessions []model.AccountingSession
	if err := query.
		Order(orderClause("created_at", filter.Order)).
		Limit(filter.PerPage).
		Offset((filter.Page - 1) * filter.PerPage).
		Find(&sessions).Error; err != nil {
		return nil, 0, err
	}
	return sessions, total, nil
}

func (r *accountingRepository) CountByStatus(ctx context.Context) (map[string]int64, error) {
	type row struct {
		Status string
		Total  int64
	}
	var rows []row
	if err := r.db.WithContext(ctx).Model(&model.AccountingSession{}).
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

// MarkStale flags sessions that stopped reporting accounting without a Stop.
func (r *accountingRepository) MarkStale(ctx context.Context, threshold time.Time) (int64, error) {
	result := r.db.WithContext(ctx).Model(&model.AccountingSession{}).
		Where("status = ?", model.AccountingSessionStatusActive).
		Where("COALESCE(last_accounting_at, started_at, created_at) < ?", threshold).
		Update("status", model.AccountingSessionStatusStale)
	if result.Error != nil {
		return 0, result.Error
	}
	return result.RowsAffected, nil
}

func (r *accountingRepository) HasActiveSessionForVoucher(ctx context.Context, voucherID string) (bool, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&model.AccountingSession{}).
		Where("voucher_id = ? AND status = ?", voucherID, model.AccountingSessionStatusActive).
		Count(&total).Error; err != nil {
		return false, err
	}
	return total > 0, nil
}
