package dto

import "time"

// ConnectProfileResponse represents a QoS / access tier profile.
type ConnectProfileResponse struct {
	ID                    string    `json:"id"`
	Name                  string    `json:"name"`
	DisplayName           string    `json:"display_name"`
	Description           string    `json:"description"`
	IsDefault             bool      `json:"is_default"`
	BandwidthUpKbps       int       `json:"bandwidth_up_kbps"`
	BandwidthDownKbps     int       `json:"bandwidth_down_kbps"`
	SessionTimeoutSeconds int       `json:"session_timeout_seconds"`
	VoucherTTLSeconds     int       `json:"voucher_ttl_seconds"`
	QuotaBytes            int64     `json:"quota_bytes"`
	SharedUsers           int       `json:"shared_users"`
	IsActive              bool      `json:"is_active"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// CreateProfileRequest represents the payload for creating a new profile.
type CreateProfileRequest struct {
	Name                  string `json:"name" binding:"required,min=2,max=64"`
	DisplayName           string `json:"display_name" binding:"required,min=2,max=120"`
	Description           string `json:"description" binding:"max=255"`
	IsDefault             bool   `json:"is_default"`
	BandwidthUpKbps       int    `json:"bandwidth_up_kbps" binding:"min=0"`
	BandwidthDownKbps     int    `json:"bandwidth_down_kbps" binding:"min=0"`
	SessionTimeoutSeconds int    `json:"session_timeout_seconds" binding:"required,min=60"`
	VoucherTTLSeconds     int    `json:"voucher_ttl_seconds" binding:"min=60"`
	QuotaBytes            int64  `json:"quota_bytes" binding:"min=0"`
	SharedUsers           int    `json:"shared_users" binding:"omitempty,min=1,max=50"`
	IsActive              bool   `json:"is_active"`
}

// UpdateProfileRequest represents the payload for updating an existing profile.
type UpdateProfileRequest struct {
	DisplayName           string `json:"display_name" binding:"required,min=2,max=120"`
	Description           string `json:"description" binding:"max=255"`
	IsDefault             bool   `json:"is_default"`
	BandwidthUpKbps       int    `json:"bandwidth_up_kbps" binding:"min=0"`
	BandwidthDownKbps     int    `json:"bandwidth_down_kbps" binding:"min=0"`
	SessionTimeoutSeconds int    `json:"session_timeout_seconds" binding:"required,min=60"`
	VoucherTTLSeconds     int    `json:"voucher_ttl_seconds" binding:"min=60"`
	QuotaBytes            int64  `json:"quota_bytes" binding:"min=0"`
	SharedUsers           int    `json:"shared_users" binding:"omitempty,min=1,max=50"`
	IsActive              bool   `json:"is_active"`
}
