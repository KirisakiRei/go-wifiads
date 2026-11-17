package main

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"wifiads/internal/config"
	"wifiads/internal/model"
	"wifiads/pkg/utils"
)

// seed writes the minimum Alpha data set. It is idempotent: existing rows are
// left untouched so rerunning migrations is safe.
func seed(ctx context.Context, cfg *config.Config, db *gorm.DB) error {
	now := time.Now().UTC()

	admin, err := ensureAdmin(ctx, cfg, db, now)
	if err != nil {
		return err
	}

	site, err := ensureSite(ctx, cfg, db, now)
	if err != nil {
		return err
	}

	router, err := ensureRouter(ctx, cfg, db, site, now)
	if err != nil {
		return err
	}

	if err := ensureNASClient(ctx, cfg, db, site, router, now); err != nil {
		return err
	}

	if err := ensureAdvertisement(ctx, cfg, db, now); err != nil {
		return err
	}

	fmt.Printf("seed: admin=%s site=%s router=%s\n", admin.Username, site.Name, router.Name)
	return nil
}

func ensureAdmin(ctx context.Context, cfg *config.Config, db *gorm.DB, now time.Time) (*model.AdminUser, error) {
	var admin model.AdminUser
	err := db.WithContext(ctx).Where("username = ?", cfg.Seed.AdminUsername).First(&admin).Error
	if err == nil {
		return &admin, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	password := cfg.Seed.AdminPassword
	if password == "" {
		password = "admin12345"
	}
	hashed, err := utils.HashPassword(password)
	if err != nil {
		return nil, err
	}

	admin = model.AdminUser{
		Base: model.Base{
			ID:        uuid.NewString(),
			CreatedAt: now,
			UpdatedAt: now,
		},
		Username:     cfg.Seed.AdminUsername,
		PasswordHash: hashed,
		Name:         cfg.Seed.AdminName,
		Role:         "admin",
		IsActive:     true,
	}
	if err := db.WithContext(ctx).Create(&admin).Error; err != nil {
		return nil, err
	}
	return &admin, nil
}

func ensureSite(ctx context.Context, cfg *config.Config, db *gorm.DB, now time.Time) (*model.Site, error) {
	var site model.Site
	err := db.WithContext(ctx).Order("created_at ASC").First(&site).Error
	if err == nil {
		return &site, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	site = model.Site{
		Base: model.Base{
			ID:        uuid.NewString(),
			CreatedAt: now,
			UpdatedAt: now,
		},
		Name:     cfg.Seed.SiteName,
		Timezone: cfg.Seed.SiteTimezone,
	}
	if err := db.WithContext(ctx).Create(&site).Error; err != nil {
		return nil, err
	}
	return &site, nil
}

func ensureRouter(ctx context.Context, cfg *config.Config, db *gorm.DB, site *model.Site, now time.Time) (*model.Router, error) {
	var router model.Router
	err := db.WithContext(ctx).Where("nas_identifier = ?", cfg.Seed.NASIdentifier).First(&router).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		router = model.Router{
			Base: model.Base{
				ID:        uuid.NewString(),
				CreatedAt: now,
				UpdatedAt: now,
			},
			SiteID:                site.ID,
			Name:                  cfg.Seed.RouterName,
			NASIdentifier:         cfg.Seed.NASIdentifier,
			IPAddress:             cfg.Seed.RouterIPAddress,
			Status:                model.RouterStatusActive,
			VoucherPrefix:         "MK1-",
			VoucherDigitCount:     6,
			VoucherNumericOnly:    true,
			VoucherTTLSeconds:     86400,
			SessionTimeoutSeconds: 3600,
		}
		if err := db.WithContext(ctx).Create(&router).Error; err != nil {
			return nil, err
		}
	}

	_ = db.WithContext(ctx).Model(&model.Router{}).Where("voucher_prefix = '' OR voucher_prefix IS NULL").Update("voucher_prefix", "MK1-")
	_ = db.WithContext(ctx).Model(&model.Router{}).Where("voucher_digit_count = 0").Update("voucher_digit_count", 6)
	_ = db.WithContext(ctx).Model(&model.Router{}).Where("voucher_ttl_seconds = 0").Update("voucher_ttl_seconds", 86400)
	_ = db.WithContext(ctx).Model(&model.Router{}).Where("session_timeout_seconds = 0").Update("session_timeout_seconds", 3600)
	return &router, nil
}

func ensureNASClient(ctx context.Context, cfg *config.Config, db *gorm.DB, site *model.Site, router *model.Router, now time.Time) error {
	secret := cfg.Seed.NASSharedSecret
	if secret == "" {
		secret = "testing123"
	}
	cipher, err := utils.EncryptString(cfg.Keys.RadiusSecretKey, secret)
	if err != nil {
		return err
	}

	var existing model.NASClient
	err = db.WithContext(ctx).Where("nas_identifier = ?", cfg.Seed.NASIdentifier).First(&existing).Error
	if err == nil {
		updates := map[string]any{
			"ip_address":        cfg.Seed.NASIPAddress,
			"secret_ciphertext": cipher,
			"is_active":         true,
			"updated_at":        now,
		}
		return db.WithContext(ctx).Model(&existing).Updates(updates).Error
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	client := model.NASClient{
		Base: model.Base{
			ID:        uuid.NewString(),
			CreatedAt: now,
			UpdatedAt: now,
		},
		RouterID:         router.ID,
		SiteID:           site.ID,
		Name:             cfg.Seed.RouterName,
		NASIdentifier:    cfg.Seed.NASIdentifier,
		IPAddress:        cfg.Seed.NASIPAddress,
		SecretCiphertext: cipher,
		IsActive:         true,
	}
	return db.WithContext(ctx).Create(&client).Error
}

func ensureAdvertisement(ctx context.Context, cfg *config.Config, db *gorm.DB, now time.Time) error {
	var existing model.Advertisement
	err := db.WithContext(ctx).Order("created_at ASC").First(&existing).Error
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	ad := model.Advertisement{
		Base: model.Base{
			ID:        uuid.NewString(),
			CreatedAt: now,
			UpdatedAt: now,
		},
		Title:    cfg.Seed.AdvertisementTitle,
		Body:     cfg.Seed.AdvertisementBody,
		ImageURL: cfg.Seed.AdvertisementImageURL,
		IsActive: true,
	}
	return db.WithContext(ctx).Create(&ad).Error
}
