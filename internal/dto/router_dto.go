package dto

import "time"

// RouterResponse represents a MikroTik router terminating the hotspot along with its live RADIUS telemetry and map coordinates.
type RouterResponse struct {
	ID                    string     `json:"id"`
	SiteID                string     `json:"site_id"`
	PartnerID             *string    `json:"partner_id,omitempty"`
	PartnerName           string     `json:"partner_name,omitempty"`
	PartnerVenueName      string     `json:"partner_venue_name,omitempty"`
	Name                  string     `json:"name"`
	NASIdentifier         string     `json:"nas_identifier"`
	IPAddress             string     `json:"ip_address"`
	NASIPAddress          string     `json:"nas_ip_address"`
	RadiusSecret          string     `json:"radius_secret"`
	RadiusServerIP        string     `json:"radius_server_ip,omitempty"`
	PortalBaseURL         string     `json:"portal_base_url"`
	Status                string     `json:"status"`
	Description           string     `json:"description"`
	Latitude              *float64   `json:"latitude,omitempty"`
	Longitude             *float64   `json:"longitude,omitempty"`
	LocationAddress       string     `json:"location_address"`
	VenueCategory         string     `json:"venue_category"`
	LocationTierID        *string    `json:"location_tier_id,omitempty"`
	LocationTierName      string     `json:"location_tier_name,omitempty"`
	LocationMultiplier    float64    `json:"location_multiplier"`
	LocationTierAuto      bool       `json:"location_tier_auto"`
	AvgDailyConnects      int64      `json:"avg_daily_connects"`
	AvgDailyImpressions   int64      `json:"avg_daily_impressions"`
	IsPublicMarketplace   bool       `json:"is_public_marketplace"`
	VoucherPrefix         string     `json:"voucher_prefix"`
	VoucherDigitCount     int        `json:"voucher_digit_count"`
	VoucherNumericOnly    bool       `json:"voucher_numeric_only"`
	DefaultProfileID      *string    `json:"default_profile_id,omitempty"`
	SurveyProfileID       *string    `json:"survey_profile_id,omitempty"`
	VoucherTTLSeconds     int        `json:"voucher_ttl_seconds"`
	SessionTimeoutSeconds int        `json:"session_timeout_seconds"`
	IsConnected           bool       `json:"is_connected"`
	IsOnline              bool       `json:"is_online"`
	LastSeenAt            *time.Time `json:"last_seen_at,omitempty"`
	ActiveSessionsCount   int64      `json:"active_sessions_count"`
	TotalSessionsCount    int64      `json:"total_sessions_count"`
	TotalInputOctets      int64      `json:"total_input_octets"`
	TotalOutputOctets     int64      `json:"total_output_octets"`
}

// CreateRouterRequest creates a new MikroTik Router and its associated RADIUS NAS Client.
type CreateRouterRequest struct {
	Name                string   `json:"name" binding:"required,min=2,max=120"`
	NASIdentifier       string   `json:"nas_identifier" binding:"required,min=2,max=128"`
	IPAddress           string   `json:"ip_address" binding:"required,max=64"`
	NASIPAddress        string   `json:"nas_ip_address" binding:"omitempty,max=64"`
	RadiusSecret        string   `json:"radius_secret" binding:"omitempty,min=6,max=128"`
	Description         string   `json:"description" binding:"max=255"`
	PartnerID           *string  `json:"partner_id" binding:"omitempty,uuid"`
	Latitude            *float64 `json:"latitude"`
	Longitude           *float64 `json:"longitude"`
	LocationAddress     string   `json:"location_address" binding:"max=255"`
	VenueCategory       string   `json:"venue_category" binding:"max=64"`
	LocationTierID      *string  `json:"location_tier_id" binding:"omitempty,uuid"`
	LocationTierAuto    *bool    `json:"location_tier_auto"`
	IsPublicMarketplace *bool    `json:"is_public_marketplace"`
}

// UpdateRouterVoucherConfigRequest contains configuration parameters for automated voucher generation, map location, and RADIUS NAS sync.
type UpdateRouterVoucherConfigRequest struct {
	Name                  string   `json:"name" binding:"omitempty,min=2,max=120"`
	NASIdentifier         string   `json:"nas_identifier" binding:"omitempty,min=2,max=128"`
	IPAddress             string   `json:"ip_address" binding:"omitempty,max=64"`
	NASIPAddress          string   `json:"nas_ip_address" binding:"omitempty,max=64"`
	RadiusSecret          string   `json:"radius_secret" binding:"omitempty,min=6,max=128"`
	PartnerID             *string  `json:"partner_id"`
	Latitude              *float64 `json:"latitude"`
	Longitude             *float64 `json:"longitude"`
	LocationAddress       *string  `json:"location_address"`
	VenueCategory         *string  `json:"venue_category"`
	LocationTierID        *string  `json:"location_tier_id" binding:"omitempty,uuid"`
	LocationTierAuto      *bool    `json:"location_tier_auto"`
	IsPublicMarketplace   *bool    `json:"is_public_marketplace"`
	VoucherPrefix         string   `json:"voucher_prefix" binding:"required,min=1,max=16"`
	VoucherDigitCount     int      `json:"voucher_digit_count" binding:"required,min=4,max=16"`
	VoucherNumericOnly    bool     `json:"voucher_numeric_only"`
	DefaultProfileID      *string  `json:"default_profile_id" binding:"omitempty,uuid"`
	SurveyProfileID       *string  `json:"survey_profile_id" binding:"omitempty,uuid"`
	VoucherTTLSeconds     int      `json:"voucher_ttl_seconds" binding:"omitempty,min=60,max=604800"`
	SessionTimeoutSeconds int      `json:"session_timeout_seconds" binding:"omitempty,min=60,max=604800"`
}
