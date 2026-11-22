package repository

import (
	"context"
	"strings"
	"time"

	"gorm.io/gorm"

	"wifiads/internal/model"
	"wifiads/pkg/apperror"
)

type QuestionnaireSubmissionFilter struct {
	Page     int
	PerPage  int
	RouterID string
	MAC      string
	Search   string
	Order    string
}

type QuestionnaireRepository interface {
	ListFields(ctx context.Context, activeOnly bool) ([]model.QuestionnaireField, error)
	FindFieldByID(ctx context.Context, id string) (*model.QuestionnaireField, error)
	CreateField(ctx context.Context, f *model.QuestionnaireField) error
	UpdateField(ctx context.Context, f *model.QuestionnaireField) error
	DeleteField(ctx context.Context, id string) error
	ReorderFields(ctx context.Context, orderedIDs []string) error
	CreateSubmission(ctx context.Context, s *model.QuestionnaireSubmission) error
	ListSubmissions(ctx context.Context, filter QuestionnaireSubmissionFilter) ([]model.QuestionnaireSubmission, int64, error)
	ExportSubmissions(ctx context.Context, routerID, mac string, limit int) ([]model.QuestionnaireSubmission, error)
}

type questionnaireRepository struct {
	db *gorm.DB
}

func NewQuestionnaireRepository(db *gorm.DB) QuestionnaireRepository {
	return &questionnaireRepository{db: db}
}

func (r *questionnaireRepository) ListFields(ctx context.Context, activeOnly bool) ([]model.QuestionnaireField, error) {
	q := r.db.WithContext(ctx).Model(&model.QuestionnaireField{})
	if activeOnly {
		q = q.Where("is_active = ?", true)
	}
	var fields []model.QuestionnaireField
	if err := q.Order("sort_order ASC, created_at ASC").Find(&fields).Error; err != nil {
		return nil, err
	}
	return fields, nil
}

func (r *questionnaireRepository) FindFieldByID(ctx context.Context, id string) (*model.QuestionnaireField, error) {
	var f model.QuestionnaireField
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&f).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &f, nil
}

func (r *questionnaireRepository) CreateField(ctx context.Context, f *model.QuestionnaireField) error {
	if err := r.db.WithContext(ctx).Create(f).Error; err != nil {
		if isUniqueViolation(err) {
			return apperror.ErrAlreadyExists
		}
		return err
	}
	return nil
}

func (r *questionnaireRepository) UpdateField(ctx context.Context, f *model.QuestionnaireField) error {
	return r.db.WithContext(ctx).Save(f).Error
}

func (r *questionnaireRepository) DeleteField(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.QuestionnaireField{}).Error
}

func (r *questionnaireRepository) ReorderFields(ctx context.Context, orderedIDs []string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		for idx, id := range orderedIDs {
			if err := tx.Model(&model.QuestionnaireField{}).
				Where("id = ?", id).
				Updates(map[string]any{"sort_order": idx + 1, "updated_at": now}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *questionnaireRepository) CreateSubmission(ctx context.Context, s *model.QuestionnaireSubmission) error {
	return r.db.WithContext(ctx).Create(s).Error
}

func (r *questionnaireRepository) ListSubmissions(ctx context.Context, filter QuestionnaireSubmissionFilter) ([]model.QuestionnaireSubmission, int64, error) {
	q := r.db.WithContext(ctx).Model(&model.QuestionnaireSubmission{})
	if rid := strings.TrimSpace(filter.RouterID); rid != "" {
		q = q.Where("router_id = ?", rid)
	}
	if mac := strings.TrimSpace(filter.MAC); mac != "" {
		q = q.Where("mac ILIKE ?", likePattern(mac))
	}
	if s := strings.TrimSpace(filter.Search); s != "" {
		pat := likePattern(s)
		q = q.Where("(mac ILIKE ? OR CAST(answers AS TEXT) ILIKE ?)", pat, pat)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []model.QuestionnaireSubmission
	if err := q.
		Order(orderClause("created_at", filter.Order)).
		Limit(filter.PerPage).
		Offset((filter.Page - 1) * filter.PerPage).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (r *questionnaireRepository) ExportSubmissions(ctx context.Context, routerID, mac string, limit int) ([]model.QuestionnaireSubmission, error) {
	if limit <= 0 || limit > 10000 {
		limit = 5000
	}
	q := r.db.WithContext(ctx).Model(&model.QuestionnaireSubmission{})
	if rid := strings.TrimSpace(routerID); rid != "" {
		q = q.Where("router_id = ?", rid)
	}
	if m := strings.TrimSpace(mac); m != "" {
		q = q.Where("mac ILIKE ?", likePattern(m))
	}
	var rows []model.QuestionnaireSubmission
	if err := q.Order("created_at DESC").Limit(limit).Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}
