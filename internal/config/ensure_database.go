package config

import (
	"fmt"
	"log/slog"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// EnsureDatabase creates the target database when it does not exist yet. It
// connects to the maintenance database first, which keeps local setup to a
// single command.
func EnsureDatabase(cfg *Config, logger *slog.Logger) error {
	maintenance := cfg.DB
	maintenance.Name = "postgres"

	db, err := gorm.Open(postgres.Open(maintenance.DSN()), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Silent),
	})
	if err != nil {
		return fmt.Errorf("connect to maintenance database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("access maintenance handle: %w", err)
	}
	defer func() {
		_ = sqlDB.Close()
	}()

	var exists int
	if err := db.Raw("SELECT 1 FROM pg_database WHERE datname = ?", cfg.DB.Name).Scan(&exists).Error; err != nil {
		return fmt.Errorf("check database existence: %w", err)
	}
	if exists == 1 {
		return nil
	}

	statement := fmt.Sprintf("CREATE DATABASE %q", cfg.DB.Name)
	if err := db.Exec(statement).Error; err != nil {
		return fmt.Errorf("create database %s: %w", cfg.DB.Name, err)
	}
	logger.Info("database created", slog.String("database", cfg.DB.Name))
	return nil
}
