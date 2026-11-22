package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"wifiads/internal/model"
	"wifiads/pkg/apperror"
)

type siteRepository struct {
	db *gorm.DB
}

// NewSiteRepository builds the site repository.
func NewSiteRepository(db *gorm.DB) SiteRepository {
	return &siteRepository{db: db}
}

func (r *siteRepository) Create(ctx context.Context, site *model.Site) error {
	return r.db.WithContext(ctx).Create(site).Error
}

func (r *siteRepository) FindByID(ctx context.Context, id string) (*model.Site, error) {
	var site model.Site
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&site).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &site, nil
}

func (r *siteRepository) First(ctx context.Context) (*model.Site, error) {
	var site model.Site
	if err := r.db.WithContext(ctx).Order("created_at ASC").First(&site).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &site, nil
}

func (r *siteRepository) Count(ctx context.Context) (int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&model.Site{}).Count(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}

type routerRepository struct {
	db *gorm.DB
}

// NewRouterRepository builds the router repository.
func NewRouterRepository(db *gorm.DB) RouterRepository {
	return &routerRepository{db: db}
}

func (r *routerRepository) Create(ctx context.Context, router *model.Router) error {
	if err := r.db.WithContext(ctx).Create(router).Error; err != nil {
		if isUniqueViolation(err) {
			return apperror.ErrAlreadyExists
		}
		return err
	}
	return nil
}

func (r *routerRepository) Update(ctx context.Context, router *model.Router) error {
	if err := r.db.WithContext(ctx).Save(router).Error; err != nil {
		if isUniqueViolation(err) {
			return apperror.ErrAlreadyExists
		}
		return err
	}
	return nil
}

func (r *routerRepository) FindByID(ctx context.Context, id string) (*model.Router, error) {
	var router model.Router
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&router).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &router, nil
}

func (r *routerRepository) FindByNASIdentifier(ctx context.Context, nasIdentifier string) (*model.Router, error) {
	var router model.Router
	if err := r.db.WithContext(ctx).Where("nas_identifier = ?", nasIdentifier).First(&router).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &router, nil
}

func (r *routerRepository) ListActive(ctx context.Context) ([]model.Router, error) {
	var routers []model.Router
	if err := r.db.WithContext(ctx).
		Where("status = ?", model.RouterStatusActive).
		Order("created_at ASC").
		Find(&routers).Error; err != nil {
		return nil, err
	}
	return routers, nil
}

func (r *routerRepository) Count(ctx context.Context) (int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&model.Router{}).Count(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}

func (r *routerRepository) UpdateVoucherConfig(ctx context.Context, id string, prefix string, digitCount int, numericOnly bool, defaultProfileID *string, surveyProfileID *string, ttlSeconds int, sessionTimeoutSeconds int) error {
	updates := map[string]any{
		"voucher_prefix":          prefix,
		"voucher_digit_count":     digitCount,
		"voucher_numeric_only":    numericOnly,
		"default_profile_id":      defaultProfileID,
		"survey_profile_id":       surveyProfileID,
		"voucher_ttl_seconds":     ttlSeconds,
		"session_timeout_seconds": sessionTimeoutSeconds,
	}
	return r.db.WithContext(ctx).Model(&model.Router{}).Where("id = ?", id).Updates(updates).Error
}

func (r *routerRepository) TouchLastSeen(ctx context.Context, id string, at time.Time) error {
	if id == "" {
		return nil
	}
	return r.db.WithContext(ctx).Model(&model.Router{}).Where("id = ?", id).UpdateColumn("last_seen_at", at).Error
}

func (r *routerRepository) TouchLastSeenByNAS(ctx context.Context, nasIdentifier string, at time.Time) error {
	if nasIdentifier == "" {
		return nil
	}
	return r.db.WithContext(ctx).Model(&model.Router{}).Where("nas_identifier = ?", nasIdentifier).UpdateColumn("last_seen_at", at).Error
}

func (r *routerRepository) SoftDelete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.Router{}).Where("id = ?", id).Update("status", model.RouterStatusInactive).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", id).Delete(&model.Router{}).Error
	})
}

func (r *routerRepository) CountActiveCampaigns(ctx context.Context, routerID string) (int64, error) {
	var total int64
	err := r.db.WithContext(ctx).
		Table("app.advertisement_routers ar").
		Joins("JOIN app.advertisements a ON a.id = ar.advertisement_id").
		Where("ar.router_id = ? AND a.deleted_at IS NULL AND a.status IN ?", routerID, []string{"ACTIVE", "PENDING_REVIEW"}).
		Count(&total).Error
	return total, err
}
