package model

const (
	RouterStatusActive   = "ACTIVE"
	RouterStatusInactive = "INACTIVE"
)

// Router represents the MikroTik device that terminates the Hotspot.
type Router struct {
	Base
	SiteID        string `gorm:"type:uuid;not null;index" json:"site_id"`
	Name          string `gorm:"type:varchar(120);not null" json:"name"`
	NASIdentifier string `gorm:"type:varchar(128);uniqueIndex;not null" json:"nas_identifier"`
	IPAddress     string `gorm:"type:varchar(64)" json:"ip_address"`
	Status        string `gorm:"type:varchar(24);not null;default:'ACTIVE'" json:"status"`
	Description   string `gorm:"type:varchar(255)" json:"description"`

	// Physical Map Coordinates, Linked Venue Partner & Pricing Tier for Advertiser Marketplace
	PartnerID           *string  `gorm:"type:uuid;index" json:"partner_id,omitempty"`
	Latitude            *float64 `gorm:"type:double precision" json:"latitude,omitempty"`
	Longitude           *float64 `gorm:"type:double precision" json:"longitude,omitempty"`
	LocationAddress     string   `gorm:"type:varchar(255)" json:"location_address"`
	VenueCategory       string   `gorm:"type:varchar(64);default:'Kafe'" json:"venue_category"`
	LocationTierID      *string  `gorm:"type:uuid;index" json:"location_tier_id,omitempty"`
	LocationTierAuto    bool     `gorm:"not null;default:true" json:"location_tier_auto"`
	IsPublicMarketplace bool     `gorm:"not null;default:true" json:"is_public_marketplace"`

	// Voucher Generation Configuration for this Router
	VoucherPrefix         string  `gorm:"type:varchar(16);default:'WF-'" json:"voucher_prefix"`
	VoucherDigitCount     int     `gorm:"default:6" json:"voucher_digit_count"`
	VoucherNumericOnly    bool    `gorm:"default:true" json:"voucher_numeric_only"`
	DefaultProfileID      *string `gorm:"type:uuid;index" json:"default_profile_id,omitempty"`
	SurveyProfileID       *string `gorm:"type:uuid;index" json:"survey_profile_id,omitempty"`
	VoucherTTLSeconds     int     `gorm:"default:86400" json:"voucher_ttl_seconds"`
	SessionTimeoutSeconds int     `gorm:"default:3600" json:"session_timeout_seconds"`
}

func (Router) TableName() string {
	return "app.routers"
}
