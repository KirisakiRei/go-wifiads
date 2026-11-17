package config

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// Connect opens the PostgreSQL connection pool and verifies it is reachable.
func Connect(cfg *Config, logger *slog.Logger) (*gorm.DB, error) {
	logLevel := gormlogger.Silent
	if !cfg.IsProduction() {
		logLevel = gormlogger.Warn
	}

	db, err := gorm.Open(postgres.Open(cfg.DB.DSN()), &gorm.Config{
		Logger: gormlogger.Default.LogMode(logLevel),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("access sql handle: %w", err)
	}
	sqlDB.SetMaxIdleConns(cfg.DB.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.DB.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(cfg.ConnMaxLifetime())

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}

	logger.Info("database connected",
		slog.String("host", cfg.DB.Host),
		slog.String("database", cfg.DB.Name),
	)
	return db, nil
}

// NewLogger builds the structured logger used by every binary.
// Jika LOG_FILE di-set, output ditulis ke stdout DAN file tersebut (tee).
func NewLogger(level, appEnv string) *slog.Logger {
	var slogLevel slog.Level
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "debug":
		slogLevel = slog.LevelDebug
	case "warn":
		slogLevel = slog.LevelWarn
	case "error":
		slogLevel = slog.LevelError
	default:
		slogLevel = slog.LevelInfo
	}

	var writer io.Writer = os.Stdout
	if logFile := strings.TrimSpace(os.Getenv("LOG_FILE")); logFile != "" {
		_ = os.MkdirAll(filepath.Dir(logFile), 0o755)
		f, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
		if err == nil {
			writer = io.MultiWriter(os.Stdout, f)
		}
	}

	options := &slog.HandlerOptions{Level: slogLevel}
	var handler slog.Handler
	if appEnv == EnvDevelopment {
		handler = slog.NewTextHandler(writer, options)
	} else {
		handler = slog.NewJSONHandler(writer, options)
	}
	return slog.New(handler)
}
