package model

import "time"

const (
	PaymentMethodBankTransfer = "BANK_TRANSFER"
	PaymentMethodQRISStatic   = "QRIS_STATIC"
	PaymentMethodGateway      = "GATEWAY"

	TopupChannelManual   = "MANUAL"
	TopupChannelMidtrans = "MIDTRANS"
	TopupChannelXendit   = "XENDIT"

	TopupStatusPendingProof        = "PENDING_PROOF"
	TopupStatusWaitingVerification = "WAITING_VERIFICATION"
	TopupStatusPaid                = "PAID"
	TopupStatusRejected            = "REJECTED"
	TopupStatusExpired             = "EXPIRED"

	WalletTxTopup           = "TOPUP"
	WalletTxAdImpression    = "AD_IMPRESSION"
	WalletTxAdminAdjustment = "ADMIN_ADJUSTMENT"
	WalletTxRefund          = "REFUND"

	WithdrawalStatusPending  = "PENDING"
	WithdrawalStatusPaid     = "PAID"
	WithdrawalStatusRejected = "REJECTED"

	PartnerTxAdRevenue        = "AD_REVENUE"
	PartnerTxWithdrawal       = "WITHDRAWAL"
	PartnerTxWithdrawalRefund = "WITHDRAWAL_REFUND"
	PartnerTxAdminAdjustment  = "ADMIN_ADJUSTMENT"

	PartnerStatusInvited = "INVITED"
	PartnerStatusActive  = "ACTIVE"
)

// LocationTier defines the pricing rank multiplier for a router location (e.g. 1.0x, 1.2x, 1.5x)
// along with optional daily traffic thresholds for automatic location ranking.
type LocationTier struct {
	Base
	Name                string  `gorm:"type:varchar(64);not null" json:"name"`
	Multiplier          float64 `gorm:"type:numeric(6,2);not null;default:1.0" json:"multiplier"`
	MinDailyConnects    int64   `gorm:"not null;default:0" json:"min_daily_connects"`
	MinDailyImpressions int64   `gorm:"not null;default:0" json:"min_daily_impressions"`
	Description         string  `gorm:"type:varchar(255)" json:"description"`
	SortOrder           int     `gorm:"not null;default:1" json:"sort_order"`
	IsActive            bool    `gorm:"not null;default:true" json:"is_active"`
}

func (LocationTier) TableName() string {
	return "app.location_tiers"
}

// PlatformAdSetting holds global advertiser & partner rules managed by Admin.
type PlatformAdSetting struct {
	Base
	BasePriceImageIDR          int64   `gorm:"not null;default:50" json:"base_price_image_idr"`
	BasePriceVideoIDR          int64   `gorm:"not null;default:50" json:"base_price_video_idr"`
	MaxAdDurationSeconds       int     `gorm:"not null;default:30" json:"max_ad_duration_seconds"`
	MinTopupAmountIDR          int64   `gorm:"not null;default:50000" json:"min_topup_amount_idr"`
	DefaultPartnerSharePercent float64 `gorm:"type:numeric(5,2);not null;default:20" json:"default_partner_share_percent"`
	MinWithdrawalAmountIDR     int64   `gorm:"not null;default:50000" json:"min_withdrawal_amount_idr"`
	RequireAdApproval          bool    `gorm:"not null;default:true" json:"require_ad_approval"`
}

func (PlatformAdSetting) TableName() string {
	return "app.platform_ad_settings"
}

// PaymentMethod represents a destination bank account or static QRIS managed by Admin for Top-Up.
type PaymentMethod struct {
	Base
	Type          string `gorm:"type:varchar(32);not null;default:'BANK_TRANSFER'" json:"type"`
	ProviderName  string `gorm:"type:varchar(80);not null" json:"provider_name"`
	AccountNumber string `gorm:"type:varchar(80)" json:"account_number"`
	AccountHolder string `gorm:"type:varchar(120)" json:"account_holder"`
	QrisImageURL  string `gorm:"type:varchar(500)" json:"qris_image_url"`
	Instructions  string `gorm:"type:text" json:"instructions"`
	SortOrder     int    `gorm:"not null;default:1" json:"sort_order"`
	IsActive      bool   `gorm:"not null;default:true" json:"is_active"`
}

func (PaymentMethod) TableName() string {
	return "app.payment_methods"
}

// Advertiser is a client account that manages paid campaigns and holds a prepaid wallet balance.
type Advertiser struct {
	Base
	Email            string     `gorm:"type:varchar(191);uniqueIndex;not null" json:"email"`
	Phone            string     `gorm:"type:varchar(32)" json:"phone"`
	PasswordHash     string     `gorm:"type:varchar(255);not null" json:"-"`
	Name             string     `gorm:"type:varchar(120);not null" json:"name"`
	CompanyName      string     `gorm:"type:varchar(150)" json:"company_name"`
	WalletBalanceIDR int64      `gorm:"not null;default:0" json:"wallet_balance_idr"`
	IsActive         bool       `gorm:"not null;default:true" json:"is_active"`
	LastLoginAt      *time.Time `gorm:"last_login_at,omitempty" json:"last_login_at,omitempty"`
}

func (Advertiser) TableName() string {
	return "app.advertisers"
}

// Partner is a venue owner (e.g. cafe, restaurant, coworking) hosting one or more MikroTik routers
// and earning a revenue share from paid advertisements shown at their venue.
type Partner struct {
	Base
	Username            *string    `gorm:"type:varchar(80);uniqueIndex" json:"username,omitempty"`
	Email               *string    `gorm:"type:varchar(191);uniqueIndex" json:"email,omitempty"`
	Phone               string     `gorm:"type:varchar(32)" json:"phone"`
	PasswordHash        string     `gorm:"type:varchar(255)" json:"-"`
	Name                string     `gorm:"type:varchar(120)" json:"name"`
	VenueName           string     `gorm:"type:varchar(150);not null" json:"venue_name"`
	VenueCategory       string     `gorm:"type:varchar(64);default:'Kafe'" json:"venue_category"`
	Address             string     `gorm:"type:varchar(255)" json:"address"`
	Latitude            *float64   `gorm:"type:double precision" json:"latitude,omitempty"`
	Longitude           *float64   `gorm:"type:double precision" json:"longitude,omitempty"`
	RevenueSharePercent float64    `gorm:"type:numeric(5,2);not null;default:20" json:"revenue_share_percent"`
	WalletBalanceIDR    int64      `gorm:"not null;default:0" json:"wallet_balance_idr"`
	TotalEarnedIDR      int64      `gorm:"not null;default:0" json:"total_earned_idr"`
	BankName            string     `gorm:"type:varchar(80)" json:"bank_name"`
	BankAccountNumber   string     `gorm:"type:varchar(80)" json:"bank_account_number"`
	BankAccountHolder   string     `gorm:"type:varchar(120)" json:"bank_account_holder"`
	Status              string     `gorm:"type:varchar(24);not null;default:'ACTIVE';index" json:"status"`
	InviteToken         *string    `gorm:"type:varchar(96);uniqueIndex" json:"-"`
	InviteExpiresAt     *time.Time `json:"invite_expires_at,omitempty"`
	ActivatedAt         *time.Time `json:"activated_at,omitempty"`
	IsActive            bool       `gorm:"not null;default:true" json:"is_active"`
	LastLoginAt         *time.Time `json:"last_login_at,omitempty"`
}

func (Partner) TableName() string {
	return "app.partners"
}

// AdImpression logs every completed ad view (and optional click) per portal session,
// snapshotting advertiser charge, partner revenue share, and net platform share.
type AdImpression struct {
	ID               string     `gorm:"type:uuid;primaryKey" json:"id"`
	AdvertisementID  string     `gorm:"type:uuid;not null;index" json:"advertisement_id"`
	AdvertiserID     *string    `gorm:"type:uuid;index" json:"advertiser_id,omitempty"`
	PartnerID        *string    `gorm:"type:uuid;index" json:"partner_id,omitempty"`
	RouterID         string     `gorm:"type:uuid;not null;index" json:"router_id"`
	PortalSessionID  string     `gorm:"type:uuid;not null;uniqueIndex" json:"portal_session_id"`
	DeviceMAC        string     `gorm:"type:varchar(32);index" json:"device_mac"`
	CostChargedIDR   int64      `gorm:"not null;default:0" json:"cost_charged_idr"`
	PartnerShareIDR  int64      `gorm:"not null;default:0" json:"partner_share_idr"`
	PlatformShareIDR int64      `gorm:"not null;default:0" json:"platform_share_idr"`
	ClickedAt        *time.Time `gorm:"index" json:"clicked_at,omitempty"`
	CreatedAt        time.Time  `gorm:"not null;index" json:"created_at"`
}

func (AdImpression) TableName() string {
	return "app.ad_impressions"
}

// TopupInvoice tracks an advertiser wallet top-up (manual bank/QRIS transfer now, gateway-ready).
type TopupInvoice struct {
	Base
	InvoiceNumber       string     `gorm:"type:varchar(48);uniqueIndex;not null" json:"invoice_number"`
	AdvertiserID        string     `gorm:"type:uuid;not null;index" json:"advertiser_id"`
	PaymentMethodID     *string    `gorm:"type:uuid;index" json:"payment_method_id,omitempty"`
	PaymentChannel      string     `gorm:"type:varchar(32);not null;default:'MANUAL'" json:"payment_channel"`
	PaymentProviderName string     `gorm:"type:varchar(80)" json:"payment_provider_name"`
	ExternalReference   string     `gorm:"type:varchar(128);index" json:"external_reference"`
	AmountIDR           int64      `gorm:"not null" json:"amount_idr"`
	ProofImageURL       string     `gorm:"type:varchar(500)" json:"proof_image_url"`
	SenderName          string     `gorm:"type:varchar(120)" json:"sender_name"`
	Status              string     `gorm:"type:varchar(32);not null;default:'PENDING_PROOF';index" json:"status"`
	AdminNote           string     `gorm:"type:text" json:"admin_note"`
	VerifiedBy          *string    `gorm:"type:uuid" json:"verified_by,omitempty"`
	VerifiedAt          *time.Time `json:"verified_at,omitempty"`
}

func (TopupInvoice) TableName() string {
	return "app.topup_invoices"
}

// WalletTransaction is the immutable ledger of advertiser balance credits and debits.
type WalletTransaction struct {
	ID              string    `gorm:"type:uuid;primaryKey" json:"id"`
	AdvertiserID    string    `gorm:"type:uuid;not null;index" json:"advertiser_id"`
	Type            string    `gorm:"type:varchar(32);not null;index" json:"type"`
	AmountIDR       int64     `gorm:"not null" json:"amount_idr"`
	BalanceAfterIDR int64     `gorm:"not null" json:"balance_after_idr"`
	ReferenceType   string    `gorm:"type:varchar(32)" json:"reference_type"`
	ReferenceID     string    `gorm:"type:varchar(64);index" json:"reference_id"`
	Description     string    `gorm:"type:varchar(255)" json:"description"`
	CreatedAt       time.Time `gorm:"not null;index" json:"created_at"`
}

func (WalletTransaction) TableName() string {
	return "app.wallet_transactions"
}

// PartnerWithdrawal tracks a payout request from a Partner venue owner.
type PartnerWithdrawal struct {
	Base
	WithdrawalNumber  string     `gorm:"type:varchar(48);uniqueIndex;not null" json:"withdrawal_number"`
	PartnerID         string     `gorm:"type:uuid;not null;index" json:"partner_id"`
	AmountIDR         int64      `gorm:"not null" json:"amount_idr"`
	BankName          string     `gorm:"type:varchar(80)" json:"bank_name"`
	BankAccountNumber string     `gorm:"type:varchar(80)" json:"bank_account_number"`
	BankAccountHolder string     `gorm:"type:varchar(120)" json:"bank_account_holder"`
	Status            string     `gorm:"type:varchar(32);not null;default:'PENDING';index" json:"status"`
	ProofImageURL     string     `gorm:"type:varchar(500)" json:"proof_image_url"`
	AdminNote         string     `gorm:"type:text" json:"admin_note"`
	ProcessedBy       *string    `gorm:"type:uuid" json:"processed_by,omitempty"`
	ProcessedAt       *time.Time `json:"processed_at,omitempty"`
}

func (PartnerWithdrawal) TableName() string {
	return "app.partner_withdrawals"
}

// PartnerWalletTransaction logs all earnings and withdrawals on a Partner's balance.
type PartnerWalletTransaction struct {
	ID              string    `gorm:"type:uuid;primaryKey" json:"id"`
	PartnerID       string    `gorm:"type:uuid;not null;index" json:"partner_id"`
	Type            string    `gorm:"type:varchar(32);not null;index" json:"type"`
	AmountIDR       int64     `gorm:"not null" json:"amount_idr"`
	BalanceAfterIDR int64     `gorm:"not null" json:"balance_after_idr"`
	ReferenceID     string    `gorm:"type:varchar(64);index" json:"reference_id"`
	Description     string    `gorm:"type:varchar(255)" json:"description"`
	CreatedAt       time.Time `gorm:"not null;index" json:"created_at"`
}

func (PartnerWalletTransaction) TableName() string {
	return "app.partner_wallet_transactions"
}
