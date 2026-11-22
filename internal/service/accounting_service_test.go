package service_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"wifiads/internal/model"
	"wifiads/internal/repository"
	"wifiads/internal/service"
	"wifiads/pkg/apperror"
)

type fakeAccountingRepo struct {
	sessions map[string]*model.AccountingSession
	events   map[string]*model.AccountingEvent
}

func newFakeAccountingRepo() *fakeAccountingRepo {
	return &fakeAccountingRepo{
		sessions: make(map[string]*model.AccountingSession),
		events:   make(map[string]*model.AccountingEvent),
	}
}

func sessionKey(nas, id string) string {
	return nas + "::" + id
}

func (f *fakeAccountingRepo) ApplyStart(ctx context.Context, s *model.AccountingSession) (*model.AccountingSession, error) {
	key := sessionKey(s.NASIdentifier, s.AcctSessionID)
	if existing, ok := f.sessions[key]; ok {
		return existing, nil
	}
	f.sessions[key] = s
	return s, nil
}

func (f *fakeAccountingRepo) ApplyInterim(ctx context.Context, nas, id string, u repository.AccountingUpdates) (*model.AccountingSession, error) {
	key := sessionKey(nas, id)
	s, ok := f.sessions[key]
	if !ok {
		return nil, apperror.ErrNotFound
	}
	s.SessionTimeSeconds = u.SessionTimeSeconds
	s.InputOctets = u.InputOctets
	s.OutputOctets = u.OutputOctets
	s.LastAccountingAt = u.LastAccountingAt
	return s, nil
}

func (f *fakeAccountingRepo) ApplyStop(ctx context.Context, nas, id string, u repository.AccountingUpdates) (*model.AccountingSession, error) {
	key := sessionKey(nas, id)
	s, ok := f.sessions[key]
	if !ok {
		return nil, apperror.ErrNotFound
	}
	s.Status = model.AccountingSessionStatusClosed
	s.SessionTimeSeconds = u.SessionTimeSeconds
	s.InputOctets = u.InputOctets
	s.OutputOctets = u.OutputOctets
	s.StoppedAt = u.StoppedAt
	s.TerminateCause = u.TerminateCause
	return s, nil
}

func (f *fakeAccountingRepo) CloseOtherActiveByMAC(ctx context.Context, mac, keepAcctSessionID string, at time.Time) error {
	return nil
}

func (f *fakeAccountingRepo) FindByNASAndAcctSession(ctx context.Context, nas, id string) (*model.AccountingSession, error) {
	if s, ok := f.sessions[sessionKey(nas, id)]; ok {
		return s, nil
	}
	return nil, apperror.ErrNotFound
}

func (f *fakeAccountingRepo) RecordEvent(ctx context.Context, e *model.AccountingEvent) (bool, error) {
	if _, ok := f.events[e.EventKey]; ok {
		return false, nil
	}
	f.events[e.EventKey] = e
	return true, nil
}

func (f *fakeAccountingRepo) ListSessions(ctx context.Context, filter repository.SessionFilter) ([]model.AccountingSession, int64, error) {
	return nil, 0, nil
}

func (f *fakeAccountingRepo) CountByStatus(ctx context.Context) (map[string]int64, error) {
	return map[string]int64{}, nil
}

func (f *fakeAccountingRepo) MarkStale(ctx context.Context, threshold time.Time) (int64, error) {
	var count int64
	for _, s := range f.sessions {
		if s.Status == model.AccountingSessionStatusActive && s.LastAccountingAt != nil && s.LastAccountingAt.Before(threshold) {
			s.Status = model.AccountingSessionStatusStale
			count++
		}
	}
	return count, nil
}

func (f *fakeAccountingRepo) HasActiveSessionForVoucher(ctx context.Context, vid string) (bool, error) {
	for _, s := range f.sessions {
		if s.VoucherID != nil && *s.VoucherID == vid && s.Status == model.AccountingSessionStatusActive {
			return true, nil
		}
	}
	return false, nil
}

func (f *fakeAccountingRepo) FindByID(ctx context.Context, id string) (*model.AccountingSession, error) {
	for _, s := range f.sessions {
		if s.ID == id {
			cp := *s
			return &cp, nil
		}
	}
	return nil, apperror.ErrNotFound
}

func (f *fakeAccountingRepo) FindActiveByMAC(ctx context.Context, mac string, routerID string) (*model.AccountingSession, error) {
	for _, s := range f.sessions {
		if s.CallingStationID == mac && s.Status == model.AccountingSessionStatusActive {
			if routerID != "" && (s.RouterID == nil || *s.RouterID != routerID) {
				continue
			}
			cp := *s
			return &cp, nil
		}
	}
	return nil, apperror.ErrNotFound
}

func (f *fakeAccountingRepo) AggregateByNAS(ctx context.Context) (map[string]repository.RouterAccountingStats, error) {
	return map[string]repository.RouterAccountingStats{}, nil
}

func (f *fakeAccountingRepo) CloseByID(ctx context.Context, id string, at time.Time, cause string) error {
	for _, s := range f.sessions {
		if s.ID == id {
			s.Status = model.AccountingSessionStatusClosed
			s.StoppedAt = &at
			s.TerminateCause = cause
		}
	}
	return nil
}

func (f *fakeAccountingRepo) FindByUsernames(ctx context.Context, usernames []string) ([]model.AccountingSession, error) {
	var result []model.AccountingSession
	uMap := make(map[string]bool)
	for _, u := range usernames {
		uMap[u] = true
	}
	for _, s := range f.sessions {
		if uMap[s.Username] {
			result = append(result, *s)
		}
	}
	return result, nil
}

func TestAccountingLifecycleStartAndStop(t *testing.T) {
	portalFake := newFakePortalRepo()
	acctFake := newFakeAccountingRepo()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	// Pre-seed an issued voucher
	vID := "v-123"
	voucher := &model.Voucher{
		Base:     model.Base{ID: vID},
		Username: "wf-user1",
		Status:   model.VoucherStatusIssued,
	}
	voucherRepo := &fakeVoucherRepo{fake: portalFake}
	_ = voucherRepo.Create(context.Background(), voucher)

	svc := service.NewAccountingService(
		acctFake,
		voucherRepo,
		&fakeVisitorRepo{},
		logger,
		15*time.Minute,
	)

	ctx := context.Background()

	// 1. Process Start
	err := svc.Process(ctx, service.RadiusAccountingRequest{
		NASIdentifier:      "nas-1",
		AcctSessionID:      "sess-acct-1",
		StatusType:         "Start",
		Username:           "wf-user1",
		CallingStationID:   "AA:BB:CC:DD:EE:01",
		SessionTimeSeconds: 0,
		EventKey:           "evt-start-1",
	})
	if err != nil {
		t.Fatalf("unexpected Start error: %v", err)
	}

	// Verify session is active
	session, err := acctFake.FindByNASAndAcctSession(ctx, "nas-1", "sess-acct-1")
	if err != nil {
		t.Fatalf("session not found: %v", err)
	}
	if session.Status != model.AccountingSessionStatusActive {
		t.Fatalf("expected ACTIVE status, got %s", session.Status)
	}

	// Verify voucher is now ACTIVE
	v, _ := voucherRepo.FindByUsername(ctx, "wf-user1")
	if v.Status != model.VoucherStatusActive {
		t.Fatalf("expected voucher status ACTIVE, got %s", v.Status)
	}

	// 2. Process Stop
	err = svc.Process(ctx, service.RadiusAccountingRequest{
		NASIdentifier:      "nas-1",
		AcctSessionID:      "sess-acct-1",
		StatusType:         "Stop",
		Username:           "wf-user1",
		CallingStationID:   "AA:BB:CC:DD:EE:01",
		SessionTimeSeconds: 120,
		TerminateCause:     "User-Request",
		EventKey:           "evt-stop-1",
	})
	if err != nil {
		t.Fatalf("unexpected Stop error: %v", err)
	}

	// Verify session is closed
	if session.Status != model.AccountingSessionStatusClosed {
		t.Fatalf("expected CLOSED status, got %s", session.Status)
	}
	if session.SessionTimeSeconds != 120 {
		t.Fatalf("expected SessionTimeSeconds=120, got %d", session.SessionTimeSeconds)
	}

	// Verify voucher is now USED
	v, _ = voucherRepo.FindByUsername(ctx, "wf-user1")
	if v.Status != model.VoucherStatusUsed {
		t.Fatalf("expected voucher status USED, got %s", v.Status)
	}
}

func TestAccountingMarkStale(t *testing.T) {
	portalFake := newFakePortalRepo()
	acctFake := newFakeAccountingRepo()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	staleAfter := 10 * time.Minute
	svc := service.NewAccountingService(
		acctFake,
		&fakeVoucherRepo{fake: portalFake},
		&fakeVisitorRepo{},
		logger,
		staleAfter,
	)

	ctx := context.Background()
	oldTime := time.Now().UTC().Add(-20 * time.Minute)

	// Session that hasn't reported accounting for 20 minutes
	staleSession := &model.AccountingSession{
		NASIdentifier:    "nas-1",
		AcctSessionID:    "sess-dead",
		Status:           model.AccountingSessionStatusActive,
		LastAccountingAt: &oldTime,
	}
	_, _ = acctFake.ApplyStart(ctx, staleSession)

	affected, err := svc.MarkStaleSessions(ctx)
	if err != nil {
		t.Fatalf("unexpected error marking stale: %v", err)
	}
	if affected != 1 {
		t.Fatalf("expected 1 stale session, got %d", affected)
	}
	if staleSession.Status != model.AccountingSessionStatusStale {
		t.Fatalf("expected status STALE, got %s", staleSession.Status)
	}
}
