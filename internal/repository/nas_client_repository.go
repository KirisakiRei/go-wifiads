package repository

import (
	"context"

	"gorm.io/gorm"

	"wifiads/internal/model"
	"wifiads/pkg/apperror"
)

type nasClientRepository struct {
	db *gorm.DB
}

// NewNASClientRepository builds the RADIUS client repository.
func NewNASClientRepository(db *gorm.DB) NASClientRepository {
	return &nasClientRepository{db: db}
}

func (r *nasClientRepository) Create(ctx context.Context, client *model.NASClient) error {
	if err := r.db.WithContext(ctx).Create(client).Error; err != nil {
		if isUniqueViolation(err) {
			return apperror.ErrAlreadyExists
		}
		return err
	}
	return nil
}

func (r *nasClientRepository) FindByIP(ctx context.Context, ipAddress string) (*model.NASClient, error) {
	var client model.NASClient
	if err := r.db.WithContext(ctx).Where("ip_address = ?", ipAddress).First(&client).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &client, nil
}

func (r *nasClientRepository) FindByNASIdentifier(ctx context.Context, nasIdentifier string) (*model.NASClient, error) {
	var client model.NASClient
	if err := r.db.WithContext(ctx).Where("nas_identifier = ?", nasIdentifier).First(&client).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &client, nil
}

func (r *nasClientRepository) Count(ctx context.Context) (int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&model.NASClient{}).Count(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}

type advertisementRepository struct {
	db *gorm.DB
}

// NewAdvertisementRepository builds the advertisement repository.
func NewAdvertisementRepository(db *gorm.DB) AdvertisementRepository {
	return &advertisementRepository{db: db}
}

func (r *advertisementRepository) Create(ctx context.Context, ad *model.Advertisement) error {
	return r.db.WithContext(ctx).Create(ad).Error
}

func (r *advertisementRepository) FindByID(ctx context.Context, id string) (*model.Advertisement, error) {
	var ad model.Advertisement
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&ad).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &ad, nil
}

func (r *advertisementRepository) FindActive(ctx context.Context) (*model.Advertisement, error) {
	var ad model.Advertisement
	if err := r.db.WithContext(ctx).
		Where("is_active = ?", true).
		Order("sort_order ASC, created_at ASC").
		First(&ad).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &ad, nil
}

func (r *advertisementRepository) List(ctx context.Context) ([]model.Advertisement, error) {
	var ads []model.Advertisement
	if err := r.db.WithContext(ctx).Order("sort_order ASC, created_at ASC").Find(&ads).Error; err != nil {
		return nil, err
	}
	return ads, nil
}

func (r *advertisementRepository) Update(ctx context.Context, ad *model.Advertisement) error {
	return r.db.WithContext(ctx).Save(ad).Error
}

func (r *advertisementRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Advertisement{}).Error
}

func (r *advertisementRepository) Count(ctx context.Context) (int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&model.Advertisement{}).Count(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}

type auditLogRepository struct {
	db *gorm.DB
}

// NewAuditLogRepository builds the audit trail repository.
func NewAuditLogRepository(db *gorm.DB) AuditLogRepository {
	return &auditLogRepository{db: db}
}

func (r *auditLogRepository) Create(ctx context.Context, entry *model.AuditLog) error {
	return r.db.WithContext(ctx).Create(entry).Error
}
