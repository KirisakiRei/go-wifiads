package service_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"wifiads/internal/model"
	"wifiads/internal/service"
	"wifiads/pkg/apperror"
	"wifiads/pkg/utils"
)

func TestRecordRouterHeartbeat(t *testing.T) {
	key := []byte("0123456789abcdef0123456789abcdef")
	secret := "TTLf6ti8jVNZXucPxxM9+ECa7cxEG9LM"
	cipher, err := utils.EncryptString(key, secret)
	if err != nil {
		t.Fatalf("encrypt secret: %v", err)
	}

	nasRepo := &fakeNASRepo{
		byIP: map[string]*model.NASClient{
			"10.10.0.1": {
				Base:             model.Base{ID: "nas-1"},
				NASIdentifier:    "wifiads-router",
				SecretCiphertext: cipher,
				IsActive:         true,
			},
		},
	}
	routerRepo := &fakeRouterRepo{
		router: model.Router{
			Base:          model.Base{ID: "rtr-1"},
			Name:          "wifiads-router",
			NASIdentifier: "wifiads-router",
			Status:        model.RouterStatusActive,
		},
	}

	svc := service.NewAdminService(nil, nil, nil, nil, nil, routerRepo, service.AdminServiceOptions{
		NASClients:      nasRepo,
		RadiusSecretKey: key,
	})

	ctx := context.Background()
	if _, err := svc.RecordRouterHeartbeat(ctx, "wifiads-router", "wrong-secret"); !errors.Is(err, apperror.ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized for wrong secret, got %v", err)
	}
	if routerRepo.router.LastSeenAt != nil {
		t.Fatalf("expected LastSeenAt to stay nil on rejected heartbeat")
	}

	seenAt, err := svc.RecordRouterHeartbeat(ctx, "wifiads-router", secret)
	if err != nil {
		t.Fatalf("RecordRouterHeartbeat (secret) failed: %v", err)
	}
	if routerRepo.router.LastSeenAt == nil || !service.IsRouterOnline(routerRepo.router.LastSeenAt) {
		t.Fatalf("expected router to be marked online, got LastSeenAt=%v", routerRepo.router.LastSeenAt)
	}
	if time.Since(seenAt) > 5*time.Second {
		t.Fatalf("expected fresh seenAt timestamp, got %v", seenAt)
	}

	// Verify HMAC token auth (used by RouterOS v5.9 HTTP GET /tool fetch).
	routerRepo.router.LastSeenAt = nil
	hbToken := service.ComputeRouterHeartbeatToken("wifiads-router", secret)
	if len(hbToken) != 32 {
		t.Fatalf("expected 32-char hex heartbeat token, got %q", hbToken)
	}
	if _, err := svc.RecordRouterHeartbeat(ctx, "wifiads-router", hbToken); err != nil {
		t.Fatalf("RecordRouterHeartbeat (token) failed: %v", err)
	}
	if routerRepo.router.LastSeenAt == nil {
		t.Fatalf("expected LastSeenAt updated via HMAC token")
	}
}
