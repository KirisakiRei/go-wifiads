package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"wifiads/internal/model"
	"wifiads/pkg/apperror"
)

type connectProfileRepository struct {
	db *gorm.DB
}

// NewConnectProfileRepository builds the connect profile repository.
func NewConnectProfileRepository(db *gorm.DB) ConnectProfileRepository {
	return &connectProfileRepository{db: db}
}

func (r *connectProfileRepository) Create(ctx context.Context, profile *model.ConnectProfile) error {
	return r.db.WithContext(ctx).Create(profile).Error
}

func (r *connectProfileRepository) FindByID(ctx context.Context, id string) (*model.ConnectProfile, error) {
	var profile model.ConnectProfile
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&profile).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperror.ErrNotFound
		}
		return nil, err
	}
	return &profile, nil
}

func (r *connectProfileRepository) FindByName(ctx context.Context, name string) (*model.ConnectProfile, error) {
	var profile model.ConnectProfile
	if err := r.db.WithContext(ctx).Where("name = ? AND is_active = true", name).First(&profile).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperror.ErrNotFound
		}
		return nil, err
	}
	return &profile, nil
}

// FindDefault returns the active profile where is_default = true.
func (r *connectProfileRepository) FindDefault(ctx context.Context) (*model.ConnectProfile, error) {
	var profile model.ConnectProfile
	if err := r.db.WithContext(ctx).
		Where("is_default = true AND is_active = true").
		First(&profile).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperror.ErrNotFound
		}
		return nil, err
	}
	return &profile, nil
}

// FindForSurveyCompleted returns the best non-default active profile
// (ordered by bandwidth_down_kbps DESC), i.e. the "premium" tier.
func (r *connectProfileRepository) FindForSurveyCompleted(ctx context.Context) (*model.ConnectProfile, error) {
	var profile model.ConnectProfile
	if err := r.db.WithContext(ctx).
		Where("is_default = false AND is_active = true").
		Order("bandwidth_down_kbps DESC").
		First(&profile).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperror.ErrNotFound
		}
		return nil, err
	}
	return &profile, nil
}

func (r *connectProfileRepository) ListActive(ctx context.Context) ([]model.ConnectProfile, error) {
	var profiles []model.ConnectProfile
	if err := r.db.WithContext(ctx).
		Where("is_active = true").
		Order("is_default DESC, name ASC").
		Find(&profiles).Error; err != nil {
		return nil, err
	}
	return profiles, nil
}

func (r *connectProfileRepository) Update(ctx context.Context, profile *model.ConnectProfile) error {
	return r.db.WithContext(ctx).Save(profile).Error
}

func (r *connectProfileRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.ConnectProfile{}).Error
}

func (r *connectProfileRepository) Count(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&model.ConnectProfile{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (r *connectProfileRepository) CountRoutersUsingProfile(ctx context.Context, profileID string) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.Router{}).
		Where("status = ? AND (default_profile_id = ? OR survey_profile_id = ?)", model.RouterStatusActive, profileID, profileID).
		Count(&count).Error
	return count, err
}
