package model

import "time"

// Voucher statuses. The final decision follows RADIUS authentication and
// accounting, never a single Access-Request.
const (
	VoucherStatusIssued  = "ISSUED"
	VoucherStatusActive  = "ACTIVE"
	VoucherStatusUsed    = "USED"
	VoucherStatusExpired = "EXPIRED"
	VoucherStatusRevoked = "REVOKED"
)

// Voucher is the temporary Hotspot credential. PasswordCiphertext holds the
// password sealed with AES-256-GCM: CHAP verification needs the recoverable
// secret, so a one-way hash is not an option here.
type Voucher struct {
	Base
	Username              string     `gorm:"type:varchar(64);uniqueIndex;not null" json:"username"`
	PasswordCiphertext    string     `gorm:"type:text;not null" json:"-"`
	Status                string     `gorm:"type:varchar(16);not null;index" json:"status"`
	SiteID                string     `gorm:"type:uuid;not null;index" json:"site_id"`
	RouterID              string     `gorm:"type:uuid;not null;index" json:"router_id"`
	PortalSessionID       *string    `gorm:"type:uuid;index" json:"portal_session_id,omitempty"`
	ExpectedMAC           string     `gorm:"type:varchar(32);index" json:"expected_mac"`
	CreatedBy             string     `gorm:"type:varchar(64)" json:"created_by"`
	Note                  string     `gorm:"type:varchar(255)" json:"note"`
	ExpiresAt             time.Time  `gorm:"not null;index" json:"expires_at"`
	SessionTimeoutSeconds int        `gorm:"not null;default:3600" json:"session_timeout_seconds"`
	ProfileID             *string    `gorm:"type:uuid;index" json:"profile_id,omitempty"`
	BatchID               *string    `gorm:"type:uuid;index" json:"batch_id,omitempty"`
	BandwidthUpKbps       int        `gorm:"not null;default:0" json:"bandwidth_up_kbps"`
	BandwidthDownKbps     int        `gorm:"not null;default:0" json:"bandwidth_down_kbps"`
	QuotaBytes            int64      `gorm:"not null;default:0" json:"quota_bytes"`
	SharedUsers           int        `gorm:"not null;default:1" json:"shared_users"`
	UsedAt                *time.Time `json:"used_at,omitempty"`
}

func (Voucher) TableName() string {
	return "radius.vouchers"
}
