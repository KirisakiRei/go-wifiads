package main

import (
	"context"
	"fmt"
	"os"

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
		&model.AdminUser{},
		&model.Site{},
		&model.Router{},
		&model.PortalSession{},
		&model.WifiVisitor{},
		&model.Advertisement{},
		&model.AuditLog{},
		&model.NASClient{},
		&model.Voucher{},
		&model.AccountingSession{},
		&model.AccountingEvent{},
	}

	if err := db.WithContext(ctx).AutoMigrate(models...); err != nil {
		fmt.Fprintf(os.Stderr, "auto migrate: %v\n", err)
		os.Exit(1)
	}
	logger.Info("schema migrated", "tables", len(models))

	if err := seed(ctx, cfg, db); err != nil {
		fmt.Fprintf(os.Stderr, "seed: %v\n", err)
		os.Exit(1)
	}
	logger.Info("seed completed")
}
