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
	"wifiads/pkg/utils"
)

type fakePortalRepo struct {
	sessions map[string]*model.PortalSession
	vouchers map[string]*model.Voucher
}

func newFakePortalRepo() *fakePortalRepo {
	return &fakePortalRepo{
		sessions: make(map[string]*model.PortalSession),
		vouchers: make(map[string]*model.Voucher),
	}
}

func (f *fakePortalRepo) Create(ctx context.Context, s *model.PortalSession) error {
	f.sessions[s.TokenHash] = s
	return nil
}
func (f *fakePortalRepo) FindByTokenHash(ctx context.Context, h string) (*model.PortalSession, error) {
	if s, ok := f.sessions[h]; ok {
		return s, nil
	}
	return nil, apperror.ErrNotFound
}
func (f *fakePortalRepo) FindByID(ctx context.Context, id string) (*model.PortalSession, error) {
	for _, s := range f.sessions {
		if s.ID == id {
			return s, nil
		}
	}
	return nil, apperror.ErrNotFound
}

func (f *fakePortalRepo) FindByIDs(ctx context.Context, ids []string) ([]model.PortalSession, error) {
	var res []model.PortalSession
	idMap := make(map[string]bool)
	for _, id := range ids {
		idMap[id] = true
	}
	for _, s := range f.sessions {
		if idMap[s.ID] {
			res = append(res, *s)
		}
	}
	return res, nil
}
func (f *fakePortalRepo) UpdateStatus(ctx context.Context, id string, st string) error {
	for _, s := range f.sessions {
		if s.ID == id {
			s.Status = st
			return nil
		}
	}
	return nil
}
func (f *fakePortalRepo) MarkVoucherIssued(ctx context.Context, id string, t time.Time) error {
	return f.UpdateStatus(ctx, id, model.PortalSessionStatusVoucherIssued)
}
func (f *fakePortalRepo) CountByStatus(ctx context.Context) (map[string]int64, error) {
	return map[string]int64{}, nil
}
func (f *fakePortalRepo) SaveSurvey(ctx context.Context, id, email, phone string, skipped bool, profileID string) error {
	return nil
}

type fakeVoucherRepo struct {
	fake *fakePortalRepo
}

func (v *fakeVoucherRepo) Create(ctx context.Context, m *model.Voucher) error {
	v.fake.vouchers[m.ID] = m
	return nil
}

// CreateForPortalSession mirrors the real "one portal session = one voucher"
// constraint so the service-level idempotency path is exercised in tests.
func (v *fakeVoucherRepo) CreateForPortalSession(ctx context.Context, m *model.Voucher) error {
	if m.PortalSessionID == nil || *m.PortalSessionID == "" {
		return apperror.New(apperror.ErrBadRequest, "portal_session_id is required")
	}
	for _, existing := range v.fake.vouchers {
		if existing.PortalSessionID != nil && *existing.PortalSessionID == *m.PortalSessionID {
			return apperror.ErrAlreadyExists
		}
	}
	v.fake.vouchers[m.ID] = m
	return nil
}
func (v *fakeVoucherRepo) FindByUsername(ctx context.Context, u string) (*model.Voucher, error) {
	for _, val := range v.fake.vouchers {
		if val.Username == u {
			return val, nil
		}
	}
	return nil, apperror.ErrNotFound
}

func (v *fakeVoucherRepo) FindByUsernames(ctx context.Context, usernames []string) ([]model.Voucher, error) {
	var result []model.Voucher
	uMap := make(map[string]bool)
	for _, u := range usernames {
		uMap[u] = true
	}
	for _, val := range v.fake.vouchers {
		if uMap[val.Username] {
			result = append(result, *val)
		}
	}
	return result, nil
}
func (v *fakeVoucherRepo) FindByID(ctx context.Context, id string) (*model.Voucher, error) {
	if val, ok := v.fake.vouchers[id]; ok {
		return val, nil
	}
	return nil, apperror.ErrNotFound
}
func (v *fakeVoucherRepo) FindByPortalSessionID(ctx context.Context, s string) (*model.Voucher, error) {
	for _, val := range v.fake.vouchers {
		if val.PortalSessionID != nil && *val.PortalSessionID == s {
			return val, nil
		}
	}
	return nil, apperror.ErrNotFound
}
func (v *fakeVoucherRepo) UpdateStatus(ctx context.Context, id, s string) error {
	if val, ok := v.fake.vouchers[id]; ok {
		val.Status = s
	}
	return nil
}
func (v *fakeVoucherRepo) MarkUsed(ctx context.Context, id string, t time.Time) error {
	if val, ok := v.fake.vouchers[id]; ok {
		val.Status = model.VoucherStatusUsed
		val.UsedAt = &t
	}
	return nil
}
func (v *fakeVoucherRepo) MarkExpiredBefore(ctx context.Context, now time.Time) (int64, error) {
	return 0, nil
}
func (v *fakeVoucherRepo) List(ctx context.Context, filter repository.VoucherFilter) ([]model.Voucher, int64, error) {
	return nil, 0, nil
}
func (v *fakeVoucherRepo) CountByStatus(ctx context.Context) (map[string]int64, error) {
	return map[string]int64{}, nil
}
func (v *fakeVoucherRepo) FindLatestByMAC(ctx context.Context, mac, routerID string) (*model.Voucher, error) {
	norm := utils.NormalizeMAC(mac)
	var latest *model.Voucher
	for _, val := range v.fake.vouchers {
		if val.ExpectedMAC == norm || val.ExpectedMAC == mac {
			if routerID == "" || val.RouterID == routerID {
				if latest == nil || val.CreatedAt.After(latest.CreatedAt) {
					latest = val
				}
			}
		}
	}
	if latest != nil {
		return latest, nil
	}
	return nil, apperror.ErrNotFound
}
func (v *fakeVoucherRepo) UpdatePortalSessionID(ctx context.Context, voucherID, portalSessionID string) error {
	if val, ok := v.fake.vouchers[voucherID]; ok {
		val.PortalSessionID = &portalSessionID
	}
	return nil
}

type fakeVisitorRepo struct{}

func (f *fakeVisitorRepo) Create(ctx context.Context, v *model.WifiVisitor) error { return nil }
func (f *fakeVisitorRepo) FindByPortalSessionID(ctx context.Context, id string) (*model.WifiVisitor, error) {
	return nil, apperror.ErrNotFound
}
func (f *fakeVisitorRepo) AttachVoucher(ctx context.Context, psid, vid, u string, t time.Time) error {
	return nil
}
func (f *fakeVisitorRepo) MarkConnected(ctx context.Context, u string, t time.Time) error {
	return nil
}
func (f *fakeVisitorRepo) MarkDisconnected(ctx context.Context, u string, t time.Time, s int64) error {
	return nil
}
func (f *fakeVisitorRepo) MarkStale(ctx context.Context, u string) error { return nil }
func (f *fakeVisitorRepo) List(ctx context.Context, filter repository.VisitorFilter) ([]model.WifiVisitor, int64, error) {
	return nil, 0, nil
}
func (f *fakeVisitorRepo) CountByStatus(ctx context.Context) (map[string]int64, error) {
	return map[string]int64{}, nil
}

type fakeRouterRepo struct{ router model.Router }

func (f *fakeRouterRepo) Create(ctx context.Context, r *model.Router) error { return nil }
func (f *fakeRouterRepo) FindByID(ctx context.Context, id string) (*model.Router, error) {
	return &f.router, nil
}
func (f *fakeRouterRepo) FindByNASIdentifier(ctx context.Context, nas string) (*model.Router, error) {
	return &f.router, nil
}
func (f *fakeRouterRepo) ListActive(ctx context.Context) ([]model.Router, error) {
	return []model.Router{f.router}, nil
}
func (f *fakeRouterRepo) Count(ctx context.Context) (int64, error) { return 1, nil }
func (f *fakeRouterRepo) UpdateVoucherConfig(ctx context.Context, id string, prefix string, digitCount int, numericOnly bool, defaultProfileID *string, surveyProfileID *string, ttlSeconds int, sessionTimeoutSeconds int) error {
	f.router.VoucherPrefix = prefix
	f.router.VoucherDigitCount = digitCount
	f.router.VoucherNumericOnly = numericOnly
	f.router.DefaultProfileID = defaultProfileID
	f.router.SurveyProfileID = surveyProfileID
	f.router.VoucherTTLSeconds = ttlSeconds
	f.router.SessionTimeoutSeconds = sessionTimeoutSeconds
	return nil
}

type fakeSiteRepo struct{ site model.Site }

func (f *fakeSiteRepo) Create(ctx context.Context, s *model.Site) error { return nil }
func (f *fakeSiteRepo) FindByID(ctx context.Context, id string) (*model.Site, error) {
	return &f.site, nil
}
func (f *fakeSiteRepo) First(ctx context.Context) (*model.Site, error) {
	return &f.site, nil
}
func (f *fakeSiteRepo) Count(ctx context.Context) (int64, error) { return 1, nil }

type fakeAdRepo struct{}

func (f *fakeAdRepo) Create(ctx context.Context, a *model.Advertisement) error { return nil }
func (f *fakeAdRepo) FindByID(ctx context.Context, id string) (*model.Advertisement, error) {
	return nil, apperror.ErrNotFound
}
func (f *fakeAdRepo) FindActive(ctx context.Context) (*model.Advertisement, error) {
	return nil, apperror.ErrNotFound
}
func (f *fakeAdRepo) List(ctx context.Context) ([]model.Advertisement, error) {
	return nil, nil
}
func (f *fakeAdRepo) Update(ctx context.Context, a *model.Advertisement) error {
	return nil
}
func (f *fakeAdRepo) Delete(ctx context.Context, id string) error {
	return nil
}
func (f *fakeAdRepo) Count(ctx context.Context) (int64, error) { return 0, nil }

type fakeConnectProfileRepo struct{}

func (f *fakeConnectProfileRepo) Create(ctx context.Context, p *model.ConnectProfile) error {
	return nil
}
func (f *fakeConnectProfileRepo) FindByID(ctx context.Context, id string) (*model.ConnectProfile, error) {
	return nil, apperror.ErrNotFound
}
func (f *fakeConnectProfileRepo) FindByName(ctx context.Context, name string) (*model.ConnectProfile, error) {
	return nil, apperror.ErrNotFound
}
func (f *fakeConnectProfileRepo) FindDefault(ctx context.Context) (*model.ConnectProfile, error) {
	return nil, apperror.ErrNotFound
}
func (f *fakeConnectProfileRepo) FindForSurveyCompleted(ctx context.Context) (*model.ConnectProfile, error) {
	return nil, apperror.ErrNotFound
}
func (f *fakeConnectProfileRepo) ListActive(ctx context.Context) ([]model.ConnectProfile, error) {
	return nil, nil
}
func (f *fakeConnectProfileRepo) Update(ctx context.Context, p *model.ConnectProfile) error {
	return nil
}
func (f *fakeConnectProfileRepo) Delete(ctx context.Context, id string) error { return nil }
func (f *fakeConnectProfileRepo) Count(ctx context.Context) (int64, error)    { return 0, nil }

func TestConnectEnforcesTimerAndIdempotency(t *testing.T) {
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
			AdDuration:            3 * time.Second,
			SessionTTL:            15 * time.Minute,
			VoucherTTL:            5 * time.Minute,
			DefaultSessionTimeout: 3600,
			DevMode:               true,
		},
	)

	ctx := context.Background()
	now := time.Now().UTC()
	rawToken := "abcdef0123456789abcdef0123456789"
	session := &model.PortalSession{
		Base:          model.Base{ID: "sess-1", CreatedAt: now, UpdatedAt: now},
		TokenHash:     utils.HashToken(rawToken),
		SiteID:        "s1",
		RouterID:      "r1",
		DeviceMAC:     "AA:BB:CC:DD:EE:FF",
		DeviceIP:      "10.0.0.1",
		Status:        model.PortalSessionStatusPendingAd,
		AdStartedAt:   now,
		ExpiresAt:     now.Add(15 * time.Minute),
		LinkLoginOnly: "http://10.0.0.1/login",
	}
	_ = fake.Create(ctx, session)

	// 1. Calling Connect immediately should fail (ad countdown not finished)
	_, err := svc.Connect(ctx, rawToken)
	if err == nil {
		t.Fatalf("expected error before countdown finished, got nil")
	}

	// 2. Advance session AdStartedAt past the adDuration
	session.AdStartedAt = now.Add(-4 * time.Second)

	// 3. First valid Connect should issue a voucher
	resp1, err := svc.Connect(ctx, rawToken)
	if err != nil {
		t.Fatalf("unexpected connect error: %v", err)
	}
	if resp1.Username == "" || resp1.Password == "" {
		t.Fatalf("expected non-empty username and password, got %v", resp1)
	}

	// 4. Second Connect must be idempotent: returns the exact same voucher
	resp2, err := svc.Connect(ctx, rawToken)
	if err != nil {
		t.Fatalf("unexpected second connect error: %v", err)
	}
	if resp2.Username != resp1.Username || resp2.Password != resp1.Password {
		t.Fatalf("expected idempotent response, got %s vs %s", resp1.Username, resp2.Username)
	}
}

func TestConnectRejectsExpiredSession(t *testing.T) {
	fake := newFakePortalRepo()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	key := utils.DeriveDevKey("test-voucher-key")

	svc := service.NewPortalService(
		fake,
		&fakeVoucherRepo{fake: fake},
		&fakeVisitorRepo{},
		&fakeConnectProfileRepo{},
		&fakeRouterRepo{router: model.Router{Base: model.Base{ID: "r1"}, SiteID: "s1"}},
		&fakeSiteRepo{site: model.Site{Base: model.Base{ID: "s1"}}},
		&fakeAdRepo{},
		logger,
		service.PortalServiceOptions{
			VoucherKey:     key,
			AdDuration:     1 * time.Second,
			SessionTTL:     10 * time.Minute,
			VoucherTTL:     5 * time.Minute,
			UsernamePrefix: "wf",
			PasswordLength: 8,
			DevMode:        true,
		},
	)

	ctx := context.Background()
	now := time.Now().UTC()
	rawToken := "expired-token-123456789012345678"
	session := &model.PortalSession{
		Base:          model.Base{ID: "sess-expired", CreatedAt: now.Add(-20 * time.Minute), UpdatedAt: now.Add(-20 * time.Minute)},
		TokenHash:     utils.HashToken(rawToken),
		Status:        model.PortalSessionStatusPendingAd,
		AdStartedAt:   now.Add(-20 * time.Minute),
		ExpiresAt:     now.Add(-5 * time.Minute),
		LinkLoginOnly: "http://10.0.0.1/login",
	}
	_ = fake.Create(ctx, session)

	_, err := svc.Connect(ctx, rawToken)
	if err == nil {
		t.Fatalf("expected error for expired session, got nil")
	}
}

func TestConnectSmartReuseAndRouterConfig(t *testing.T) {
	fake := newFakePortalRepo()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	key := utils.DeriveDevKey("test-voucher-key")

	router := model.Router{
		Base:                  model.Base{ID: "r-mk1"},
		SiteID:                "s1",
		Name:                  "MikroTik Utama",
		NASIdentifier:         "MK1",
		VoucherPrefix:         "MK1-",
		VoucherDigitCount:     6,
		VoucherNumericOnly:    true,
		VoucherTTLSeconds:     3600,
		SessionTimeoutSeconds: 1800,
	}

	svc := service.NewPortalService(
		fake,
		&fakeVoucherRepo{fake: fake},
		&fakeVisitorRepo{},
		&fakeConnectProfileRepo{},
		&fakeRouterRepo{router: router},
		&fakeSiteRepo{site: model.Site{Base: model.Base{ID: "s1"}, Name: "s-test"}},
		&fakeAdRepo{},
		logger,
		service.PortalServiceOptions{
			VoucherKey:            key,
			UsernamePrefix:        "wf",
			PasswordLength:        8,
			AdDuration:            1 * time.Second,
			SessionTTL:            15 * time.Minute,
			VoucherTTL:            5 * time.Minute,
			DefaultSessionTimeout: 3600,
			DevMode:               true,
		},
	)

	ctx := context.Background()
	now := time.Now().UTC()
	rawToken1 := "token-session-1-123456789012345678"
	session1 := &model.PortalSession{
		Base:          model.Base{ID: "sess-1", CreatedAt: now, UpdatedAt: now},
		TokenHash:     utils.HashToken(rawToken1),
		SiteID:        "s1",
		RouterID:      "r-mk1",
		DeviceMAC:     "AA:BB:CC:11:22:33",
		DeviceIP:      "10.0.0.50",
		Status:        model.PortalSessionStatusPendingAd,
		AdStartedAt:   now.Add(-5 * time.Second),
		ExpiresAt:     now.Add(15 * time.Minute),
		LinkLoginOnly: "http://10.0.0.1/login",
	}
	_ = fake.Create(ctx, session1)

	// 1. First Connect should create voucher with router prefix "MK1-"
	resp1, err := svc.Connect(ctx, rawToken1)
	if err != nil {
		t.Fatalf("first connect failed: %v", err)
	}
	if len(resp1.Username) < 4 || resp1.Username[:4] != "MK1-" {
		t.Fatalf("expected voucher to have prefix MK1-, got %s", resp1.Username)
	}

	// 2. Second session created by SAME device (e.g. user refreshed or reconnected)
	rawToken2 := "token-session-2-987654321098765432"
	session2 := &model.PortalSession{
		Base:          model.Base{ID: "sess-2", CreatedAt: now, UpdatedAt: now},
		TokenHash:     utils.HashToken(rawToken2),
		SiteID:        "s1",
		RouterID:      "r-mk1",
		DeviceMAC:     "AA:BB:CC:11:22:33", // Same device MAC
		DeviceIP:      "10.0.0.50",
		Status:        model.PortalSessionStatusPendingAd,
		AdStartedAt:   now.Add(-5 * time.Second),
		ExpiresAt:     now.Add(15 * time.Minute),
		LinkLoginOnly: "http://10.0.0.1/login",
	}
	_ = fake.Create(ctx, session2)

	// Connect should REUSE the same unexpired voucher without creating a new one (anti-spam)
	resp2, err := svc.Connect(ctx, rawToken2)
	if err != nil {
		t.Fatalf("second connect failed: %v", err)
	}
	if resp2.Username != resp1.Username {
		t.Fatalf("expected smart reuse of voucher %s, but got new voucher %s", resp1.Username, resp2.Username)
	}

	// 3. If voucher 1 expired in the past, a new session should expire it and generate a new voucher
	for _, v := range fake.vouchers {
		if v.Username == resp1.Username {
			v.ExpiresAt = now.Add(-10 * time.Minute)
		}
	}

	rawToken3 := "token-session-3-555555555555555555"
	session3 := &model.PortalSession{
		Base:          model.Base{ID: "sess-3", CreatedAt: now, UpdatedAt: now},
		TokenHash:     utils.HashToken(rawToken3),
		SiteID:        "s1",
		RouterID:      "r-mk1",
		DeviceMAC:     "AA:BB:CC:11:22:33",
		DeviceIP:      "10.0.0.50",
		Status:        model.PortalSessionStatusPendingAd,
		AdStartedAt:   now.Add(-5 * time.Second),
		ExpiresAt:     now.Add(15 * time.Minute),
		LinkLoginOnly: "http://10.0.0.1/login",
	}
	_ = fake.Create(ctx, session3)

	resp3, err := svc.Connect(ctx, rawToken3)
	if err != nil {
		t.Fatalf("third connect failed: %v", err)
	}
	if resp3.Username == resp1.Username {
		t.Fatalf("expected new voucher since previous was expired, but got same %s", resp3.Username)
	}

	// Check that voucher 1 was marked EXPIRED
	for _, v := range fake.vouchers {
		if v.Username == resp1.Username {
			if v.Status != model.VoucherStatusExpired {
				t.Fatalf("expected old voucher to be marked EXPIRED, got %s", v.Status)
			}
		}
	}
}
