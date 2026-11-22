package service

import (
	"context"

	"wifiads/internal/dto"
	"wifiads/internal/model"
)

// AuthService authenticates admin accounts.
type AuthService interface {
	Login(ctx context.Context, req dto.LoginRequest) (*dto.LoginResponse, error)
	IssueRefreshToken(ctx context.Context, adminID string) (string, error)
	Refresh(ctx context.Context, refreshToken string) (*dto.LoginResponse, string, error)
	Profile(ctx context.Context, adminID string) (*dto.AdminResponse, error)
}

// VoucherService owns manual voucher management.
type VoucherService interface {
	CreateManual(ctx context.Context, actorID, actorName string, req dto.CreateVoucherRequest) (*dto.VoucherCreatedResponse, error)
	CreateBatch(ctx context.Context, actorID, actorName string, req dto.CreateVoucherBatchRequest) (*dto.VoucherBatchCreatedResponse, error)
	ListBatches(ctx context.Context, query dto.VoucherBatchListQuery) ([]dto.VoucherBatchResponse, dto.PaginationMeta, error)
	Revoke(ctx context.Context, actorID, actorName, voucherID string) (*dto.VoucherResponse, error)
	Summary(ctx context.Context) (*dto.VoucherSummaryResponse, error)
	List(ctx context.Context, query dto.VoucherListQuery) ([]dto.VoucherResponse, dto.PaginationMeta, error)
}

// PortalService owns the visitor portal lifecycle.
// CoADisconnectFunc sends a RADIUS Disconnect-Request (RFC 5176) to a NAS.
// Injected from the router layer so services stay decoupled from the RADIUS transport.
type CoADisconnectFunc func(ctx context.Context, nasAddr, secret, acctSessionID, username, framedIP, callingStationID string) error

// PortalService drives the guest captive portal flow.
type PortalService interface {
	CurrentAdvertisement(ctx context.Context) (*model.Advertisement, error)
	SelectAdvertisementForRouter(ctx context.Context, nasIdentifier string) (*model.Advertisement, error)
	CreateSession(ctx context.Context, req dto.CreatePortalSessionRequest, userAgent string) (*dto.PortalSessionResponse, error)
	SessionStatus(ctx context.Context, token string) (*dto.PortalSessionStatusResponse, error)
	SubmitSurvey(ctx context.Context, token string, req dto.SubmitSurveyRequest) (*dto.SubmitSurveyResponse, error)
	Connect(ctx context.Context, token string) (*dto.ConnectResponse, error)
	RedeemVoucher(ctx context.Context, token string, req dto.RedeemVoucherRequest) (*dto.ConnectResponse, error)
	GetActiveSession(ctx context.Context, mac, nasIdentifier string) (*dto.ActivePortalSessionResponse, error)
	DisconnectActiveSession(ctx context.Context, req dto.PortalDisconnectRequest) (*dto.PortalDisconnectResponse, error)
	RecordPromoClick(ctx context.Context, token string) (string, error)
}

// AdminService serves the read-only dashboard views and router provisioning.
type AdminService interface {
	Overview(ctx context.Context) (*dto.OverviewResponse, error)
	ListVisitors(ctx context.Context, query dto.VisitorListQuery) ([]dto.VisitorResponse, dto.PaginationMeta, error)
	ListSessions(ctx context.Context, query dto.SessionListQuery) ([]dto.SessionResponse, dto.PaginationMeta, error)
	DisconnectSession(ctx context.Context, actorID, actorName, sessionID string) (*dto.DisconnectSessionResponse, error)
	ListRouters(ctx context.Context) ([]dto.RouterResponse, error)
	CreateRouter(ctx context.Context, actorID, actorName string, req dto.CreateRouterRequest) (*dto.RouterResponse, error)
	UpdateRouterVoucherConfig(ctx context.Context, actorID, actorName, routerID string, req dto.UpdateRouterVoucherConfigRequest) (*dto.RouterResponse, error)
	DeleteRouter(ctx context.Context, actorID, actorName, routerID string) error
	BlockDevice(ctx context.Context, actorID, actorName, mac string, req dto.BlockDeviceRequest) (*dto.BlockedDeviceResponse, error)
	UnblockDevice(ctx context.Context, actorID, actorName, mac, routerID string) error
	ListBlockedDevices(ctx context.Context, query dto.BlockedDeviceListQuery) ([]dto.BlockedDeviceResponse, dto.PaginationMeta, error)
	ListAuditLogs(ctx context.Context, query dto.AuditLogListQuery) ([]dto.AuditLogResponse, dto.PaginationMeta, error)
	AuditLogFilters(ctx context.Context) (*dto.AuditLogFiltersResponse, error)
	CleanupAuditLogs(ctx context.Context, actorID, actorName, actorRole string, days int) (*dto.AuditCleanupResponse, error)
}

// ProfileService manages QoS bandwidth tier profiles.
type ProfileService interface {
	List(ctx context.Context) ([]dto.ConnectProfileResponse, error)
	Get(ctx context.Context, id string) (*dto.ConnectProfileResponse, error)
	Create(ctx context.Context, req dto.CreateProfileRequest) (*dto.ConnectProfileResponse, error)
	Update(ctx context.Context, id string, req dto.UpdateProfileRequest) (*dto.ConnectProfileResponse, error)
	Delete(ctx context.Context, actorID, actorName, id string) error
}

// UserService manages admin user accounts and RBAC roles.
type UserService interface {
	List(ctx context.Context) ([]dto.AdminUserResponse, error)
	Get(ctx context.Context, id string) (*dto.AdminUserResponse, error)
	Create(ctx context.Context, req dto.CreateAdminUserRequest) (*dto.AdminUserResponse, error)
	Update(ctx context.Context, id string, req dto.UpdateAdminUserRequest) (*dto.AdminUserResponse, error)
	ChangePassword(ctx context.Context, id string, req dto.ChangePasswordRequest) error
	Delete(ctx context.Context, id string) error

	ListRoles(ctx context.Context) ([]dto.RoleResponse, error)
	CreateRole(ctx context.Context, req dto.CreateRoleRequest) (*dto.RoleResponse, error)
	UpdateRole(ctx context.Context, id string, req dto.UpdateRoleRequest) (*dto.RoleResponse, error)
	DeleteRole(ctx context.Context, id string) error
}

// AdvertisementService manages promotional ads displayed on the captive portal.
type AdvertisementService interface {
	List(ctx context.Context) ([]dto.AdvertisementResponse, error)
	Get(ctx context.Context, id string) (*dto.AdvertisementResponse, error)
	Create(ctx context.Context, req dto.CreateAdvertisementRequest) (*dto.AdvertisementResponse, error)
	Update(ctx context.Context, id string, req dto.UpdateAdvertisementRequest) (*dto.AdvertisementResponse, error)
	Delete(ctx context.Context, id string) error
}

// RadiusAuthRequest is the normalized Access-Request the RADIUS transport
// hands to the authentication service.
type RadiusAuthRequest struct {
	RemoteIP             string
	NASIdentifier        string
	NASIPAddress         string
	Username             string
	Password             string
	HasCHAP              bool
	CHAPPassword         []byte
	CHAPChallenge        []byte
	RequestAuthenticator []byte
	CallingStationID     string
	FramedIPAddress      string
}

// RadiusAuthResult is the access decision returned to the RADIUS transport.
type RadiusAuthResult struct {
	Accepted              bool
	Reason                string
	VoucherID             string
	SessionTimeoutSeconds int
	BandwidthUpKbps       int
	BandwidthDownKbps     int
	QuotaBytes            int64
	SharedUsers           int
}

// RadiusAuthenticator validates Hotspot vouchers for the RADIUS server.
type RadiusAuthenticator interface {
	LookupNAS(ctx context.Context, remoteIP string) (*model.NASClient, string, error)
	Authenticate(ctx context.Context, req RadiusAuthRequest) (*RadiusAuthResult, error)
}

// RadiusAccountingRequest is the normalized Accounting-Request.
type RadiusAccountingRequest struct {
	RemoteIP           string
	NASIdentifier      string
	AcctSessionID      string
	StatusType         string
	Username           string
	CallingStationID   string
	FramedIPAddress    string
	SessionTimeSeconds int64
	InputOctets        int64
	OutputOctets       int64
	TerminateCause     string
	EventKey           string
	Payload            string
}

// RadiusAccountant persists accounting events and derived session state.
type RadiusAccountant interface {
	Process(ctx context.Context, req RadiusAccountingRequest) error
	MarkStaleSessions(ctx context.Context) (int64, error)
}
