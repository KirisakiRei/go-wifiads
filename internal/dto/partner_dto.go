package dto

import "time"

// ==================== ADMIN SIDEBAR BADGES & FINANCE ====================

type AdminSidebarBadgesResponse struct {
	PendingCampaignsCount   int64 `json:"pending_campaigns_count"`
	WaitingTopupsCount      int64 `json:"waiting_topups_count"`
	PendingWithdrawalsCount int64 `json:"pending_withdrawals_count"`
}

type AdminFinanceQuery struct {
	Range string `form:"range,default=30d" binding:"omitempty,oneof=today 7d 30d"`
}

type AdminFinanceChartPoint struct {
	Label           string `json:"label"`
	Impressions     int64  `json:"impressions"`
	GrossAdSpendIDR int64  `json:"gross_ad_spend_idr"`
	PartnerShareIDR int64  `json:"partner_share_idr"`
	NetPlatformIDR  int64  `json:"net_platform_idr"`
}

type AdminRouterRevenueItem struct {
	RouterID        string `json:"router_id"`
	RouterName      string `json:"router_name"`
	VenueName       string `json:"venue_name"`
	PartnerName     string `json:"partner_name"`
	TierName        string `json:"tier_name"`
	Impressions     int64  `json:"impressions"`
	Clicks          int64  `json:"clicks"`
	GrossAdSpendIDR int64  `json:"gross_ad_spend_idr"`
	PartnerShareIDR int64  `json:"partner_share_idr"`
	NetPlatformIDR  int64  `json:"net_platform_idr"`
}

type AdminFinanceSummaryResponse struct {
	TotalTopupPaidIDR       int64                    `json:"total_topup_paid_idr"`
	PeriodTopupPaidIDR      int64                    `json:"period_topup_paid_idr"`
	WaitingTopupCount       int64                    `json:"waiting_topup_count"`
	WaitingTopupIDR         int64                    `json:"waiting_topup_idr"`
	TotalGrossAdSpendIDR    int64                    `json:"total_gross_ad_spend_idr"`
	PeriodGrossAdSpendIDR   int64                    `json:"period_gross_ad_spend_idr"`
	TotalPartnerShareIDR    int64                    `json:"total_partner_share_idr"`
	PeriodPartnerShareIDR   int64                    `json:"period_partner_share_idr"`
	TotalNetPlatformIDR     int64                    `json:"total_net_platform_idr"`
	PeriodNetPlatformIDR    int64                    `json:"period_net_platform_idr"`
	TotalWithdrawalsPaidIDR int64                    `json:"total_withdrawals_paid_idr"`
	PendingWithdrawalsCount int64                    `json:"pending_withdrawals_count"`
	PendingWithdrawalsIDR   int64                    `json:"pending_withdrawals_idr"`
	TotalClientWalletIDR    int64                    `json:"total_client_wallet_idr"`
	TotalPartnerWalletIDR   int64                    `json:"total_partner_wallet_idr"`
	Series                  []AdminFinanceChartPoint `json:"series"`
	ByRouter                []AdminRouterRevenueItem `json:"by_router"`
}

// ==================== ADMIN PARTNER MANAGEMENT ====================

type AdminPartnerResponse struct {
	ID                  string     `json:"id"`
	Name                string     `json:"name"`
	VenueName           string     `json:"venue_name"`
	VenueCategory       string     `json:"venue_category"`
	Email               string     `json:"email"`
	Phone               string     `json:"phone"`
	Address             string     `json:"address"`
	Latitude            *float64   `json:"latitude,omitempty"`
	Longitude           *float64   `json:"longitude,omitempty"`
	RevenueSharePercent float64    `json:"revenue_share_percent"`
	WalletBalanceIDR    int64      `json:"wallet_balance_idr"`
	TotalEarnedIDR      int64      `json:"total_earned_idr"`
	BankName            string     `json:"bank_name"`
	BankAccountNumber   string     `json:"bank_account_number"`
	BankAccountHolder   string     `json:"bank_account_holder"`
	RoutersCount        int        `json:"routers_count"`
	RouterNames         []string   `json:"router_names"`
	IsActive            bool       `json:"is_active"`
	LastLoginAt         *time.Time `json:"last_login_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
}

type AdminCreatePartnerRequest struct {
	Name                string   `json:"name" binding:"required,min=2,max=120"`
	VenueName           string   `json:"venue_name" binding:"required,min=2,max=150"`
	VenueCategory       string   `json:"venue_category" binding:"max=64"`
	Email               string   `json:"email" binding:"required,email,max=191"`
	Phone               string   `json:"phone" binding:"max=32"`
	Password            string   `json:"password" binding:"required,min=6,max=72"`
	Address             string   `json:"address" binding:"max=255"`
	Latitude            *float64 `json:"latitude"`
	Longitude           *float64 `json:"longitude"`
	RevenueSharePercent *float64 `json:"revenue_share_percent"`
	BankName            string   `json:"bank_name" binding:"max=80"`
	BankAccountNumber   string   `json:"bank_account_number" binding:"max=80"`
	BankAccountHolder   string   `json:"bank_account_holder" binding:"max=120"`
	IsActive            *bool    `json:"is_active"`
}

type AdminUpdatePartnerRequest struct {
	Name                string   `json:"name" binding:"required,min=2,max=120"`
	VenueName           string   `json:"venue_name" binding:"required,min=2,max=150"`
	VenueCategory       string   `json:"venue_category" binding:"max=64"`
	Email               string   `json:"email" binding:"required,email,max=191"`
	Phone               string   `json:"phone" binding:"max=32"`
	Address             string   `json:"address" binding:"max=255"`
	Latitude            *float64 `json:"latitude"`
	Longitude           *float64 `json:"longitude"`
	RevenueSharePercent float64  `json:"revenue_share_percent" binding:"min=0,max=95"`
	BankName            string   `json:"bank_name" binding:"max=80"`
	BankAccountNumber   string   `json:"bank_account_number" binding:"max=80"`
	BankAccountHolder   string   `json:"bank_account_holder" binding:"max=120"`
	IsActive            bool     `json:"is_active"`
}

type AdminChangePartnerPasswordRequest struct {
	Password string `json:"password" binding:"required,min=6,max=72"`
}

type AdminPartnerListQuery struct {
	PaginationQuery
}

type WithdrawalListQuery struct {
	PaginationQuery
	Status    string `form:"status" binding:"omitempty,oneof=PENDING PAID REJECTED"`
	PartnerID string `form:"partner_id" binding:"omitempty,uuid"`
}

type AdminWithdrawalResponse struct {
	ID                string     `json:"id"`
	WithdrawalNumber  string     `json:"withdrawal_number"`
	PartnerID         string     `json:"partner_id"`
	PartnerName       string     `json:"partner_name"`
	VenueName         string     `json:"venue_name"`
	PartnerEmail      string     `json:"partner_email"`
	AmountIDR         int64      `json:"amount_idr"`
	BankName          string     `json:"bank_name"`
	BankAccountNumber string     `json:"bank_account_number"`
	BankAccountHolder string     `json:"bank_account_holder"`
	Status            string     `json:"status"`
	ProofImageURL     string     `json:"proof_image_url"`
	AdminNote         string     `json:"admin_note"`
	ProcessedAt       *time.Time `json:"processed_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

type AdminProcessWithdrawalRequest struct {
	Action        string `json:"action" binding:"required,oneof=APPROVE REJECT"`
	ProofImageURL string `json:"proof_image_url" binding:"max=500"`
	AdminNote     string `json:"admin_note" binding:"max=1000"`
}

// ==================== PARTNER PORTAL (STRICT PRIVACY: NO SHARE % OR GROSS COST) ====================

type PartnerLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type PartnerProfileResponse struct {
	ID                     string     `json:"id"`
	Name                   string     `json:"name"`
	VenueName              string     `json:"venue_name"`
	VenueCategory          string     `json:"venue_category"`
	Email                  string     `json:"email"`
	Phone                  string     `json:"phone"`
	Address                string     `json:"address"`
	Latitude               *float64   `json:"latitude,omitempty"`
	Longitude              *float64   `json:"longitude,omitempty"`
	HasCoordinates         bool       `json:"has_coordinates"`
	WalletBalanceIDR       int64      `json:"wallet_balance_idr"`
	TotalEarnedIDR         int64      `json:"total_earned_idr"`
	MinWithdrawalAmountIDR int64      `json:"min_withdrawal_amount_idr"`
	BankName               string     `json:"bank_name"`
	BankAccountNumber      string     `json:"bank_account_number"`
	BankAccountHolder      string     `json:"bank_account_holder"`
	IsActive               bool       `json:"is_active"`
	LastLoginAt            *time.Time `json:"last_login_at,omitempty"`
	CreatedAt              time.Time  `json:"created_at"`
}

type PartnerAuthResponse struct {
	Token     string                 `json:"token"`
	ExpiresAt time.Time              `json:"expires_at"`
	Partner   PartnerProfileResponse `json:"partner"`
}

type UpdatePartnerProfileRequest struct {
	Name              string   `json:"name" binding:"required,min=2,max=120"`
	VenueName         string   `json:"venue_name" binding:"required,min=2,max=150"`
	VenueCategory     string   `json:"venue_category" binding:"required,min=2,max=64"`
	Phone             string   `json:"phone" binding:"max=32"`
	Address           string   `json:"address" binding:"required,min=5,max=255"`
	Latitude          *float64 `json:"latitude" binding:"required"`
	Longitude         *float64 `json:"longitude" binding:"required"`
	BankName          string   `json:"bank_name" binding:"max=80"`
	BankAccountNumber string   `json:"bank_account_number" binding:"max=80"`
	BankAccountHolder string   `json:"bank_account_holder" binding:"max=120"`
}

type ChangePartnerPasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=6,max=72"`
}

type PartnerChartPoint struct {
	Label       string `json:"label"`
	Visitors    int64  `json:"visitors"`
	Impressions int64  `json:"impressions"`
	EarnedIDR   int64  `json:"earned_idr"`
}

type PartnerRankProgress struct {
	CurrentTierName     string `json:"current_tier_name"`
	AvgDailyConnects    int64  `json:"avg_daily_connects"`
	AvgDailyImpressions int64  `json:"avg_daily_impressions"`
	NextTierName        string `json:"next_tier_name,omitempty"`
	NextTierMinConnects int64  `json:"next_tier_min_connects,omitempty"`
}

type PartnerOverviewResponse struct {
	WalletBalanceIDR   int64                `json:"wallet_balance_idr"`
	TotalEarnedIDR     int64                `json:"total_earned_idr"`
	TodayEarnedIDR     int64                `json:"today_earned_idr"`
	MonthEarnedIDR     int64                `json:"month_earned_idr"`
	TodayVisitors      int64                `json:"today_visitors"`
	ActiveAdsCount     int64                `json:"active_ads_count"`
	RoutersCount       int                  `json:"routers_count"`
	OnlineRoutersCount int                  `json:"online_routers_count"`
	NeedsLocationSetup bool                 `json:"needs_location_setup"`
	Rank               PartnerRankProgress  `json:"rank"`
	TrendToday         []PartnerChartPoint  `json:"trend_today"`
	Trend7d            []PartnerChartPoint  `json:"trend_7d"`
	Trend30d           []PartnerChartPoint  `json:"trend_30d"`
}

type PartnerAdItem struct {
	ID                 string `json:"id"`
	Title              string `json:"title"`
	Body               string `json:"body"`
	ImageURL           string `json:"image_url"`
	TargetURL          string `json:"target_url"`
	MediaType          string `json:"media_type"`
	LayoutMode         string `json:"layout_mode"`
	DurationSeconds    int    `json:"duration_seconds"`
	AdvertiserName     string `json:"advertiser_name"`
	Status             string `json:"status"`
	StartHour          int    `json:"start_hour"`
	EndHour            int    `json:"end_hour"`
	ImpressionsAtVenue int64  `json:"impressions_at_venue"`
	ClicksAtVenue      int64  `json:"clicks_at_venue"`
	EarnedIDR          int64  `json:"earned_idr"`
}

type PartnerRouterItem struct {
	ID                  string     `json:"id"`
	Name                string     `json:"name"`
	VenueName           string     `json:"venue_name"`
	Address             string     `json:"address"`
	IsConnected         bool       `json:"is_connected"`
	LastSeenAt          *time.Time `json:"last_seen_at,omitempty"`
	ActiveSessionsCount int64      `json:"active_sessions_count"`
	AvgDailyVisitors    int64      `json:"avg_daily_visitors"`
	TierName            string     `json:"tier_name"`
}

type CreatePartnerWithdrawalRequest struct {
	AmountIDR int64 `json:"amount_idr" binding:"required,min=1000,max=100000000"`
}

type PartnerWithdrawalResponse struct {
	ID                string     `json:"id"`
	WithdrawalNumber  string     `json:"withdrawal_number"`
	AmountIDR         int64      `json:"amount_idr"`
	BankName          string     `json:"bank_name"`
	BankAccountNumber string     `json:"bank_account_number"`
	BankAccountHolder string     `json:"bank_account_holder"`
	Status            string     `json:"status"`
	ProofImageURL     string     `json:"proof_image_url"`
	AdminNote         string     `json:"admin_note"`
	ProcessedAt       *time.Time `json:"processed_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

type PartnerWalletTxResponse struct {
	ID              string    `json:"id"`
	Type            string    `json:"type"`
	AmountIDR       int64     `json:"amount_idr"`
	BalanceAfterIDR int64     `json:"balance_after_idr"`
	Description     string    `json:"description"`
	CreatedAt       time.Time `json:"created_at"`
}
