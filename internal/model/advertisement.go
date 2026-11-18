package model

import "time"

const (
	AdStatusDraft         = "DRAFT"
	AdStatusPendingReview = "PENDING_REVIEW"
	AdStatusActive        = "ACTIVE"
	AdStatusPaused        = "PAUSED"
	AdStatusRejected      = "REJECTED"
	AdStatusCompleted     = "COMPLETED"
)

// Advertisement represents either an Admin House Ad (AdvertiserID == nil)
// or a paid Advertiser Campaign targeting specific routers and schedules.
type Advertisement struct {
	Base
	AdvertiserID    *string    `gorm:"type:uuid;index" json:"advertiser_id,omitempty"`
	Title           string     `gorm:"type:varchar(150);not null" json:"title"`
	Body            string     `gorm:"type:text" json:"body"`
	ImageURL        string     `gorm:"type:varchar(500)" json:"image_url"`
	TargetURL       string     `gorm:"type:varchar(500)" json:"target_url,omitempty"`
	MediaType       string     `gorm:"type:varchar(20);not null;default:'image'" json:"media_type"`
	LayoutMode      string     `gorm:"type:varchar(20);not null;default:'landscape'" json:"layout_mode"`
	DurationSeconds int        `gorm:"not null;default:0" json:"duration_seconds"`
	SortOrder       int        `gorm:"not null;default:0" json:"sort_order"`
	IsActive        bool       `gorm:"not null;default:true" json:"is_active"`
	Status          string     `gorm:"type:varchar(24);not null;default:'ACTIVE';index" json:"status"`
	RejectionReason string     `gorm:"type:text" json:"rejection_reason,omitempty"`
	StartDate       *time.Time `gorm:"index" json:"start_date,omitempty"`
	EndDate         *time.Time `gorm:"index" json:"end_date,omitempty"`
	StartHour       int        `gorm:"not null;default:0" json:"start_hour"`
	EndHour         int        `gorm:"not null;default:24" json:"end_hour"`
	ActiveDays      string     `gorm:"type:varchar(32);not null;default:'1,2,3,4,5,6,7'" json:"active_days"`
	DailyBudgetIDR  int64      `gorm:"not null;default:0" json:"daily_budget_idr"`
	TotalBudgetIDR  int64      `gorm:"not null;default:0" json:"total_budget_idr"`
	SpentAmountIDR  int64      `gorm:"not null;default:0" json:"spent_amount_idr"`
	ImpressionsCount int64     `gorm:"not null;default:0" json:"impressions_count"`
	ClicksCount     int64      `gorm:"not null;default:0" json:"clicks_count"`
	LastShownAt     *time.Time `gorm:"index" json:"last_shown_at,omitempty"`
}

func (Advertisement) TableName() string {
	return "app.advertisements"
}

// AdvertisementRouter maps a campaign to one or more target MikroTik routers.
type AdvertisementRouter struct {
	ID              string    `gorm:"type:uuid;primaryKey" json:"id"`
	AdvertisementID string    `gorm:"type:uuid;not null;uniqueIndex:idx_ad_router" json:"advertisement_id"`
	RouterID        string    `gorm:"type:uuid;not null;uniqueIndex:idx_ad_router;index" json:"router_id"`
	CreatedAt       time.Time `gorm:"not null" json:"created_at"`
}

func (AdvertisementRouter) TableName() string {
	return "app.advertisement_routers"
}
