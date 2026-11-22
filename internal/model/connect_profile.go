package model

// ConnectProfile defines the RADIUS QoS parameters and session duration
// assigned to a voucher based on whether the user completed the survey.
type ConnectProfile struct {
	Base
	Name        string `gorm:"type:varchar(64);not null;uniqueIndex" json:"name"`
	DisplayName string `gorm:"type:varchar(120);not null" json:"display_name"`
	Description string `gorm:"type:varchar(255)" json:"description"`
	IsDefault   bool   `gorm:"not null;default:false" json:"is_default"`
	// BandwidthUpKbps=0 → no limit
	BandwidthUpKbps       int   `gorm:"not null;default:0" json:"bandwidth_up_kbps"`
	BandwidthDownKbps     int   `gorm:"not null;default:0" json:"bandwidth_down_kbps"`
	SessionTimeoutSeconds int   `gorm:"not null;default:3600" json:"session_timeout_seconds"`
	VoucherTTLSeconds     int   `gorm:"not null;default:300" json:"voucher_ttl_seconds"`
	QuotaBytes            int64 `gorm:"not null;default:0" json:"quota_bytes"`
	SharedUsers           int   `gorm:"not null;default:1" json:"shared_users"`
	IsActive              bool  `gorm:"not null;default:true" json:"is_active"`
}

func (ConnectProfile) TableName() string {
	return "app.connect_profiles"
}
