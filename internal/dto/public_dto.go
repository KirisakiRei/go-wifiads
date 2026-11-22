package dto

import "time"

// ==================== PUBLIC LANDING & CALCULATOR DATA ====================

type PublicPricingInfo struct {
	BasePriceImageIDR          int64   `json:"base_price_image_idr"`
	BasePriceVideoIDR          int64   `json:"base_price_video_idr"`
	MaxAdDurationSeconds       int     `json:"max_ad_duration_seconds"`
	MinTopupAmountIDR          int64   `json:"min_topup_amount_idr"`
	DefaultPartnerSharePercent float64 `json:"default_partner_share_percent"`
	MinWithdrawalAmountIDR     int64   `json:"min_withdrawal_amount_idr"`
}

type PublicLocationItem struct {
	ID                  string   `json:"id"`
	VenueName           string   `json:"venue_name"`
	VenueCategory       string   `json:"venue_category"`
	Address             string   `json:"address"`
	Latitude            *float64 `json:"latitude,omitempty"`
	Longitude           *float64 `json:"longitude,omitempty"`
	TierName            string   `json:"tier_name"`
	Multiplier          float64  `json:"multiplier"`
	EstimatedDailyViews int64    `json:"estimated_daily_views"`
	ImagePriceIDR       int64    `json:"image_price_idr"`
	VideoPriceIDR       int64    `json:"video_price_idr"`
	IsConnected         bool     `json:"is_connected"`
}

type PublicLandingStats struct {
	TotalPublicLocations int `json:"total_public_locations"`
	TotalCategories      int `json:"total_categories"`
	TotalActiveRouters   int `json:"total_active_routers"`
}

type PublicLandingDataResponse struct {
	BrandName string                 `json:"brand_name"`
	Pricing   PublicPricingInfo      `json:"pricing"`
	Tiers     []LocationTierResponse `json:"tiers"`
	Stats     PublicLandingStats     `json:"stats"`
	Locations []PublicLocationItem   `json:"locations"`
}

// ==================== PARTNER LEADS (PUBLIC SUBMIT + ADMIN MANAGE) ====================

type SubmitPartnerLeadRequest struct {
	VenueName            string   `json:"venue_name" binding:"required,min=2,max=150"`
	Category             string   `json:"category" binding:"omitempty,max=64"`
	City                 string   `json:"city" binding:"required,min=2,max=100"`
	Address              string   `json:"address" binding:"omitempty,max=255"`
	Latitude             *float64 `json:"latitude" binding:"omitempty,gte=-90,lte=90"`
	Longitude            *float64 `json:"longitude" binding:"omitempty,gte=-180,lte=180"`
	DailyTrafficEstimate int      `json:"daily_traffic_estimate" binding:"required,min=1,max=100000"`
	ContactName          string   `json:"contact_name" binding:"required,min=2,max=120"`
	WhatsApp             string   `json:"whatsapp" binding:"required,min=8,max=32"`
	Notes                string   `json:"notes" binding:"omitempty,max=1000"`
}

type PartnerLeadResponse struct {
	ID                   string    `json:"id"`
	VenueName            string    `json:"venue_name"`
	Category             string    `json:"category"`
	City                 string    `json:"city"`
	Address              string    `json:"address"`
	Latitude             *float64  `json:"latitude,omitempty"`
	Longitude            *float64  `json:"longitude,omitempty"`
	DailyTrafficEstimate int       `json:"daily_traffic_estimate"`
	ContactName          string    `json:"contact_name"`
	WhatsApp             string    `json:"whatsapp"`
	Notes                string    `json:"notes"`
	AdminNote            string    `json:"admin_note"`
	Status               string    `json:"status"`
	ConvertedPartnerID   *string   `json:"converted_partner_id,omitempty"`
	InviteToken          string    `json:"invite_token,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

type PartnerLeadListQuery struct {
	PaginationQuery
	Status string `form:"status" binding:"omitempty,oneof=NEW CONTACTED CONVERTED REJECTED"`
}

type UpdatePartnerLeadStatusRequest struct {
	Status    string `json:"status" binding:"required,oneof=NEW CONTACTED CONVERTED REJECTED"`
	AdminNote string `json:"admin_note" binding:"omitempty,max=1000"`
}

type ConvertPartnerLeadRequest struct {
	RevenueSharePercent *float64 `json:"revenue_share_percent" binding:"omitempty,min=0,max=95"`
}

type ConvertPartnerLeadResponse struct {
	Lead    PartnerLeadResponse  `json:"lead"`
	Partner AdminPartnerResponse `json:"partner"`
}
