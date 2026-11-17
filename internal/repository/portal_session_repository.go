package repository

import (
	"context"
	"strings"
	"time"

	"gorm.io/gorm"

	"wifiads/internal/model"
	"wifiads/pkg/apperror"
)

type portalSessionRepository struct {
	db *gorm.DB
}

// NewPortalSessionRepository builds the portal session repository.
func NewPortalSessionRepository(db *gorm.DB) PortalSessionRepository {
	return &portalSessionRepository{db: db}
}

func (r *portalSessionRepository) Create(ctx context.Context, session *model.PortalSession) error {
	return r.db.WithContext(ctx).Create(session).Error
}

func (r *portalSessionRepository) FindByTokenHash(ctx context.Context, tokenHash string) (*model.PortalSession, error) {
	var session model.PortalSession
	if err := r.db.WithContext(ctx).Where("token_hash = ?", tokenHash).First(&session).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &session, nil
}

func (r *portalSessionRepository) FindByID(ctx context.Context, id string) (*model.PortalSession, error) {
	var session model.PortalSession
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&session).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &session, nil
}

func (r *portalSessionRepository) FindByIDs(ctx context.Context, ids []string) ([]model.PortalSession, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	var sessions []model.PortalSession
	if err := r.db.WithContext(ctx).Where("id IN ?", ids).Find(&sessions).Error; err != nil {
		return nil, err
	}
	return sessions, nil
}

func (r *portalSessionRepository) MarkVoucherIssued(ctx context.Context, id string, at time.Time) error {
	result := r.db.WithContext(ctx).Model(&model.PortalSession{}).
		Where("id = ? AND status = ?", id, model.PortalSessionStatusPendingAd).
		Updates(map[string]any{
			"status":            model.PortalSessionStatusVoucherIssued,
			"voucher_issued_at": at,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperror.ErrConflict
	}
	return nil
}

func (r *portalSessionRepository) UpdateStatus(ctx context.Context, id, status string) error {
	return r.db.WithContext(ctx).Model(&model.PortalSession{}).
		Where("id = ?", id).
		Update("status", status).Error
}

func (r *portalSessionRepository) SaveSurvey(ctx context.Context, id, email, phone string, skipped bool, profileID string) error {
	return r.db.WithContext(ctx).
		Model(&model.PortalSession{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"survey_email":   strings.TrimSpace(email),
			"survey_phone":   strings.TrimSpace(phone),
			"survey_skipped": skipped,
			"profile_id":     profileID,
		}).Error
}

func (r *portalSessionRepository) CountByStatus(ctx context.Context) (map[string]int64, error) {
	type row struct {
		Status string
		Total  int64
	}
	var rows []row
	if err := r.db.WithContext(ctx).Model(&model.PortalSession{}).
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
