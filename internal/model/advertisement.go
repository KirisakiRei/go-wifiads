package model

// Advertisement is a single static Alpha ad shown on the portal.
type Advertisement struct {
	Base
	Title           string `gorm:"type:varchar(150);not null" json:"title"`
	Body            string `gorm:"type:text" json:"body"`
	ImageURL        string `gorm:"type:varchar(255)" json:"image_url"`
	MediaType       string `gorm:"type:varchar(20);not null;default:'image'" json:"media_type"`
	LayoutMode      string `gorm:"type:varchar(20);not null;default:'landscape'" json:"layout_mode"`
	DurationSeconds int    `gorm:"not null;default:0" json:"duration_seconds"`
	SortOrder       int    `gorm:"not null;default:0" json:"sort_order"`
	IsActive        bool   `gorm:"not null;default:true" json:"is_active"`
}

func (Advertisement) TableName() string {
	return "app.advertisements"
}
