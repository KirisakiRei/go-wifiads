package service_test

import (
	"context"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"wifiads/internal/model"
	"wifiads/internal/service"
	"wifiads/pkg/utils"
)

// TestConnectConcurrentIsIdempotent fires several Connect calls in parallel on
// the same portal session and asserts that exactly one voucher is created and
// every caller sees the same voucher (funneled through the unique constraint).
func TestConnectConcurrentIsIdempotent(t *testing.T) {
	fake := newFakePortalRepo()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	key := utils.DeriveDevKey("test-voucher-key")

	svc := service.NewPortalService(
		fake,
		&fakeVoucherRepo{fake: fake},
		&fakeVisitorRepo{},
		&fakeConnectProfileRepo{},
		&fakeRouterRepo{router: model.Router{Base: model.Base{ID: "r1"}, SiteID: "s1", Name: "r-test"}},
		&fakeSiteRepo{site: model.Site{Base: model.Base{ID: "s1"}, Name: "s-test"}},
		&fakeAdRepo{},
		logger,
		service.PortalServiceOptions{
			VoucherKey:            key,
			UsernamePrefix:        "wf",
			PasswordLength:        8,
			AdDuration:            time.Second,
			SessionTTL:            15 * time.Minute,
			VoucherTTL:            5 * time.Minute,
			DefaultSessionTimeout: 3600,
			DevMode:               true,
		},
	)

	ctx := context.Background()
	rawToken := "concurrent-token-0123456789abcdef"
	now := time.Now().UTC()
	session := &model.PortalSession{
		Base:          model.Base{ID: "sess-conc", CreatedAt: now, UpdatedAt: now},
		TokenHash:     utils.HashToken(rawToken),
		SiteID:        "s1",
		RouterID:      "r1",
		DeviceMAC:     "AA:BB:CC:DD:EE:FF",
		Status:        model.PortalSessionStatusPendingAd,
		AdStartedAt:   now.Add(-2 * time.Second), // countdown already elapsed
		ExpiresAt:     now.Add(15 * time.Minute),
		LinkLoginOnly: "http://10.0.0.1/login",
	}
	_ = fake.Create(ctx, session)

	const workers = 8
	var wg sync.WaitGroup
	usernames := make([]string, workers)
	errs := make([]error, workers)
	wg.Add(workers)
	for i := 0; i < workers; i++ {
		go func(idx int) {
			defer wg.Done()
			resp, err := svc.Connect(ctx, rawToken)
			if err != nil {
				errs[idx] = err
				return
			}
			usernames[idx] = resp.Username
		}(i)
	}
	wg.Wait()

	// Count distinct vouchers stored for the session: must be exactly one.
	stored := make(map[string]struct{})
	for _, v := range fake.vouchers {
		if v.PortalSessionID != nil && *v.PortalSessionID == session.ID {
			stored[v.Username] = struct{}{}
		}
	}
	if len(stored) != 1 {
		t.Fatalf("expected exactly 1 voucher for the session, got %d", len(stored))
	}

	for i, err := range errs {
		if err != nil {
			t.Fatalf("worker %d failed: %v", i, err)
		}
	}
	var first string
	for i, u := range usernames {
		if u == "" {
			t.Fatalf("worker %d got empty username", i)
		}
		if first == "" {
			first = u
			continue
		}
		if u != first {
			t.Fatalf("idempotency broken: got %q and %q", first, u)
		}
	}
}

// TestAccountingDuplicateStartIsIdempotent verifies that a retransmitted
// Accounting-Start for the same NAS + Acct-Session-Id does not create a second
// session record (UDP retries must be harmless).
func TestAccountingDuplicateStartIsIdempotent(t *testing.T) {
	portalFake := newFakePortalRepo()
	acctFake := newFakeAccountingRepo()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	svc := service.NewAccountingService(
		acctFake,
		&fakeVoucherRepo{fake: portalFake},
		&fakeVisitorRepo{},
		logger,
		15*time.Minute,
	)

	ctx := context.Background()
	req := service.RadiusAccountingRequest{
		NASIdentifier:    "nas-1",
		AcctSessionID:    "sess-dup",
		StatusType:       "Start",
		Username:         "wf-user",
		CallingStationID: "AA:BB:CC:DD:EE:01",
		EventKey:         "evt-start",
	}
	for i := 0; i < 3; i++ {
		if err := svc.Process(ctx, req); err != nil {
			t.Fatalf("Start #%d failed: %v", i, err)
		}
	}

	if len(acctFake.sessions) != 1 {
		t.Fatalf("expected 1 accounting session, got %d", len(acctFake.sessions))
	}
	if len(acctFake.events) != 1 {
		t.Fatalf("expected 1 deduped event, got %d", len(acctFake.events))
	}
}
