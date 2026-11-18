package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"wifiads/internal/config"
	"wifiads/internal/model"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "load configuration: %v\n", err)
		os.Exit(1)
	}

	logger := config.NewLogger(cfg.LogLevel, cfg.AppEnv)

	if err := config.EnsureDatabase(cfg, logger); err != nil {
		fmt.Fprintf(os.Stderr, "ensure database: %v\n", err)
		os.Exit(1)
	}

	db, err := config.Connect(cfg, logger)
	if err != nil {
		fmt.Fprintf(os.Stderr, "connect database: %v\n", err)
		os.Exit(1)
	}

	ctx := context.Background()

	if err := db.WithContext(ctx).Exec("CREATE SCHEMA IF NOT EXISTS app").Error; err != nil {
		fmt.Fprintf(os.Stderr, "create schema app: %v\n", err)
		os.Exit(1)
	}
	if err := db.WithContext(ctx).Exec("CREATE SCHEMA IF NOT EXISTS radius").Error; err != nil {
		fmt.Fprintf(os.Stderr, "create schema radius: %v\n", err)
		os.Exit(1)
	}

	models := []any{
		&model.Role{},
		&model.AdminUser{},
		&model.Site{},
		&model.LocationTier{},
		&model.PlatformAdSetting{},
		&model.PaymentMethod{},
		&model.Advertiser{},
		&model.Partner{},
		&model.ConnectProfile{},
		&model.Router{},
		&model.PortalSession{},
		&model.WifiVisitor{},
		&model.Advertisement{},
		&model.AdvertisementRouter{},
		&model.AdImpression{},
		&model.TopupInvoice{},
		&model.WalletTransaction{},
		&model.PartnerWithdrawal{},
		&model.PartnerWalletTransaction{},
		&model.AuditLog{},
		&model.NASClient{},
		&model.Voucher{},
		&model.AccountingSession{},
		&model.AccountingEvent{},
	}

	if err := db.WithContext(ctx).AutoMigrate(missingModels(ctx, db, models)...); err != nil {
		fmt.Fprintf(os.Stderr, "auto migrate: %v\n", err)
		os.Exit(1)
	}
	for _, stmt := range partnerMigrations {
		if err := db.WithContext(ctx).Exec(stmt).Error; err != nil {
			fmt.Fprintf(os.Stderr, "partner migration (%s): %v\n", stmt, err)
			os.Exit(1)
		}
	}
	if err := renameLegacyIDRColumns(ctx, db); err != nil {
		fmt.Fprintf(os.Stderr, "rename _id_r columns: %v\n", err)
		os.Exit(1)
	}

	logger.Info("schema migrated", "tables", len(models))

	if err := seed(ctx, cfg, db); err != nil {
		fmt.Fprintf(os.Stderr, "seed: %v\n", err)
		os.Exit(1)
	}
	logger.Info("seed completed")
}

// missingModels returns only the models whose table does not exist yet.
// Existing tables are never handed to AutoMigrate: this project's production DB was
// created by an older GORM version whose unique indexes are not visible as constraints,
// so AutoMigrate tries to drop constraints that do not exist and aborts.
func missingModels(ctx context.Context, db *gorm.DB, models []any) []any {
	missing := make([]any, 0, len(models))
	for _, m := range models {
		if !db.WithContext(ctx).Migrator().HasTable(m) {
			missing = append(missing, m)
		}
	}
	return missing
}

// partnerMigrations bring an existing app.partners table up to the invite flow schema.
// Every statement is idempotent and additive; no column is retyped and no data is dropped.
var partnerMigrations = []string{
	`ALTER TABLE app.partners ADD COLUMN IF NOT EXISTS username varchar(80)`,
	`ALTER TABLE app.partners ADD COLUMN IF NOT EXISTS status varchar(24) NOT NULL DEFAULT 'ACTIVE'`,
	`ALTER TABLE app.partners ADD COLUMN IF NOT EXISTS invite_token varchar(96)`,
	`ALTER TABLE app.partners ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz`,
	`ALTER TABLE app.partners ADD COLUMN IF NOT EXISTS activated_at timestamptz`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_app_partners_username ON app.partners (username)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_app_partners_invite_token ON app.partners (invite_token)`,
	`CREATE INDEX IF NOT EXISTS idx_app_partners_status ON app.partners (status)`,
	`ALTER TABLE app.partners ALTER COLUMN email DROP NOT NULL`,
	`ALTER TABLE app.partners ALTER COLUMN password_hash DROP NOT NULL`,
	`ALTER TABLE app.partners ALTER COLUMN name DROP NOT NULL`,
	`UPDATE app.partners SET email = NULL WHERE email = ''`,
	`UPDATE app.partners SET status = 'ACTIVE' WHERE status = '' OR status IS NULL`,
}

// renameLegacyIDRColumns fixes tables created by an older GORM version that split the
// `IDR` suffix into `id_r`. It renames only when the old column exists and the new one
// does not, so it is safe to run repeatedly.
func renameLegacyIDRColumns(ctx context.Context, db *gorm.DB) error {
	var rows []struct {
		Table  string
		Column string
	}
	err := db.WithContext(ctx).Raw(`
		SELECT table_name AS table, column_name AS column
		FROM information_schema.columns
		WHERE table_schema = 'app' AND column_name LIKE '%\_id\_r'`).Scan(&rows).Error
	if err != nil {
		return err
	}
	for _, r := range rows {
		newCol := strings.Replace(r.Column, "_id_r", "_idr", 1)
		tbl := clause.Table{Name: "app." + r.Table}
		if db.WithContext(ctx).Migrator().HasColumn(tbl, newCol) {
			continue
		}
		if err := db.WithContext(ctx).Exec("ALTER TABLE ? RENAME COLUMN ? TO ?",
			tbl, clause.Column{Name: r.Column}, clause.Column{Name: newCol}).Error; err != nil {
			return fmt.Errorf("%s.%s: %w", r.Table, r.Column, err)
		}
	}
	return nil
}
