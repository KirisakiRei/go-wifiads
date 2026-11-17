package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"wifiads/internal/config"
	"wifiads/internal/router"
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

	engine, err := router.New(cfg, db, logger)
	if err != nil {
		logger.Error("failed to build router", slog.String("error", err.Error()))
		os.Exit(1)
	}

	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           engine,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		logger.Info("api server listening", slog.String("addr", cfg.HTTPAddr), slog.String("env", cfg.AppEnv))
		if listenErr := server.ListenAndServe(); listenErr != nil && !errors.Is(listenErr, http.ErrServerClosed) {
			logger.Error("http server stopped", slog.String("error", listenErr.Error()))
			stop()
		}
	}()

	<-ctx.Done()
	logger.Info("shutting down api server")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", slog.String("error", err.Error()))
	}
}
