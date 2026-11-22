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
	BatchID               *string    `json:"batch_id,omitempty"`
	ProfileName           string     `json:"profile_name,omitempty"`
	BandwidthDownKbps     int        `json:"bandwidth_down_kbps"`
	BandwidthUpKbps       int        `json:"bandwidth_up_kbps"`
	QuotaBytes            int64      `json:"quota_bytes"`
	SharedUsers           int        `json:"shared_users"`
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

// CreateVoucherBatchRequest generates 1..500 vouchers in a single atomic transaction.
type CreateVoucherBatchRequest struct {
	Name                  string `json:"name" binding:"required,min=2,max=120"`
	RouterID              string `json:"router_id" binding:"omitempty,uuid"`
	ProfileID             string `json:"profile_id" binding:"omitempty,uuid"`
	Prefix                string `json:"prefix" binding:"omitempty,max=16"`
	Quantity              int    `json:"quantity" binding:"required,min=1,max=500"`
	DigitCount            int    `json:"digit_count" binding:"omitempty,min=4,max=16"`
	NumericOnly           bool   `json:"numeric_only"`
	TTLSeconds            int    `json:"ttl_seconds" binding:"omitempty,min=60,max=2592000"`
	SessionTimeoutSeconds int    `json:"session_timeout_seconds" binding:"omitempty,min=60,max=604800"`
	Note                  string `json:"note" binding:"omitempty,max=255"`
}

// VoucherBatchResponse describes one batch record.
type VoucherBatchResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	RouterID    string    `json:"router_id"`
	RouterName  string    `json:"router_name,omitempty"`
	ProfileID   *string   `json:"profile_id,omitempty"`
	ProfileName string    `json:"profile_name,omitempty"`
	Prefix      string    `json:"prefix"`
	Quantity    int       `json:"quantity"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
}

// VoucherBatchCreatedResponse returns the batch metadata and plaintext credentials once.
type VoucherBatchCreatedResponse struct {
	Batch    VoucherBatchResponse     `json:"batch"`
	Vouchers []VoucherCreatedResponse `json:"vouchers"`
}

// VoucherBatchListQuery paginates batch history.
type VoucherBatchListQuery struct {
	PaginationQuery
	RouterID string `form:"router_id" binding:"omitempty,uuid"`
}

// VoucherSummaryResponse holds status counts for summary cards.
type VoucherSummaryResponse struct {
	Total   int64 `json:"total"`
	Issued  int64 `json:"issued"`
	Active  int64 `json:"active"`
	Used    int64 `json:"used"`
	Expired int64 `json:"expired"`
	Revoked int64 `json:"revoked"`
}
