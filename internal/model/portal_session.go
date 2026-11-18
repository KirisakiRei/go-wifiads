package model

import "time"

// Portal session statuses. ACTIVE only after Accounting-Start, never before.
const (
	PortalSessionStatusPendingAd     = "PENDING_AD"
	PortalSessionStatusVoucherIssued = "VOUCHER_ISSUED"
	PortalSessionStatusExpired       = "EXPIRED"
	PortalSessionStatusFailed        = "FAILED"
)

// PortalSession captures the redirect context MikroTik handed to the browser.
// The token itself is never stored: only its SHA-256 hash is persisted.
type PortalSession struct {
	Base
	TokenHash         string     `gorm:"type:char(64);uniqueIndex;not null" json:"-"`
	SiteID            string     `gorm:"type:uuid;not null;index" json:"site_id"`
	RouterID          string     `gorm:"type:uuid;not null;index" json:"router_id"`
	AdvertisementID   *string    `gorm:"type:uuid;index" json:"advertisement_id,omitempty"`
	AdCostSnapshotIDR int64      `gorm:"not null;default:0" json:"ad_cost_snapshot_idr"`
	AdBilledAt        *time.Time `json:"ad_billed_at,omitempty"`
	DeviceMAC         string     `gorm:"type:varchar(32);not null;index" json:"device_mac"`
	DeviceIP          string     `gorm:"type:varchar(64)" json:"device_ip"`
	LinkLoginOnly     string     `gorm:"type:text" json:"link_login_only"`
	LinkLogin         string     `gorm:"type:text" json:"link_login"`
	LinkOrig          string     `gorm:"type:text" json:"link_orig"`
	ChapID            string     `gorm:"type:varchar(16)" json:"chap_id"`
	ChapChallenge     string     `gorm:"type:text" json:"chap_challenge"`
	SurveyEmail       string     `gorm:"type:varchar(255)" json:"survey_email,omitempty"`
	SurveyPhone       string     `gorm:"type:varchar(32)" json:"survey_phone,omitempty"`
	SurveySkipped     bool       `gorm:"not null;default:false" json:"survey_skipped"`
	ProfileID         *string    `gorm:"type:uuid;index" json:"profile_id,omitempty"`
	UserAgent         string     `gorm:"type:text" json:"user_agent"`
	Status            string     `gorm:"type:varchar(24);not null;index" json:"status"`
	AdStartedAt       time.Time  `gorm:"not null" json:"ad_started_at"`
	VoucherIssuedAt   *time.Time `json:"voucher_issued_at,omitempty"`
	ExpiresAt         time.Time  `gorm:"not null;index" json:"expires_at"`
}

func (PortalSession) TableName() string {
	return "app.portal_sessions"
}
