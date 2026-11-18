package dto

import "time"

// ==================== LOCATION TIERS & PLATFORM SETTINGS ====================

type LocationTierResponse struct {
	ID                  string    `json:"id"`
	Name                string    `json:"name"`
	Multiplier          float64   `json:"multiplier"`
	MinDailyConnects    int64     `json:"min_daily_connects"`
	MinDailyImpressions int64     `json:"min_daily_impressions"`
	Description         string    `json:"description"`
	SortOrder           int       `json:"sort_order"`
	IsActive            bool      `json:"is_active"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type UpsertLocationTierRequest struct {
	Name                string  `json:"name" binding:"required,min=2,max=64"`
	Multiplier          float64 `json:"multiplier" binding:"required,min=0.1,max=20"`
	MinDailyConnects    int64   `json:"min_daily_connects" binding:"min=0"`
	MinDailyImpressions int64   `json:"min_daily_impressions" binding:"min=0"`
	Description         string  `json:"description" binding:"max=255"`
	SortOrder           int     `json:"sort_order"`
	IsActive            bool    `json:"is_active"`
}

type PlatformAdSettingResponse struct {
	BasePriceImageIDR          int64     `json:"base_price_image_idr"`
	BasePriceVideoIDR          int64     `json:"base_price_video_idr"`
	MaxAdDurationSeconds       int       `json:"max_ad_duration_seconds"`
	MinTopupAmountIDR          int64     `json:"min_topup_amount_idr"`
	DefaultPartnerSharePercent float64   `json:"default_partner_share_percent"`
	MinWithdrawalAmountIDR     int64     `json:"min_withdrawal_amount_idr"`
	RequireAdApproval          bool      `json:"require_ad_approval"`
	UpdatedAt                  time.Time `json:"updated_at"`
}

type UpdatePlatformAdSettingRequest struct {
	BasePriceImageIDR          int64   `json:"base_price_image_idr" binding:"required,min=1,max=1000000"`
	BasePriceVideoIDR          int64   `json:"base_price_video_idr" binding:"required,min=1,max=1000000"`
	MaxAdDurationSeconds       int     `json:"max_ad_duration_seconds" binding:"required,min=5,max=300"`
	MinTopupAmountIDR          int64   `json:"min_topup_amount_idr" binding:"required,min=1000,max=100000000"`
	DefaultPartnerSharePercent float64 `json:"default_partner_share_percent" binding:"min=0,max=95"`
	MinWithdrawalAmountIDR     int64   `json:"min_withdrawal_amount_idr" binding:"min=1000,max=100000000"`
	RequireAdApproval          bool    `json:"require_ad_approval"`
}

type PaymentMethodResponse struct {
	ID            string    `json:"id"`
	Type          string    `json:"type"`
	ProviderName  string    `json:"provider_name"`
	AccountNumber string    `json:"account_number"`
	AccountHolder string    `json:"account_holder"`
	QrisImageURL  string    `json:"qris_image_url"`
	Instructions  string    `json:"instructions"`
	SortOrder     int       `json:"sort_order"`
	IsActive      bool      `json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
}

type UpsertPaymentMethodRequest struct {
	Type          string `json:"type" binding:"required,oneof=BANK_TRANSFER QRIS_STATIC GATEWAY"`
	ProviderName  string `json:"provider_name" binding:"required,min=2,max=80"`
	AccountNumber string `json:"account_number" binding:"max=80"`
	AccountHolder string `json:"account_holder" binding:"max=120"`
	QrisImageURL  string `json:"qris_image_url" binding:"max=500"`
	Instructions  string `json:"instructions" binding:"max=2000"`
	SortOrder     int    `json:"sort_order"`
	IsActive      bool   `json:"is_active"`
}

// ==================== ADVERTISER AUTH & PROFILE ====================

type AdvertiserRegisterRequest struct {
	Name        string `json:"name" binding:"required,min=2,max=120"`
	CompanyName string `json:"company_name" binding:"max=150"`
	Email       string `json:"email" binding:"required,email,max=191"`
	Phone       string `json:"phone" binding:"max=32"`
	Password    string `json:"password" binding:"required,min=6,max=72"`
}

type AdvertiserLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AdvertiserProfileResponse struct {
	ID                   string     `json:"id"`
	Name                 string     `json:"name"`
	CompanyName          string     `json:"company_name"`
	Email                string     `json:"email"`
	Phone                string     `json:"phone"`
	WalletBalanceIDR     int64      `json:"wallet_balance_idr"`
	ActiveCampaignsCount int64      `json:"active_campaigns_count"`
	TotalCampaignsCount  int64      `json:"total_campaigns_count"`
	TotalTopupIDR        int64      `json:"total_topup_idr"`
	TotalSpentIDR        int64      `json:"total_spent_idr"`
	IsActive             bool       `json:"is_active"`
	LastLoginAt          *time.Time `json:"last_login_at,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
}

type AdvertiserAuthResponse struct {
	Token      string                    `json:"token"`
	ExpiresAt  time.Time                 `json:"expires_at"`
	Advertiser AdvertiserProfileResponse `json:"advertiser"`
}

type UpdateAdvertiserProfileRequest struct {
	Name        string `json:"name" binding:"required,min=2,max=120"`
	CompanyName string `json:"company_name" binding:"max=150"`
	Phone       string `json:"phone" binding:"max=32"`
}

type ChangeAdvertiserPasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=6,max=72"`
}

// ==================== MARKETPLACE MAP ROUTERS ====================

type MarketplaceRouterPoint struct {
	ID                  string   `json:"id"`
	Name                string   `json:"name"`
	LocationAddress     string   `json:"location_address"`
	VenueCategory       string   `json:"venue_category"`
	Latitude            *float64 `json:"latitude,omitempty"`
	Longitude           *float64 `json:"longitude,omitempty"`
	TierID              string   `json:"tier_id,omitempty"`
	TierName            string   `json:"tier_name"`
	Multiplier          float64  `json:"multiplier"`
	PriceImageIDR       int64    `json:"price_image_idr"`
	PriceVideoIDR       int64    `json:"price_video_idr"`
	AvgDailyVisitors    int64    `json:"avg_daily_visitors"`
	ActiveSessionsCount int64    `json:"active_sessions_count"`
	IsConnected         bool     `json:"is_connected"`
}

// ==================== CAMPAIGNS (ADVERTISEMENTS) ====================

type CampaignRouterSummary struct {
	RouterID        string   `json:"router_id"`
	RouterName      string   `json:"router_name"`
	LocationAddress string   `json:"location_address"`
	VenueCategory   string   `json:"venue_category"`
	Latitude        *float64 `json:"latitude,omitempty"`
	Longitude       *float64 `json:"longitude,omitempty"`
	TierName        string   `json:"tier_name"`
	Multiplier      float64  `json:"multiplier"`
	UnitPriceIDR    int64    `json:"unit_price_idr"`
}

type CampaignResponse struct {
	ID                 string                  `json:"id"`
	AdvertiserID       string                  `json:"advertiser_id"`
	AdvertiserName     string                  `json:"advertiser_name,omitempty"`
	AdvertiserCompany  string                  `json:"advertiser_company,omitempty"`
	Title              string                  `json:"title"`
	Body               string                  `json:"body"`
	ImageURL           string                  `json:"image_url"`
	TargetURL          string                  `json:"target_url"`
	MediaType          string                  `json:"media_type"`
	LayoutMode         string                  `json:"layout_mode"`
	DurationSeconds    int                     `json:"duration_seconds"`
	Status             string                  `json:"status"`
	IsActive           bool                    `json:"is_active"`
	RejectionReason    string                  `json:"rejection_reason,omitempty"`
	StartDate          *time.Time              `json:"start_date,omitempty"`
	EndDate            *time.Time              `json:"end_date,omitempty"`
	StartHour          int                     `json:"start_hour"`
	EndHour            int                     `json:"end_hour"`
	ActiveDays         string                  `json:"active_days"`
	DailyBudgetIDR     int64                   `json:"daily_budget_idr"`
	TotalBudgetIDR     int64                   `json:"total_budget_idr"`
	SpentAmountIDR     int64                   `json:"spent_amount_idr"`
	DailySpentTodayIDR int64                   `json:"daily_spent_today_idr"`
	ImpressionsCount   int64                   `json:"impressions_count"`
	ClicksCount        int64                   `json:"clicks_count"`
	TargetRouters      []CampaignRouterSummary `json:"target_routers"`
	CreatedAt          time.Time               `json:"created_at"`
	UpdatedAt          time.Time               `json:"updated_at"`
}

type CreateCampaignRequest struct {
	Title           string   `json:"title" binding:"required,min=2,max=150"`
	Body            string   `json:"body" binding:"max=1000"`
	ImageURL        string   `json:"image_url" binding:"required,max=500"`
	TargetURL       string   `json:"target_url" binding:"max=500"`
	MediaType       string   `json:"media_type" binding:"required,oneof=image video"`
	LayoutMode      string   `json:"layout_mode" binding:"required,oneof=landscape portrait"`
	DurationSeconds int      `json:"duration_seconds" binding:"required,min=3,max=300"`
	RouterIDs       []string `json:"router_ids" binding:"required,min=1"`
	StartDate       string   `json:"start_date"`
	EndDate         string   `json:"end_date"`
	StartHour       int      `json:"start_hour" binding:"min=0,max=23"`
	EndHour         int      `json:"end_hour" binding:"min=1,max=24"`
	ActiveDays      string   `json:"active_days" binding:"max=32"`
	DailyBudgetIDR  int64    `json:"daily_budget_idr" binding:"min=0"`
	TotalBudgetIDR  int64    `json:"total_budget_idr" binding:"min=0"`
}

type UpdateCampaignRequest struct {
	Title           string   `json:"title" binding:"required,min=2,max=150"`
	Body            string   `json:"body" binding:"max=1000"`
	ImageURL        string   `json:"image_url" binding:"required,max=500"`
	TargetURL       string   `json:"target_url" binding:"max=500"`
	MediaType       string   `json:"media_type" binding:"required,oneof=image video"`
	LayoutMode      string   `json:"layout_mode" binding:"required,oneof=landscape portrait"`
	DurationSeconds int      `json:"duration_seconds" binding:"required,min=3,max=300"`
	RouterIDs       []string `json:"router_ids" binding:"required,min=1"`
	StartDate       string   `json:"start_date"`
	EndDate         string   `json:"end_date"`
	StartHour       int      `json:"start_hour" binding:"min=0,max=23"`
	EndHour         int      `json:"end_hour" binding:"min=1,max=24"`
	ActiveDays      string   `json:"active_days" binding:"max=32"`
	DailyBudgetIDR  int64    `json:"daily_budget_idr" binding:"min=0"`
	TotalBudgetIDR  int64    `json:"total_budget_idr" binding:"min=0"`
}

type UpdateCampaignStatusRequest struct {
	Action string `json:"action" binding:"required,oneof=PAUSE RESUME"`
}

type CampaignListQuery struct {
	PaginationQuery
	Status       string `form:"status" binding:"omitempty,oneof=DRAFT PENDING_REVIEW ACTIVE PAUSED REJECTED COMPLETED"`
	AdvertiserID string `form:"advertiser_id" binding:"omitempty,uuid"`
}

type AdminModerateCampaignRequest struct {
	Action          string `json:"action" binding:"required,oneof=APPROVE REJECT PAUSE"`
	RejectionReason string `json:"rejection_reason" binding:"max=1000"`
}

// ==================== WALLET & TOP-UP ====================

type CreateTopupRequest struct {
	AmountIDR       int64  `json:"amount_idr" binding:"required,min=1000,max=100000000"`
	PaymentMethodID string `json:"payment_method_id" binding:"required,uuid"`
	SenderName      string `json:"sender_name" binding:"max=120"`
	ProofImageURL   string `json:"proof_image_url" binding:"max=500"`
}

type SubmitTopupProofRequest struct {
	SenderName    string `json:"sender_name" binding:"required,min=2,max=120"`
	ProofImageURL string `json:"proof_image_url" binding:"required,max=500"`
}

type TopupInvoiceResponse struct {
	ID                  string     `json:"id"`
	InvoiceNumber       string     `json:"invoice_number"`
	AdvertiserID        string     `json:"advertiser_id"`
	AdvertiserName      string     `json:"advertiser_name,omitempty"`
	AdvertiserEmail     string     `json:"advertiser_email,omitempty"`
	AdvertiserCompany   string     `json:"advertiser_company,omitempty"`
	PaymentMethodID     *string    `json:"payment_method_id,omitempty"`
	PaymentChannel      string     `json:"payment_channel"`
	PaymentProviderName string     `json:"payment_provider_name"`
	AmountIDR           int64      `json:"amount_idr"`
	ProofImageURL       string     `json:"proof_image_url"`
	SenderName          string     `json:"sender_name"`
	Status              string     `json:"status"`
	AdminNote           string     `json:"admin_note"`
	VerifiedAt          *time.Time `json:"verified_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
}

type TopupListQuery struct {
	PaginationQuery
	Status       string `form:"status" binding:"omitempty,oneof=PENDING_PROOF WAITING_VERIFICATION PAID REJECTED EXPIRED"`
	AdvertiserID string `form:"advertiser_id" binding:"omitempty,uuid"`
}

type AdminVerifyTopupRequest struct {
	Action    string `json:"action" binding:"required,oneof=APPROVE REJECT"`
	AdminNote string `json:"admin_note" binding:"max=1000"`
}

type AdminAdjustBalanceRequest struct {
	AmountIDR   int64  `json:"amount_idr" binding:"required"`
	Description string `json:"description" binding:"required,min=3,max=255"`
}

type AdminToggleStatusRequest struct {
	IsActive bool `json:"is_active"`
}

type WalletTransactionResponse struct {
	ID                string    `json:"id"`
	AdvertiserID      string    `json:"advertiser_id,omitempty"`
	AdvertiserName    string    `json:"advertiser_name,omitempty"`
	AdvertiserCompany string    `json:"advertiser_company,omitempty"`
	Type              string    `json:"type"`
	AmountIDR         int64     `json:"amount_idr"`
	BalanceAfterIDR   int64     `json:"balance_after_idr"`
	ReferenceType     string    `json:"reference_type"`
	ReferenceID       string    `json:"reference_id"`
	Description       string    `json:"description"`
	CreatedAt         time.Time `json:"created_at"`
}

type WalletTransactionListQuery struct {
	PaginationQuery
	Type         string `form:"type" binding:"omitempty,oneof=TOPUP AD_IMPRESSION ADMIN_ADJUSTMENT REFUND"`
	AdvertiserID string `form:"advertiser_id" binding:"omitempty,uuid"`
}

type AdminAdvertiserListQuery struct {
	PaginationQuery
}

// ==================== OVERVIEW & ANALYTICS ====================

type AdvertiserChartPoint struct {
	Label       string `json:"label"`
	Impressions int64  `json:"impressions"`
	Clicks      int64  `json:"clicks"`
	SpentIDR    int64  `json:"spent_idr"`
}

type AdvertiserOverviewResponse struct {
	WalletBalanceIDR      int64                  `json:"wallet_balance_idr"`
	ActiveCampaignsCount  int64                  `json:"active_campaigns_count"`
	PendingCampaignsCount int64                  `json:"pending_campaigns_count"`
	TotalImpressions      int64                  `json:"total_impressions"`
	TotalClicks           int64                  `json:"total_clicks"`
	TotalSpentIDR         int64                  `json:"total_spent_idr"`
	TrendToday            []AdvertiserChartPoint `json:"trend_today"`
	Trend7d               []AdvertiserChartPoint `json:"trend_7d"`
	Trend30d              []AdvertiserChartPoint `json:"trend_30d"`
}

type AnalyticsQuery struct {
	Range      string `form:"range,default=7d" binding:"omitempty,oneof=today 7d 30d"`
	CampaignID string `form:"campaign_id" binding:"omitempty,uuid"`
	RouterID   string `form:"router_id" binding:"omitempty,uuid"`
}

type RouterAnalyticsBreakdown struct {
	RouterID        string  `json:"router_id"`
	RouterName      string  `json:"router_name"`
	VenueCategory   string  `json:"venue_category"`
	LocationAddress string  `json:"location_address"`
	Impressions     int64   `json:"impressions"`
	Clicks          int64   `json:"clicks"`
	CTRPercent      float64 `json:"ctr_percent"`
	SpentIDR        int64   `json:"spent_idr"`
}

type AdvertiserAnalyticsResponse struct {
	TotalImpressions int64                      `json:"total_impressions"`
	TotalClicks      int64                      `json:"total_clicks"`
	CTRPercent       float64                    `json:"ctr_percent"`
	TotalSpentIDR    int64                      `json:"total_spent_idr"`
	Series           []AdvertiserChartPoint     `json:"series"`
	ByRouter         []RouterAnalyticsBreakdown `json:"by_router"`
}
