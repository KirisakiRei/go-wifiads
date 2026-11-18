package repository

import (
	"context"
	"time"

	"wifiads/internal/model"
)

// AdminUserRepository is the persistence contract for admin accounts.
type AdminUserRepository interface {
	Create(ctx context.Context, user *model.AdminUser) error
	FindByUsername(ctx context.Context, username string) (*model.AdminUser, error)
	FindByID(ctx context.Context, id string) (*model.AdminUser, error)
	TouchLastLogin(ctx context.Context, id string, at time.Time) error
	List(ctx context.Context) ([]model.AdminUser, error)
	Update(ctx context.Context, user *model.AdminUser) error
	Delete(ctx context.Context, id string) error
	Count(ctx context.Context) (int64, error)
}

// RoleRepository is the persistence contract for RBAC roles.
type RoleRepository interface {
	Create(ctx context.Context, role *model.Role) error
	FindByID(ctx context.Context, id string) (*model.Role, error)
	FindByName(ctx context.Context, name string) (*model.Role, error)
	List(ctx context.Context) ([]model.Role, error)
	Update(ctx context.Context, role *model.Role) error
	Delete(ctx context.Context, id string) error
}

// SiteRepository is the persistence contract for locations.
type SiteRepository interface {
	Create(ctx context.Context, site *model.Site) error
	FindByID(ctx context.Context, id string) (*model.Site, error)
	First(ctx context.Context) (*model.Site, error)
	Count(ctx context.Context) (int64, error)
}

// RouterRepository is the persistence contract for MikroTik devices.
type RouterRepository interface {
	Create(ctx context.Context, router *model.Router) error
	Update(ctx context.Context, router *model.Router) error
	FindByID(ctx context.Context, id string) (*model.Router, error)
	FindByNASIdentifier(ctx context.Context, nasIdentifier string) (*model.Router, error)
	ListActive(ctx context.Context) ([]model.Router, error)
	Count(ctx context.Context) (int64, error)
	UpdateVoucherConfig(ctx context.Context, id string, prefix string, digitCount int, numericOnly bool, defaultProfileID *string, surveyProfileID *string, ttlSeconds int, sessionTimeoutSeconds int) error
}

// NASClientRepository is the persistence contract for RADIUS clients.
type NASClientRepository interface {
	Create(ctx context.Context, client *model.NASClient) error
	UpsertForRouter(ctx context.Context, client *model.NASClient) error
	FindByRouterID(ctx context.Context, routerID string) (*model.NASClient, error)
	FindByIP(ctx context.Context, ipAddress string) (*model.NASClient, error)
	FindByNASIdentifier(ctx context.Context, nasIdentifier string) (*model.NASClient, error)
	ListAll(ctx context.Context) ([]model.NASClient, error)
	Count(ctx context.Context) (int64, error)
}

// AdvertisementRepository is the persistence contract for portal ads.
type AdvertisementRepository interface {
	Create(ctx context.Context, ad *model.Advertisement) error
	FindByID(ctx context.Context, id string) (*model.Advertisement, error)
	FindActive(ctx context.Context) (*model.Advertisement, error)
	List(ctx context.Context) ([]model.Advertisement, error)
	Update(ctx context.Context, ad *model.Advertisement) error
	Delete(ctx context.Context, id string) error
	Count(ctx context.Context) (int64, error)
}

// PortalSessionRepository is the persistence contract for portal sessions.
type PortalSessionRepository interface {
	Create(ctx context.Context, session *model.PortalSession) error
	FindByTokenHash(ctx context.Context, tokenHash string) (*model.PortalSession, error)
	FindByID(ctx context.Context, id string) (*model.PortalSession, error)
	FindByIDs(ctx context.Context, ids []string) ([]model.PortalSession, error)
	MarkVoucherIssued(ctx context.Context, id string, at time.Time) error
	UpdateStatus(ctx context.Context, id, status string) error
	SaveSurvey(ctx context.Context, id, email, phone string, skipped bool, profileID string) error
	CountByStatus(ctx context.Context) (map[string]int64, error)
}

// VoucherFilter narrows a voucher list query.
type VoucherFilter struct {
	Page     int
	PerPage  int
	Search   string
	Status   string
	RouterID string
	Order    string
}

// VoucherRepository is the persistence contract for Hotspot vouchers.
type VoucherRepository interface {
	Create(ctx context.Context, voucher *model.Voucher) error
	CreateForPortalSession(ctx context.Context, voucher *model.Voucher) error
	FindByUsername(ctx context.Context, username string) (*model.Voucher, error)
	FindByUsernames(ctx context.Context, usernames []string) ([]model.Voucher, error)
	FindByID(ctx context.Context, id string) (*model.Voucher, error)
	FindByPortalSessionID(ctx context.Context, portalSessionID string) (*model.Voucher, error)
	UpdateStatus(ctx context.Context, id, status string) error
	ActivateSessionWindow(ctx context.Context, id string, at time.Time, expiresAt time.Time) error
	DeactivateOtherActiveByMAC(ctx context.Context, mac, keepVoucherID string, at time.Time) error
	MarkUsed(ctx context.Context, id string, at time.Time) error
	MarkExpiredBefore(ctx context.Context, now time.Time) (int64, error)
	List(ctx context.Context, filter VoucherFilter) ([]model.Voucher, int64, error)
	CountByStatus(ctx context.Context) (map[string]int64, error)
	FindLatestByMAC(ctx context.Context, mac string, routerID string) (*model.Voucher, error)
	UpdatePortalSessionID(ctx context.Context, voucherID string, portalSessionID string) error
}

// VisitorFilter narrows a visitor list query.
type VisitorFilter struct {
	Page    int
	PerPage int
	Search  string
	Status  string
	Order   string
}

// WifiVisitorRepository is the persistence contract for Wi-Fi devices.
type WifiVisitorRepository interface {
	Create(ctx context.Context, visitor *model.WifiVisitor) error
	FindByPortalSessionID(ctx context.Context, portalSessionID string) (*model.WifiVisitor, error)
	AttachVoucher(ctx context.Context, portalSessionID, voucherID, username string, at time.Time) error
	MarkConnected(ctx context.Context, username string, at time.Time) error
	MarkInterim(ctx context.Context, username string, at time.Time, sessionTimeSeconds int64) error
	MarkDisconnected(ctx context.Context, username string, at time.Time, sessionTimeSeconds int64) error
	CloseOtherActiveByMAC(ctx context.Context, mac, keepUsername string, at time.Time) error
	MarkStale(ctx context.Context, username string) error
	List(ctx context.Context, filter VisitorFilter) ([]model.WifiVisitor, int64, error)
	CountByStatus(ctx context.Context) (map[string]int64, error)
}

// SessionFilter narrows an accounting session list query.
type SessionFilter struct {
	Page    int
	PerPage int
	Search  string
	Status  string
	Order   string
}

// AccountingUpdates is the set of mutable accounting fields.
type AccountingUpdates struct {
	Status             string
	LastAccountingAt   *time.Time
	StoppedAt          *time.Time
	SessionTimeSeconds int64
	InputOctets        int64
	OutputOctets       int64
	TerminateCause     string
}

// AccountingRepository is the persistence contract for RADIUS accounting.
type AccountingRepository interface {
	ApplyStart(ctx context.Context, session *model.AccountingSession) (*model.AccountingSession, error)
	ApplyInterim(ctx context.Context, nasIdentifier, acctSessionID string, updates AccountingUpdates) (*model.AccountingSession, error)
	ApplyStop(ctx context.Context, nasIdentifier, acctSessionID string, updates AccountingUpdates) (*model.AccountingSession, error)
	CloseOtherActiveByMAC(ctx context.Context, mac, keepAcctSessionID string, at time.Time) error
	FindByNASAndAcctSession(ctx context.Context, nasIdentifier, acctSessionID string) (*model.AccountingSession, error)
	FindByUsernames(ctx context.Context, usernames []string) ([]model.AccountingSession, error)
	RecordEvent(ctx context.Context, event *model.AccountingEvent) (bool, error)
	ListSessions(ctx context.Context, filter SessionFilter) ([]model.AccountingSession, int64, error)
	CountByStatus(ctx context.Context) (map[string]int64, error)
	MarkStale(ctx context.Context, threshold time.Time) (int64, error)
	HasActiveSessionForVoucher(ctx context.Context, voucherID string) (bool, error)
}

// AuditLogRepository is the append-only audit trail contract.
type AuditLogRepository interface {
	Create(ctx context.Context, entry *model.AuditLog) error
}

// ConnectProfileRepository is the persistence contract for QoS tier profiles.
type ConnectProfileRepository interface {
	Create(ctx context.Context, profile *model.ConnectProfile) error
	FindByID(ctx context.Context, id string) (*model.ConnectProfile, error)
	FindByName(ctx context.Context, name string) (*model.ConnectProfile, error)
	// FindDefault returns the profile with is_default=true AND is_active=true.
	FindDefault(ctx context.Context) (*model.ConnectProfile, error)
	// FindForSurveyCompleted returns the best non-default active profile
	// (highest bandwidth_down_kbps), i.e. the "premium" tier.
	FindForSurveyCompleted(ctx context.Context) (*model.ConnectProfile, error)
	ListActive(ctx context.Context) ([]model.ConnectProfile, error)
	Update(ctx context.Context, profile *model.ConnectProfile) error
	Delete(ctx context.Context, id string) error
	Count(ctx context.Context) (int64, error)
}
