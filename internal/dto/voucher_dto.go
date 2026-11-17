package dto

import "time"

// CreateVoucherRequest creates a manual test or batch voucher from the admin panel.
type CreateVoucherRequest struct {
	Note                  string `json:"note" binding:"omitempty,max=255"`
	RouterID              string `json:"router_id" binding:"omitempty,uuid"`
	ProfileID             string `json:"profile_id" binding:"omitempty,uuid"`
	Prefix                string `json:"prefix" binding:"omitempty,max=16"`
	DigitCount            int    `json:"digit_count" binding:"omitempty,min=4,max=16"`
	NumericOnly           bool   `json:"numeric_only"`
	TTLSeconds            int    `json:"ttl_seconds" binding:"omitempty,min=60,max=604800"`
	SessionTimeoutSeconds int    `json:"session_timeout_seconds" binding:"omitempty,min=60,max=604800"`
}

// VoucherResponse is the safe representation of a voucher: the password cipher
// is never exposed after creation.
type VoucherResponse struct {
	ID                    string     `json:"id"`
	Username              string     `json:"username"`
	Status                string     `json:"status"`
	SiteID                string     `json:"site_id"`
	RouterID              string     `json:"router_id"`
	ProfileID             *string    `json:"profile_id,omitempty"`
	ProfileName           string     `json:"profile_name,omitempty"`
	BandwidthDownKbps     int        `json:"bandwidth_down_kbps"`
	BandwidthUpKbps       int        `json:"bandwidth_up_kbps"`
	PortalSessionID       *string    `json:"portal_session_id,omitempty"`
	ExpectedMAC           string     `json:"expected_mac,omitempty"`
	CreatedBy             string     `json:"created_by"`
	Note                  string     `json:"note,omitempty"`
	ExpiresAt             time.Time  `json:"expires_at"`
	SessionTimeoutSeconds int        `json:"session_timeout_seconds"`
	UsedAt                *time.Time `json:"used_at,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
}

// VoucherCreatedResponse returns the plaintext password exactly once.
type VoucherCreatedResponse struct {
	VoucherResponse
	Password string `json:"password"`
}

// VoucherListQuery filters the voucher list.
type VoucherListQuery struct {
	PaginationQuery
	Status   string `form:"status" binding:"omitempty,oneof=ISSUED ACTIVE USED EXPIRED REVOKED"`
	RouterID string `form:"router_id" binding:"omitempty,uuid"`
}
