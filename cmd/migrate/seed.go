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

	if err := ensureRoles(ctx, db, now); err != nil {
		return err
	}

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

	if err := ensureConnectProfiles(ctx, db, now); err != nil {
		return err
	}

	if err := ensureMarketplaceDefaults(ctx, db, now); err != nil {
		return err
	}

	fmt.Printf("seed: admin=%s site=%s router=%s\n", admin.Username, site.Name, router.Name)
	return nil
}

func ensureMarketplaceDefaults(ctx context.Context, db *gorm.DB, now time.Time) error {
	// 1. Seed default Location Tiers (1.0x, 1.2x, 1.5x)
	tiers := []model.LocationTier{
		{
			Base:                model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
			Name:                "Standard",
			Multiplier:          1.0,
			MinDailyConnects:    0,
			MinDailyImpressions: 0,
			Description:         "Lokasi reguler dengan trafik harian stabil.",
			SortOrder:           1,
			IsActive:            true,
		},
		{
			Base:                model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
			Name:                "Strategis",
			Multiplier:          1.2,
			MinDailyConnects:    30,
			MinDailyImpressions: 25,
			Description:         "Kafe atau area komersial dengan pengunjung menengah-tinggi.",
			SortOrder:           2,
			IsActive:            true,
		},
		{
			Base:                model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
			Name:                "Premium",
			Multiplier:          1.5,
			MinDailyConnects:    80,
			MinDailyImpressions: 70,
			Description:         "Lokasi unggulan dengan keramaian tinggi dan jam sibuk padat.",
			SortOrder:           3,
			IsActive:            true,
		},
	}

	var standardTierID string
	for _, t := range tiers {
		var existing model.LocationTier
		err := db.WithContext(ctx).Where("LOWER(name) = LOWER(?)", t.Name).First(&existing).Error
		if err == nil {
			if standardTierID == "" {
				standardTierID = existing.ID
			}
			if existing.MinDailyConnects == 0 && t.MinDailyConnects > 0 {
				_ = db.WithContext(ctx).Model(&model.LocationTier{}).Where("id = ?", existing.ID).Updates(map[string]any{
					"min_daily_connects":    t.MinDailyConnects,
					"min_daily_impressions": t.MinDailyImpressions,
				}).Error
			}
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		item := t
		if err := db.WithContext(ctx).Create(&item).Error; err != nil {
			return err
		}
		if standardTierID == "" {
			standardTierID = item.ID
		}
	}

	// Attach standard tier & active status to existing routers/ads if unset
	if standardTierID != "" {
		_ = db.WithContext(ctx).Model(&model.Router{}).Where("location_tier_id IS NULL").Update("location_tier_id", standardTierID)
	}
	_ = db.WithContext(ctx).Model(&model.Advertisement{}).Where("status = '' OR status IS NULL").Update("status", model.AdStatusActive)

	// 2. Seed global PlatformAdSetting (default Rp 50 per tayang, max 30s, require approval)
	var settingCount int64
	if err := db.WithContext(ctx).Model(&model.PlatformAdSetting{}).Count(&settingCount).Error; err != nil {
		return err
	}
	if settingCount == 0 {
		setting := model.PlatformAdSetting{
			Base:                       model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
			BasePriceImageIDR:          50,
			BasePriceVideoIDR:          50,
			MaxAdDurationSeconds:       30,
			MinTopupAmountIDR:          50000,
			DefaultPartnerSharePercent: 20,
			MinWithdrawalAmountIDR:     50000,
			RequireAdApproval:          true,
		}
		if err := db.WithContext(ctx).Create(&setting).Error; err != nil {
			return err
		}
	} else {
		_ = db.WithContext(ctx).Model(&model.PlatformAdSetting{}).
			Where("default_partner_share_percent <= 0").
			Update("default_partner_share_percent", 20).Error
		_ = db.WithContext(ctx).Model(&model.PlatformAdSetting{}).
			Where("min_withdrawal_amount_id_r <= 0").
			Update("min_withdrawal_amount_id_r", 50000).Error
	}

	// 3. Seed one starter PaymentMethod if none exists
	var pmCount int64
	if err := db.WithContext(ctx).Model(&model.PaymentMethod{}).Count(&pmCount).Error; err != nil {
		return err
	}
	if pmCount == 0 {
		pm := model.PaymentMethod{
			Base:          model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
			Type:          model.PaymentMethodBankTransfer,
			ProviderName:  "Bank BCA",
			AccountNumber: "1234567890",
			AccountHolder: "PT AdWave WiFi Indonesia",
			Instructions:  "Transfer sesuai nominal tagihan lalu unggah foto bukti pembayaran.",
			SortOrder:     1,
			IsActive:      true,
		}
		if err := db.WithContext(ctx).Create(&pm).Error; err != nil {
			return err
		}
	}

	return nil
}

func ensureRoles(ctx context.Context, db *gorm.DB, now time.Time) error {
	defaults := []model.Role{
		{
			Base: model.Base{
				ID:        uuid.NewString(),
				CreatedAt: now,
				UpdatedAt: now,
			},
			Name:        "admin",
			DisplayName: "Super Administrator",
			Description: "Akses penuh ke seluruh fitur sistem, konfigurasi router, dan manajemen RBAC.",
			Permissions: "dashboard:view,routers:view,routers:create,routers:edit,routers:delete,profiles:view,profiles:create,profiles:edit,profiles:delete,advertisements:view,advertisements:create,advertisements:edit,advertisements:delete,marketplace:view,marketplace:moderate,marketplace:settings,partners:view,partners:manage,finance:view,vouchers:view,vouchers:create,vouchers:edit,vouchers:delete,visitors:view,visitors:delete,users:view,users:create,users:edit,users:delete,roles:view,roles:create,roles:edit,roles:delete",
			IsSystem:    true,
		},
		{
			Base: model.Base{
				ID:        uuid.NewString(),
				CreatedAt: now,
				UpdatedAt: now,
			},
			Name:        "operator",
			DisplayName: "Operator / Teknisi NOC",
			Description: "Monitoring router MikroTik, manajemen voucher, dan pantau pengunjung.",
			Permissions: "dashboard:view,routers:view,routers:edit,profiles:view,vouchers:view,vouchers:create,vouchers:edit,visitors:view",
			IsSystem:    false,
		},
		{
			Base: model.Base{
				ID:        uuid.NewString(),
				CreatedAt: now,
				UpdatedAt: now,
			},
			Name:        "marketing",
			DisplayName: "Tim Marketing & Iklan",
			Description: "Kelola materi iklan sponsor captive portal dan lihat data leads pengunjung.",
			Permissions: "dashboard:view,advertisements:view,advertisements:create,advertisements:edit,advertisements:delete,visitors:view",
			IsSystem:    false,
		},
	}

	for _, r := range defaults {
		var existing model.Role
		err := db.WithContext(ctx).Where("LOWER(name) = LOWER(?)", r.Name).First(&existing).Error
		if err == nil {
			if existing.IsSystem && r.Name == "admin" && existing.Permissions != r.Permissions {
				_ = db.WithContext(ctx).Model(&model.Role{}).Where("id = ?", existing.ID).Update("permissions", r.Permissions).Error
			}
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		item := r
		if err := db.WithContext(ctx).Create(&item).Error; err != nil {
			return err
		}
	}
	return nil
}

func ensureConnectProfiles(ctx context.Context, db *gorm.DB, now time.Time) error {
	defaults := []model.ConnectProfile{
		{
			Base: model.Base{
				ID:        uuid.NewString(),
				CreatedAt: now,
				UpdatedAt: now,
			},
			Name:                  "basic",
			DisplayName:           "Basic",
			Description:           "User yang skip survey. Bandwidth terbatas.",
			IsDefault:             true,
			BandwidthUpKbps:       512,
			BandwidthDownKbps:     1024,
			SessionTimeoutSeconds: 1800,
			VoucherTTLSeconds:     300,
			IsActive:              true,
		},
		{
			Base: model.Base{
				ID:        uuid.NewString(),
				CreatedAt: now,
				UpdatedAt: now,
			},
			Name:                  "premium",
			DisplayName:           "Premium",
			Description:           "User yang isi survey. Bandwidth lebih tinggi.",
			IsDefault:             false,
			BandwidthUpKbps:       2048,
			BandwidthDownKbps:     5120,
			SessionTimeoutSeconds: 7200,
			VoucherTTLSeconds:     300,
			IsActive:              true,
		},
	}

	for _, p := range defaults {
		var existing model.ConnectProfile
		err := db.WithContext(ctx).Where("name = ?", p.Name).First(&existing).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		item := p
		if err := db.WithContext(ctx).Create(&item).Error; err != nil {
			return err
		}
	}
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
