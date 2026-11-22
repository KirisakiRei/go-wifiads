package service_test

import (
	"context"
	"errors"
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

// fakeNASRepo is a minimal NAS registry for auth tests.
type fakeNASRepo struct {
	byIP map[string]*model.NASClient
}

func (f *fakeNASRepo) Create(ctx context.Context, c *model.NASClient) error { return nil }
func (f *fakeNASRepo) UpsertForRouter(ctx context.Context, c *model.NASClient) error {
	f.byIP[c.IPAddress] = c
	return nil
}
func (f *fakeNASRepo) FindByRouterID(ctx context.Context, routerID string) (*model.NASClient, error) {
	for _, c := range f.byIP {
		if c.RouterID == routerID {
			return c, nil
		}
	}
	return nil, apperror.ErrNotFound
}
func (f *fakeNASRepo) ListAll(ctx context.Context) ([]model.NASClient, error) {
	out := make([]model.NASClient, 0, len(f.byIP))
	for _, c := range f.byIP {
		out = append(out, *c)
	}
	return out, nil
}
func (f *fakeNASRepo) FindByIP(ctx context.Context, ip string) (*model.NASClient, error) {
	if c, ok := f.byIP[ip]; ok {
		return c, nil
	}
	return nil, apperror.ErrNotFound
}
func (f *fakeNASRepo) FindByNASIdentifier(ctx context.Context, nas string) (*model.NASClient, error) {
	for _, c := range f.byIP {
		if c.NASIdentifier == nas {
			return c, nil
		}
	}
	return nil, apperror.ErrNotFound
}
func (f *fakeNASRepo) Count(ctx context.Context) (int64, error) { return int64(len(f.byIP)), nil }
func (f *fakeNASRepo) DeactivateByRouterID(ctx context.Context, routerID string) error {
	for _, c := range f.byIP {
		if c.RouterID == routerID {
			c.IsActive = false
		}
	}
	return nil
}

type authFixture struct {
	svc      service.RadiusAuthenticator
	vouchers *fakeVoucherRepo
	acct     *fakeAccountingRepo
	voucher  *model.Voucher
	password string
}

const (
	testNASIP     = "192.168.88.1"
	testNASID     = "alpha-router-01"
	testRouterID  = "router-1"
	testSecretKey = "radius-secret-key"
	testMAC       = "AA:BB:CC:DD:EE:01"
)

func newAuthFixture(t *testing.T) *authFixture {
	t.Helper()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	voucherKey := utils.DeriveDevKey("voucher-key")
	secretKey := utils.DeriveDevKey(testSecretKey)

	secretCipher, err := utils.EncryptString(secretKey, "super-secret")
	if err != nil {
		t.Fatalf("encrypt nas secret: %v", err)
	}

	nas := &fakeNASRepo{byIP: map[string]*model.NASClient{
		testNASIP: {
			Base:             model.Base{ID: "nas-1"},
			NASIdentifier:    testNASID,
			IPAddress:        testNASIP,
			RouterID:         testRouterID,
			SecretCiphertext: secretCipher,
			IsActive:         true,
		},
	}}

	portal := newFakePortalRepo()
	vouchers := &fakeVoucherRepo{fake: portal}
	acct := newFakeAccountingRepo()

	password := "secret12"
	passwordCipher, err := utils.EncryptString(voucherKey, password)
	if err != nil {
		t.Fatalf("encrypt voucher password: %v", err)
	}
	voucher := &model.Voucher{
		Base:                  model.Base{ID: "voucher-1"},
		Username:              "wf-test",
		PasswordCiphertext:    passwordCipher,
		Status:                model.VoucherStatusIssued,
		RouterID:              testRouterID,
		ExpectedMAC:           testMAC,
		ExpiresAt:             time.Now().UTC().Add(5 * time.Minute),
		SessionTimeoutSeconds: 3600,
	}
	if err := vouchers.Create(context.Background(), voucher); err != nil {
		t.Fatalf("seed voucher: %v", err)
	}

	svc := service.NewRadiusAuthService(nas, vouchers, acct, logger, voucherKey, secretKey)
	return &authFixture{svc: svc, vouchers: vouchers, acct: acct, voucher: voucher, password: password}
}

func (f *authFixture) request() service.RadiusAuthRequest {
	return service.RadiusAuthRequest{
		RemoteIP:         testNASIP,
		NASIdentifier:    testNASID,
		Username:         f.voucher.Username,
		Password:         f.password,
		CallingStationID: testMAC,
	}
}

func TestAuthenticateAcceptsValidVoucher(t *testing.T) {
	f := newAuthFixture(t)
	result, err := f.svc.Authenticate(context.Background(), f.request())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Accepted {
		t.Fatalf("expected accept, got reject: %s", result.Reason)
	}
	if result.SessionTimeoutSeconds != 3600 {
		t.Fatalf("expected session timeout 3600, got %d", result.SessionTimeoutSeconds)
	}
}

func TestAuthenticateAcceptsValidCHAP(t *testing.T) {
	f := newAuthFixture(t)
	req := f.request()
	req.Password = ""
	challenge := []byte("chap-challenge-bytes")
	req.HasCHAP = true
	req.CHAPChallenge = challenge
	req.CHAPPassword = append([]byte{0x2a}, utils.ComputeCHAPResponse(0x2a, []byte(f.password), challenge)...)

	result, err := f.svc.Authenticate(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Accepted {
		t.Fatalf("expected CHAP accept, got reject: %s", result.Reason)
	}
}

func TestAuthenticateRejectsWrongPassword(t *testing.T) {
	f := newAuthFixture(t)
	req := f.request()
	req.Password = "wrongpass"
	result, err := f.svc.Authenticate(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Accepted || result.Reason != "invalid_credentials" {
		t.Fatalf("expected invalid_credentials, got accepted=%v reason=%s", result.Accepted, result.Reason)
	}
}

func TestAuthenticateRejectsExpiredVoucher(t *testing.T) {
	f := newAuthFixture(t)
	f.voucher.ExpiresAt = time.Now().UTC().Add(-time.Minute)

	result, _ := f.svc.Authenticate(context.Background(), f.request())
	if result.Accepted || result.Reason != "voucher_expired" {
		t.Fatalf("expected voucher_expired, got accepted=%v reason=%s", result.Accepted, result.Reason)
	}
	// The voucher should also be flipped to EXPIRED for the dashboard.
	if f.voucher.Status != model.VoucherStatusExpired {
		t.Fatalf("expected voucher status EXPIRED, got %s", f.voucher.Status)
	}
}

func TestAuthenticateRejectsRevokedVoucher(t *testing.T) {
	f := newAuthFixture(t)
	f.voucher.Status = model.VoucherStatusRevoked
	result, _ := f.svc.Authenticate(context.Background(), f.request())
	if result.Accepted || result.Reason != "voucher_revoked" {
		t.Fatalf("expected voucher_revoked, got accepted=%v reason=%s", result.Accepted, result.Reason)
	}
}

func TestAuthenticateRejectsUsedVoucher(t *testing.T) {
	f := newAuthFixture(t)
	f.voucher.Status = model.VoucherStatusUsed
	result, _ := f.svc.Authenticate(context.Background(), f.request())
	if result.Accepted || result.Reason != "voucher_used" {
		t.Fatalf("expected voucher_used, got accepted=%v reason=%s", result.Accepted, result.Reason)
	}
}

func TestAuthenticateRejectsMACMismatch(t *testing.T) {
	f := newAuthFixture(t)
	req := f.request()
	req.CallingStationID = "AA:BB:CC:DD:EE:99"
	result, _ := f.svc.Authenticate(context.Background(), req)
	if result.Accepted || result.Reason != "mac_mismatch" {
		t.Fatalf("expected mac_mismatch, got accepted=%v reason=%s", result.Accepted, result.Reason)
	}
}

func TestAuthenticateRejectsUnknownNAS(t *testing.T) {
	f := newAuthFixture(t)
	req := f.request()
	req.RemoteIP = "10.0.0.66"
	req.NASIdentifier = ""
	result, err := f.svc.Authenticate(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Accepted || result.Reason != "unknown_nas" {
		t.Fatalf("expected unknown_nas, got accepted=%v reason=%s", result.Accepted, result.Reason)
	}
}

func TestAuthenticateRejectsRouterMismatch(t *testing.T) {
	f := newAuthFixture(t)
	f.voucher.RouterID = "another-router"
	result, _ := f.svc.Authenticate(context.Background(), f.request())
	if result.Accepted || result.Reason != "router_mismatch" {
		t.Fatalf("expected router_mismatch, got accepted=%v reason=%s", result.Accepted, result.Reason)
	}
}

func TestAuthenticateRejectsUnknownVoucher(t *testing.T) {
	f := newAuthFixture(t)
	req := f.request()
	req.Username = "does-not-exist"
	result, _ := f.svc.Authenticate(context.Background(), req)
	if result.Accepted || result.Reason != "unknown_voucher" {
		t.Fatalf("expected unknown_voucher, got accepted=%v reason=%s", result.Accepted, result.Reason)
	}
}

// TestAuthenticateRejectsSecondDeviceWhenSessionActive covers the Port-Limit=1
// rule for an unbound voucher (no MAC binding): once a live session exists, a
// second login attempt is rejected as a conflict instead of stealing it.
func TestAuthenticateRejectsSecondDeviceWhenSessionActive(t *testing.T) {
	f := newAuthFixture(t)
	f.voucher.ExpectedMAC = "" // no MAC binding: the active-session check is the only guard
	voucherID := f.voucher.ID
	_, _ = f.acct.ApplyStart(context.Background(), &model.AccountingSession{
		NASIdentifier: testNASID,
		AcctSessionID: "acct-1",
		VoucherID:     &voucherID,
		Status:        model.AccountingSessionStatusActive,
	})

	result, _ := f.svc.Authenticate(context.Background(), f.request())
	if result.Accepted || result.Reason != "session_conflict" {
		t.Fatalf("expected session_conflict, got accepted=%v reason=%s", result.Accepted, result.Reason)
	}
}

// TestAuthenticateAllowsSameDeviceReauthWithBoundMAC documents that a MAC-bound
// voucher with an active session may re-authenticate from the same device (NAS
// retry), because the MAC check already proves it is the bound device.
func TestAuthenticateAllowsSameDeviceReauthWithBoundMAC(t *testing.T) {
	f := newAuthFixture(t)
	voucherID := f.voucher.ID
	_, _ = f.acct.ApplyStart(context.Background(), &model.AccountingSession{
		NASIdentifier: testNASID,
		AcctSessionID: "acct-1",
		VoucherID:     &voucherID,
		Status:        model.AccountingSessionStatusActive,
	})

	result, err := f.svc.Authenticate(context.Background(), f.request())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Accepted {
		t.Fatalf("expected same-device re-auth to be accepted, got %s", result.Reason)
	}
}

func TestLookupNASRejectsUnknownPeer(t *testing.T) {
	f := newAuthFixture(t)
	_, _, err := f.svc.LookupNAS(context.Background(), "10.9.9.9:40000")
	if err == nil {
		t.Fatalf("expected error for unknown NAS")
	}
	if !errors.Is(err, apperror.ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized, got %v", err)
	}
}

func TestLookupNASReturnsSecret(t *testing.T) {
	f := newAuthFixture(t)
	_, secret, err := f.svc.LookupNAS(context.Background(), testNASIP+":40000")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if secret != "super-secret" {
		t.Fatalf("expected decrypted secret, got %q", secret)
	}
}

type fakeBlockedDeviceRepo struct {
	blocked map[string]*model.BlockedDevice
}

func (f *fakeBlockedDeviceRepo) Block(ctx context.Context, d *model.BlockedDevice) error {
	f.blocked[utils.NormalizeMAC(d.MAC)] = d
	return nil
}
func (f *fakeBlockedDeviceRepo) UnblockByMAC(ctx context.Context, mac, routerID string) (int64, error) {
	delete(f.blocked, utils.NormalizeMAC(mac))
	return 1, nil
}
func (f *fakeBlockedDeviceRepo) IsBlocked(ctx context.Context, mac, routerID string) (*model.BlockedDevice, error) {
	if d, ok := f.blocked[utils.NormalizeMAC(mac)]; ok {
		return d, nil
	}
	return nil, nil
}
func (f *fakeBlockedDeviceRepo) FindBlockedMACs(ctx context.Context, macs []string) (map[string]model.BlockedDevice, error) {
	return map[string]model.BlockedDevice{}, nil
}
func (f *fakeBlockedDeviceRepo) List(ctx context.Context, filter repository.BlockedDeviceFilter) ([]model.BlockedDevice, int64, error) {
	return nil, 0, nil
}
func (f *fakeBlockedDeviceRepo) CountActive(ctx context.Context) (int64, error) {
	return int64(len(f.blocked)), nil
}

func TestAuthenticateRejectsBlockedMAC(t *testing.T) {
	f := newAuthFixture(t)
	service.SetRadiusBlockedDeviceRepo(f.svc, &fakeBlockedDeviceRepo{
		blocked: map[string]*model.BlockedDevice{
			utils.NormalizeMAC(testMAC): {ID: "b1", MAC: utils.NormalizeMAC(testMAC), Reason: "Abuse"},
		},
	})
	res, err := f.svc.Authenticate(context.Background(), service.RadiusAuthRequest{
		RemoteIP:         testNASIP + ":1812",
		NASIdentifier:    testNASID,
		Username:         f.voucher.Username,
		Password:         f.password,
		CallingStationID: testMAC,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Accepted {
		t.Fatalf("expected blocked MAC to be rejected")
	}
	if res.Reason != "Device blocked" {
		t.Fatalf("expected reason 'Device blocked', got %q", res.Reason)
	}
}
