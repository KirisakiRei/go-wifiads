package repository

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"

	"wifiads/internal/model"
	"wifiads/pkg/apperror"
)

type PartnerLeadFilter struct {
	Page    int
	PerPage int
	Status  string
	Search  string
}

type PartnerLeadRepository interface {
	Create(ctx context.Context, lead *model.PartnerLead) error
	FindByID(ctx context.Context, id string) (*model.PartnerLead, error)
	Update(ctx context.Context, lead *model.PartnerLead) error
	List(ctx context.Context, filter PartnerLeadFilter) ([]model.PartnerLead, int64, error)
}

type partnerLeadRepository struct {
	db *gorm.DB
}

func NewPartnerLeadRepository(db *gorm.DB) PartnerLeadRepository {
	return &partnerLeadRepository{db: db}
}

func (r *partnerLeadRepository) Create(ctx context.Context, lead *model.PartnerLead) error {
	return r.db.WithContext(ctx).Create(lead).Error
}

func (r *partnerLeadRepository) FindByID(ctx context.Context, id string) (*model.PartnerLead, error) {
	var lead model.PartnerLead
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&lead).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperror.ErrNotFound
		}
		return nil, err
	}
	return &lead, nil
}

func (r *partnerLeadRepository) Update(ctx context.Context, lead *model.PartnerLead) error {
	return r.db.WithContext(ctx).Save(lead).Error
}

func (r *partnerLeadRepository) List(ctx context.Context, filter PartnerLeadFilter) ([]model.PartnerLead, int64, error) {
	q := r.db.WithContext(ctx).Model(&model.PartnerLead{})
	if st := strings.TrimSpace(filter.Status); st != "" {
		q = q.Where("status = ?", strings.ToUpper(st))
	}
	if s := strings.TrimSpace(filter.Search); s != "" {
		like := "%" + strings.ToLower(s) + "%"
		q = q.Where(
			"LOWER(venue_name) LIKE ? OR LOWER(city) LIKE ? OR LOWER(contact_name) LIKE ? OR LOWER(whatsapp) LIKE ?",
			like, like, like, like,
		)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.PartnerLead
	offset := (filter.Page - 1) * filter.PerPage
	err := q.Order("created_at DESC").Offset(offset).Limit(filter.PerPage).Find(&items).Error
	return items, total, err
}
