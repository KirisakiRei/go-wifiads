package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"wifiads/internal/config"
	"wifiads/internal/radius"
	"wifiads/internal/repository"
	"wifiads/internal/service"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load configuration", slog.String("error", err.Error()))
		os.Exit(1)
	}

	logger := config.NewLogger(cfg.LogLevel, cfg.AppEnv)
	slog.SetDefault(logger)

	db, err := config.Connect(cfg, logger)
	if err != nil {
		logger.Error("failed to connect to database", slog.String("error", err.Error()))
		os.Exit(1)
	}

	nasClients := repository.NewNASClientRepository(db)
	vouchers := repository.NewVoucherRepository(db)
	accounting := repository.NewAccountingRepository(db)
	visitors := repository.NewWifiVisitorRepository(db)
	blockedDevices := repository.NewBlockedDeviceRepository(db)
	routers := repository.NewRouterRepository(db)

	authService := service.NewRadiusAuthService(nasClients, vouchers, accounting, logger, cfg.Keys.VoucherKey, cfg.Keys.RadiusSecretKey)
	service.SetRadiusBlockedDeviceRepo(authService, blockedDevices)
	service.SetRadiusRouterRepo(authService, routers)
	accountingService := service.NewAccountingService(accounting, vouchers, visitors, logger, cfg.StaleAfter())
	service.SetAccountingRouterRepo(accountingService, routers)

	server := radius.NewServer(authService, accountingService, logger, cfg.Radius.AuthAddr, cfg.Radius.AcctAddr)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go janitor(ctx, accountingService, logger, cfg.StaleAfter())

	if runErr := server.Run(ctx); runErr != nil {
		logger.Error("radius server stopped", slog.String("error", runErr.Error()))
		os.Exit(1)
	}
	logger.Info("radius server shut down")
}

// janitor periodically flags sessions that stopped reporting accounting.
func janitor(ctx context.Context, accountant service.RadiusAccountant, logger *slog.Logger, staleAfter time.Duration) {
	interval := staleAfter / 2
	if interval < 30*time.Second {
		interval = 30 * time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := accountant.MarkStaleSessions(ctx); err != nil {
				logger.Warn("failed to mark stale sessions", slog.String("error", err.Error()))
			}
		}
	}
}
