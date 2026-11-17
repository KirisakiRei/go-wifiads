//go:build e2e

// Package e2e contains the end-to-end acceptance test that mirrors the PRD
// Alpha 0.1 flow without a physical MikroTik: it stands up a real PostgreSQL
// schema, the real HTTP API (portal + admin) and the real RADIUS server, then
// drives the flow exactly like a hotspot would:
//
//	portal session -> countdown -> Connect -> voucher -> RADIUS PAP/CHAP
//	-> Access-Accept/Reject -> Accounting Start/Interim/Stop -> dashboard state
//
// Run with a reachable PostgreSQL (defaults to localhost, postgres/postgres):
//
//	go test -tags e2e ./test/e2e -v
//
// Override the connection with E2E_DB_HOST, E2E_DB_PORT, E2E_DB_USER,
// E2E_DB_PASSWORD. The test creates and drops its own database.
package e2e

import (
	"bytes"
	"context"
	"crypto/md5" //nolint:gosec // RADIUS CHAP is defined on MD5.
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"wifiads/internal/config"
	"wifiads/internal/model"
	"wifiads/internal/radius"
	"wifiads/internal/repository"
	"wifiads/internal/router"
	"wifiads/internal/service"
	"wifiads/pkg/apperror"
	"wifiads/pkg/utils"

	radiuslib "layeh.com/radius"
	"layeh.com/radius/rfc2865"
	"layeh.com/radius/rfc2866"
)

const (
	e2eNASID   = "e2e-router-01"
	e2eNASIP   = "127.0.0.1"
	e2eSecret  = "e2e-shared-secret"
	e2eAdminPW = "admin12345"
)

type harness struct {
	t         *testing.T
	cfg       *config.Config
	db        *gorm.DB
	baseURL   string
	authAddr  string
	acctAddr  string
	stopFns   []func()
	routerID  string
	siteID    string
	radSecret string
}

func (h *harness) stop() {
	for i := len(h.stopFns) - 1; i >= 0; i-- {
		h.stopFns[i]()
	}
}

// TestAlphaMVPFlow is the acceptance test covering the PRD §16 matrix and the
// Definition of Done in §17.
func TestAlphaMVPFlow(t *testing.T) {
	h := newHarness(t)
	defer h.stop()

	ctx := context.Background()

	// --- 1. Portal: create session, countdown enforced server-side ----------
	token, adSeconds := h.createPortalSession()
	if adSeconds < 1 {
		t.Fatalf("expected positive ad duration, got %d", adSeconds)
	}

	// Connect before the countdown completes must be rejected.
	if status, _ := h.connectStatus(token); status == http.StatusOK {
		t.Fatalf("connect before countdown should be rejected, got 200")
	}

	// Wait for the countdown (test uses a 1s ad duration) then connect.
	time.Sleep(time.Duration(adSeconds)*time.Second + 300*time.Millisecond)

	voucher := h.connect(token)
	if voucher.username == "" || voucher.password == "" {
		t.Fatalf("connect did not return credentials: %+v", voucher)
	}

	// Connect again: must be idempotent (same voucher).
	again := h.connect(token)
	if again.username != voucher.username {
		t.Fatalf("connect not idempotent: %s vs %s", voucher.username, again.username)
	}
	t.Logf("portal voucher issued: %s", voucher.username)

	// --- 2. RADIUS auth: PAP accept, CHAP accept, wrong password reject ------
	if code := h.radiusPAP(voucher.username, voucher.password); code != radiuslib.CodeAccessAccept {
		t.Fatalf("PAP: expected Access-Accept, got %s", code)
	}
	if code := h.radiusCHAP(voucher.username, voucher.password); code != radiuslib.CodeAccessAccept {
		t.Fatalf("CHAP: expected Access-Accept, got %s", code)
	}
	if code := h.radiusPAP(voucher.username, voucher.password+"-wrong"); code != radiuslib.CodeAccessReject {
		t.Fatalf("wrong password: expected Access-Reject, got %s", code)
	}

	// --- 3. Accounting lifecycle: Start -> Interim -> Stop -------------------
	sessionID := "e2e-" + voucher.username
	h.accounting(rfc2866.AcctStatusType_Value_Start, voucher.username, sessionID, 0)
	h.assertAccounting(sessionID, model.AccountingSessionStatusActive)
	h.assertVoucherStatus(voucher.username, model.VoucherStatusActive)

	h.accounting(rfc2866.AcctStatusType_Value_InterimUpdate, voucher.username, sessionID, 65)
	h.assertAccountingTime(sessionID, 65)

	h.accounting(rfc2866.AcctStatusType_Value_Stop, voucher.username, sessionID, 120)
	h.assertAccounting(sessionID, model.AccountingSessionStatusClosed)
	h.assertVoucherStatus(voucher.username, model.VoucherStatusUsed)

	// Re-using a USED voucher must be rejected.
	if code := h.radiusPAP(voucher.username, voucher.password); code != radiuslib.CodeAccessReject {
		t.Fatalf("used voucher: expected Access-Reject, got %s", code)
	}

	// --- 4. Expired voucher is rejected -------------------------------------
	expired := h.issueManualVoucher("expired-probe")
	if err := h.db.WithContext(ctx).Model(&model.Voucher{}).
		Where("username = ?", expired.username).
		Update("expires_at", time.Now().UTC().Add(-time.Minute)).Error; err != nil {
		t.Fatalf("force expiry: %v", err)
	}
	if code := h.radiusPAP(expired.username, expired.password); code != radiuslib.CodeAccessReject {
		t.Fatalf("expired voucher: expected Access-Reject, got %s", code)
	}

	// --- 5. Wrong shared secret produces no access (packet is dropped) ------
	if code := h.radiusFromBadSecret(voucher.username); code == radiuslib.CodeAccessAccept {
		t.Fatalf("wrong shared secret must not yield access")
	}

	// --- 6. Admin dashboard reflects the flow ------------------------------
	h.assertAdminViews()
	t.Log("alpha MVP end-to-end flow passed")
}

// TestAccountingIdempotencyAndStale proves two PRD §16.3 requirements against
// the real UDP listeners: a retransmitted Accounting-Start never creates a
// duplicate session, and a session that stops reporting is flagged STALE
// without being closed.
func TestAccountingIdempotencyAndStale(t *testing.T) {
	h := newHarness(t)
	defer h.stop()

	voucher := h.issueManualVoucher("stale-probe")
	sessionID := "e2e-dup-" + voucher.username

	// Send Accounting-Start three times (UDP retransmission simulation).
	for i := 0; i < 3; i++ {
		h.accounting(rfc2866.AcctStatusType_Value_Start, voucher.username, sessionID, 0)
	}

	var count int64
	if err := h.db.Model(&model.AccountingSession{}).
		Where("acct_session_id = ?", sessionID).Count(&count).Error; err != nil {
		t.Fatalf("count sessions: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected exactly 1 accounting session after retransmits, got %d", count)
	}

	var events int64
	if err := h.db.Model(&model.AccountingEvent{}).
		Where("acct_session_id = ?", sessionID).Count(&events).Error; err != nil {
		t.Fatalf("count events: %v", err)
	}
	if events != 1 {
		t.Fatalf("expected 1 deduped accounting event, got %d", events)
	}

	// Force the session into the past so the stale threshold is exceeded, then
	// run the same janitor path cmd/radius uses.
	if err := h.db.Model(&model.AccountingSession{}).
		Where("acct_session_id = ?", sessionID).
		Update("last_accounting_at", time.Now().UTC().Add(-2*time.Hour)).Error; err != nil {
		t.Fatalf("age session: %v", err)
	}

	logger := silence()
	acctSvc := service.NewAccountingService(
		repository.NewAccountingRepository(h.db),
		repository.NewVoucherRepository(h.db),
		repository.NewWifiVisitorRepository(h.db),
		logger,
		h.cfg.StaleAfter(),
	)
	if _, err := acctSvc.MarkStaleSessions(context.Background()); err != nil {
		t.Fatalf("mark stale: %v", err)
	}

	var session model.AccountingSession
	if err := h.db.Where("acct_session_id = ?", sessionID).First(&session).Error; err != nil {
		t.Fatalf("reload session: %v", err)
	}
	if session.Status != model.AccountingSessionStatusStale {
		t.Fatalf("expected STALE, got %s", session.Status)
	}
	t.Log("accounting idempotency and stale detection passed")
}

// TestVoucherRepositoryRejectsDuplicatePortalSession proves the database-level
// "one portal session = one voucher" guarantee used by the Connect idempotency
// path: a second insert for the same portal session fails with ErrAlreadyExists.
func TestVoucherRepositoryRejectsDuplicatePortalSession(t *testing.T) {
	h := newHarness(t)
	defer h.stop()

	repo := repository.NewVoucherRepository(h.db)
	ctx := context.Background()
	now := time.Now().UTC()
	sessionID := uuid.NewString()

	build := func() *model.Voucher {
		psid := sessionID
		return &model.Voucher{
			Base:                  model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
			Username:              "wf" + uuid.NewString()[:10],
			PasswordCiphertext:    "cipher",
			Status:                model.VoucherStatusIssued,
			SiteID:                h.siteID,
			RouterID:              h.routerID,
			PortalSessionID:       &psid,
			ExpiresAt:             now.Add(5 * time.Minute),
			SessionTimeoutSeconds: 3600,
		}
	}

	if err := repo.CreateForPortalSession(ctx, build()); err != nil {
		t.Fatalf("first insert should succeed: %v", err)
	}
	err := repo.CreateForPortalSession(ctx, build())
	if err == nil {
		t.Fatalf("second insert for the same portal session must fail")
	}
	if !errors.Is(err, apperror.ErrAlreadyExists) {
		t.Fatalf("expected ErrAlreadyExists, got %v", err)
	}
	t.Log("voucher repository enforces one voucher per portal session")
}

// --- harness construction ------------------------------------------------

func newHarness(t *testing.T) *harness {
	t.Helper()
	ctx := context.Background()

	dbName := fmt.Sprintf("wifiads_e2e_%s", strings.ReplaceAll(uuid.NewString()[:8], "-", ""))

	applyEnvDefaults(t)
	t.Setenv("DB_NAME", dbName)
	t.Setenv("APP_ENV", "development")
	t.Setenv("PORTAL_DEV_MODE", "true")
	t.Setenv("PORTAL_AD_DURATION_SECONDS", "1")
	t.Setenv("PORTAL_SESSION_TTL_SECONDS", "60")
	t.Setenv("SEED_ADMIN_PASSWORD", e2eAdminPW)
	t.Setenv("SEED_NAS_IP", e2eNASIP)
	t.Setenv("SEED_NAS_IDENTIFIER", e2eNASID)
	t.Setenv("SEED_NAS_SHARED_SECRET", e2eSecret)

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("load config: %v", err)
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	if os.Getenv("E2E_VERBOSE") == "1" {
		logger = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug}))
	}

	if err := config.EnsureDatabase(cfg, logger); err != nil {
		t.Fatalf("ensure database: %v", err)
	}

	db, err := config.Connect(cfg, logger)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}

	if err := migrateAndSeed(ctx, cfg, db); err != nil {
		t.Fatalf("migrate/seed: %v", err)
	}

	h := &harness{t: t, cfg: cfg, db: db, radSecret: e2eSecret}
	h.stopFns = append(h.stopFns, func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			_ = sqlDB.Close()
		}
		if err := dropDatabase(cfg); err != nil {
			t.Logf("warning: could not drop database %s: %v", cfg.DB.Name, err)
		}
	})

	// --- HTTP API (real router + handlers) ---
	engine, err := router.New(cfg, db, logger)
	if err != nil {
		t.Fatalf("build router: %v", err)
	}
	srv := httptest.NewServer(engine)
	h.baseURL = srv.URL
	h.stopFns = append(h.stopFns, srv.Close)

	// --- RADIUS server on ephemeral UDP ports ---
	authAddr := freeUDPAddr(t)
	acctAddr := freeUDPAddr(t)
	nasClients := repository.NewNASClientRepository(db)
	vouchers := repository.NewVoucherRepository(db)
	accounting := repository.NewAccountingRepository(db)
	visitors := repository.NewWifiVisitorRepository(db)
	authSvc := service.NewRadiusAuthService(nasClients, vouchers, accounting, logger, cfg.Keys.VoucherKey, cfg.Keys.RadiusSecretKey)
	acctSvc := service.NewAccountingService(accounting, vouchers, visitors, logger, cfg.StaleAfter())

	radiusServer := radius.NewServer(authSvc, acctSvc, logger, authAddr, acctAddr)
	radiusCtx, cancel := context.WithCancel(context.Background())
	go func() {
		if runErr := radiusServer.Run(radiusCtx); runErr != nil {
			t.Logf("radius server stopped: %v", runErr)
		}
	}()
	h.authAddr = authAddr
	h.acctAddr = acctAddr
	h.stopFns = append(h.stopFns, cancel)

	waitForUDP(t, authAddr)
	waitForUDP(t, acctAddr)

	var r model.Router
	if err := db.WithContext(ctx).Where("nas_identifier = ?", e2eNASID).First(&r).Error; err != nil {
		t.Fatalf("load seeded router: %v", err)
	}
	h.routerID = r.ID
	h.siteID = r.SiteID

	return h
}

// migrateAndSeed mirrors cmd/migrate so the test uses production schema logic.
func migrateAndSeed(ctx context.Context, cfg *config.Config, db *gorm.DB) error {
	if err := db.WithContext(ctx).Exec("CREATE SCHEMA IF NOT EXISTS app").Error; err != nil {
		return err
	}
	if err := db.WithContext(ctx).Exec("CREATE SCHEMA IF NOT EXISTS radius").Error; err != nil {
		return err
	}
	models := []any{
		&model.AdminUser{}, &model.Site{}, &model.Router{}, &model.PortalSession{},
		&model.WifiVisitor{}, &model.Advertisement{}, &model.AuditLog{},
		&model.NASClient{}, &model.Voucher{}, &model.AccountingSession{}, &model.AccountingEvent{},
	}
	if err := db.WithContext(ctx).AutoMigrate(models...); err != nil {
		return err
	}
	return seed(ctx, cfg, db)
}

// seed writes the minimum Alpha data set (mirrors cmd/migrate/seed.go).
func seed(ctx context.Context, cfg *config.Config, db *gorm.DB) error {
	now := time.Now().UTC()
	hashed, err := utils.HashPassword(cfg.Seed.AdminPassword)
	if err != nil {
		return err
	}
	admin := &model.AdminUser{
		Base:         model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		Username:     cfg.Seed.AdminUsername,
		PasswordHash: hashed,
		Name:         cfg.Seed.AdminName,
		Role:         "admin",
		IsActive:     true,
	}
	if err := db.WithContext(ctx).Create(admin).Error; err != nil {
		return err
	}

	site := &model.Site{
		Base:     model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		Name:     cfg.Seed.SiteName,
		Timezone: cfg.Seed.SiteTimezone,
	}
	if err := db.WithContext(ctx).Create(site).Error; err != nil {
		return err
	}

	mikrotik := &model.Router{
		Base:          model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		SiteID:        site.ID,
		Name:          cfg.Seed.RouterName,
		NASIdentifier: cfg.Seed.NASIdentifier,
		IPAddress:     cfg.Seed.RouterIPAddress,
		Status:        model.RouterStatusActive,
	}
	if err := db.WithContext(ctx).Create(mikrotik).Error; err != nil {
		return err
	}

	secretCipher, err := utils.EncryptString(cfg.Keys.RadiusSecretKey, cfg.Seed.NASSharedSecret)
	if err != nil {
		return err
	}
	nas := &model.NASClient{
		Base:             model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		RouterID:         mikrotik.ID,
		SiteID:           site.ID,
		Name:             cfg.Seed.RouterName,
		NASIdentifier:    cfg.Seed.NASIdentifier,
		IPAddress:        cfg.Seed.NASIPAddress,
		SecretCiphertext: secretCipher,
		IsActive:         true,
	}
	if err := db.WithContext(ctx).Create(nas).Error; err != nil {
		return err
	}

	ad := &model.Advertisement{
		Base:     model.Base{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		Title:    cfg.Seed.AdvertisementTitle,
		Body:     cfg.Seed.AdvertisementBody,
		ImageURL: cfg.Seed.AdvertisementImageURL,
		IsActive: true,
	}
	return db.WithContext(ctx).Create(ad).Error
}

// --- HTTP helpers --------------------------------------------------------

type creds struct {
	username string
	password string
	authMode string
}

func (h *harness) createPortalSession() (string, int) {
	body := map[string]any{"mac": "AA:BB:CC:DD:EE:10", "ip": "10.10.10.10"}
	var resp struct {
		Data struct {
			Token      string `json:"session_token"`
			AdDuration int    `json:"ad_duration_seconds"`
		} `json:"data"`
	}
	h.postJSON(h.baseURL+"/api/v1/portal-sessions", body, &resp)
	if resp.Data.Token == "" {
		h.t.Fatalf("portal session returned no token")
	}
	return resp.Data.Token, resp.Data.AdDuration
}

func (h *harness) connectStatus(token string) (int, map[string]any) {
	req, _ := http.NewRequest(http.MethodPost, h.baseURL+"/api/v1/portal-sessions/"+token+"/connect", bytes.NewReader([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		h.t.Fatalf("connect request: %v", err)
	}
	defer res.Body.Close()
	var payload map[string]any
	_ = json.NewDecoder(res.Body).Decode(&payload)
	return res.StatusCode, payload
}

func (h *harness) connect(token string) creds {
	status, payload := h.connectStatus(token)
	if status != http.StatusOK {
		h.t.Fatalf("connect failed: status=%d payload=%v", status, payload)
	}
	data, _ := payload["data"].(map[string]any)
	return creds{
		username: asString(data["username"]),
		password: asString(data["password"]),
		authMode: asString(data["auth_mode"]),
	}
}

func (h *harness) postJSON(url string, body map[string]any, out any) {
	encoded, _ := json.Marshal(body)
	res, err := http.Post(url, "application/json", bytes.NewReader(encoded))
	if err != nil {
		h.t.Fatalf("POST %s: %v", url, err)
	}
	defer res.Body.Close()
	if out != nil {
		_ = json.NewDecoder(res.Body).Decode(out)
	}
}

func (h *harness) adminToken() string {
	var resp struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	h.postJSON(h.baseURL+"/api/v1/admin/auth/login", map[string]any{
		"username": "admin", "password": e2eAdminPW,
	}, &resp)
	if resp.Data.Token == "" {
		h.t.Fatalf("admin login failed")
	}
	return resp.Data.Token
}

func (h *harness) issueManualVoucher(note string) creds {
	token := h.adminToken()
	req, _ := http.NewRequest(http.MethodPost, h.baseURL+"/api/v1/admin/vouchers",
		bytes.NewReader(mustJSON(map[string]any{"note": note})))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		h.t.Fatalf("manual voucher: %v", err)
	}
	defer res.Body.Close()
	var payload struct {
		Data struct {
			Username string `json:"username"`
			Password string `json:"password"`
		} `json:"data"`
	}
	_ = json.NewDecoder(res.Body).Decode(&payload)
	if payload.Data.Username == "" {
		h.t.Fatalf("manual voucher did not return credentials")
	}
	return creds{username: payload.Data.Username, password: payload.Data.Password}
}

func (h *harness) assertAdminViews() {
	token := h.adminToken()
	for _, path := range []string{"/api/v1/admin/vouchers", "/api/v1/admin/visitors", "/api/v1/admin/sessions", "/api/v1/admin/overview"} {
		req, _ := http.NewRequest(http.MethodGet, h.baseURL+path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			h.t.Fatalf("GET %s: %v", path, err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusOK {
			h.t.Fatalf("admin %s returned %d", path, res.StatusCode)
		}
	}
}

// --- RADIUS helpers ------------------------------------------------------

func (h *harness) radiusPAP(user, pass string) radiuslib.Code {
	packet := radiuslib.New(radiuslib.CodeAccessRequest, []byte(h.radSecret))
	_ = rfc2865.UserName_SetString(packet, user)
	_ = rfc2865.UserPassword_SetString(packet, pass)
	_ = rfc2865.NASIdentifier_SetString(packet, e2eNASID)
	_ = rfc2865.CallingStationID_SetString(packet, "AA:BB:CC:DD:EE:10")
	return h.exchange(h.authAddr, packet)
}

func (h *harness) radiusCHAP(user, pass string) radiuslib.Code {
	challenge := []byte("0123456789abcdef")
	chapID := byte(7)
	digest := md5.New() //nolint:gosec // RADIUS CHAP.
	digest.Write([]byte{chapID})
	digest.Write([]byte(pass))
	digest.Write(challenge)

	packet := radiuslib.New(radiuslib.CodeAccessRequest, []byte(h.radSecret))
	_ = rfc2865.UserName_SetString(packet, user)
	_ = rfc2865.NASIdentifier_SetString(packet, e2eNASID)
	_ = rfc2865.CallingStationID_SetString(packet, "AA:BB:CC:DD:EE:10")
	_ = rfc2865.CHAPChallenge_Set(packet, challenge)
	_ = rfc2865.CHAPPassword_Set(packet, append([]byte{chapID}, digest.Sum(nil)...))
	return h.exchange(h.authAddr, packet)
}

func (h *harness) radiusFromBadSecret(user string) radiuslib.Code {
	packet := radiuslib.New(radiuslib.CodeAccessRequest, []byte("totally-wrong"))
	_ = rfc2865.UserName_SetString(packet, user)
	_ = rfc2865.UserPassword_SetString(packet, "irrelevant")
	_ = rfc2865.NASIdentifier_SetString(packet, e2eNASID)
	_ = rfc2865.CallingStationID_SetString(packet, "AA:BB:CC:DD:EE:10")

	// A wrong secret means the server cannot even authenticate the packet, so it
	// must drop it (fail-closed) instead of replying. A timeout is therefore the
	// expected, secure outcome; any actual Access-Accept would be a security bug.
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	reply, err := radiuslib.Exchange(ctx, packet, h.authAddr)
	if err != nil {
		return radiuslib.Code(0) // dropped: acceptable
	}
	return reply.Code
}

func (h *harness) accounting(status rfc2866.AcctStatusType, user, sessionID string, seconds uint32) {
	packet := radiuslib.New(radiuslib.CodeAccountingRequest, []byte(h.radSecret))
	_ = rfc2865.UserName_SetString(packet, user)
	_ = rfc2865.NASIdentifier_SetString(packet, e2eNASID)
	_ = rfc2865.CallingStationID_SetString(packet, "AA:BB:CC:DD:EE:10")
	_ = rfc2866.AcctSessionID_SetString(packet, sessionID)
	_ = rfc2866.AcctStatusType_Set(packet, status)
	_ = rfc2866.AcctSessionTime_Set(packet, rfc2866.AcctSessionTime(seconds))
	if code := h.exchange(h.acctAddr, packet); code != radiuslib.CodeAccountingResponse {
		h.t.Fatalf("accounting %v: expected Accounting-Response, got %s", status, code)
	}
}

func (h *harness) exchange(addr string, packet *radiuslib.Packet) radiuslib.Code {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	reply, err := radiuslib.Exchange(ctx, packet, addr)
	if err != nil {
		h.t.Fatalf("radius exchange with %s: %v", addr, err)
	}
	return reply.Code
}

// --- DB assertions -------------------------------------------------------

func (h *harness) assertAccounting(sessionID, status string) {
	var s model.AccountingSession
	if err := h.db.Where("acct_session_id = ?", sessionID).First(&s).Error; err != nil {
		h.t.Fatalf("accounting session %s not found: %v", sessionID, err)
	}
	if s.Status != status {
		h.t.Fatalf("acct %s: expected status %s, got %s", sessionID, status, s.Status)
	}
}

func (h *harness) assertAccountingTime(sessionID string, seconds int64) {
	var s model.AccountingSession
	if err := h.db.Where("acct_session_id = ?", sessionID).First(&s).Error; err != nil {
		h.t.Fatalf("accounting session %s not found: %v", sessionID, err)
	}
	if s.SessionTimeSeconds != seconds {
		h.t.Fatalf("acct %s: expected session time %d, got %d", sessionID, seconds, s.SessionTimeSeconds)
	}
}

func (h *harness) assertVoucherStatus(username, status string) {
	var v model.Voucher
	if err := h.db.Where("username = ?", username).First(&v).Error; err != nil {
		h.t.Fatalf("voucher %s not found: %v", username, err)
	}
	if v.Status != status {
		h.t.Fatalf("voucher %s: expected status %s, got %s", username, status, v.Status)
	}
}

// --- small utilities -----------------------------------------------------

func applyEnvDefaults(t *testing.T) {
	t.Helper()
	setIfEmpty(t, "DB_HOST", "localhost")
	setIfEmpty(t, "DB_PORT", "5432")
	setIfEmpty(t, "DB_USER", "postgres")
	setIfEmpty(t, "DB_PASSWORD", "postgres")
	setIfEmpty(t, "DB_SSLMODE", "disable")
	setIfEmpty(t, "JWT_SECRET", "e2e-only-secret-at-least-32-characters-long")
	setIfEmpty(t, "LOG_LEVEL", "error")
}

func setIfEmpty(t *testing.T, key, value string) {
	t.Helper()
	if os.Getenv(key) == "" {
		t.Setenv(key, value)
	}
}

func asString(v any) string {
	s, _ := v.(string)
	return s
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}
