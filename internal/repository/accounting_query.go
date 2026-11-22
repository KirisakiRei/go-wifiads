package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"wifiads/internal/model"
	"wifiads/pkg/apperror"
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
	if rid := strings.TrimSpace(filter.RouterID); rid != "" {
		query = query.Where("router_id = ?", rid)
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

func (r *accountingRepository) FindByID(ctx context.Context, id string) (*model.AccountingSession, error) {
	var session model.AccountingSession
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&session).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperror.ErrNotFound
		}
		return nil, err
	}
	return &session, nil
}

// FindActiveByMAC returns the newest ACTIVE accounting session for a normalized MAC address
// (optionally narrowed to a specific router_id). Uses indexed calling_station_id + status.
func (r *accountingRepository) FindActiveByMAC(ctx context.Context, mac string, routerID string) (*model.AccountingSession, error) {
	var session model.AccountingSession
	q := r.db.WithContext(ctx).
		Where("calling_station_id = ? AND status = ?", mac, model.AccountingSessionStatusActive)
	if strings.TrimSpace(routerID) != "" {
		q = q.Where("router_id = ?", routerID)
	}
	err := q.Order("COALESCE(started_at, created_at) DESC").First(&session).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperror.ErrNotFound
		}
		return nil, err
	}
	return &session, nil
}

// AggregateByNAS aggregates active/total session counts, traffic bytes and latest activity per NAS in a single SQL query.
func (r *accountingRepository) AggregateByNAS(ctx context.Context) (map[string]RouterAccountingStats, error) {
	type row struct {
		NASIdentifier  string
		ActiveSessions int64
		TotalSessions  int64
		InputOctets    int64
		OutputOctets   int64
		LastSeenAt     *time.Time
	}
	var rows []row
	err := r.db.WithContext(ctx).Model(&model.AccountingSession{}).
		Select(`
			LOWER(TRIM(nas_identifier)) AS nas_identifier,
			COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_sessions,
			COUNT(*) AS total_sessions,
			COALESCE(SUM(input_octets), 0) AS input_octets,
			COALESCE(SUM(output_octets), 0) AS output_octets,
			MAX(COALESCE(last_accounting_at, started_at, created_at)) AS last_seen_at
		`).
		Where("nas_identifier <> ''").
		Group("LOWER(TRIM(nas_identifier))").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make(map[string]RouterAccountingStats, len(rows))
	for _, item := range rows {
		out[item.NASIdentifier] = RouterAccountingStats{
			NASIdentifier:  item.NASIdentifier,
			ActiveSessions: item.ActiveSessions,
			TotalSessions:  item.TotalSessions,
			InputOctets:    item.InputOctets,
			OutputOctets:   item.OutputOctets,
			LastSeenAt:     item.LastSeenAt,
		}
	}
	return out, nil
}

func (r *accountingRepository) CloseByID(ctx context.Context, id string, at time.Time, cause string) error {
	return r.db.WithContext(ctx).Model(&model.AccountingSession{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"status":             model.AccountingSessionStatusClosed,
			"stopped_at":         at,
			"last_accounting_at": at,
			"terminate_cause":    cause,
			"updated_at":         at,
		}).Error
}
