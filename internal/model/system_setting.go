package model

import "time"

// SystemSetting stores a key/value runtime setting with .env fallback when absent.
type SystemSetting struct {
	Key         string    `gorm:"type:varchar(120);primaryKey" json:"key"`
	Value       string    `gorm:"type:text;not null;default:''" json:"value"`
	Group       string    `gorm:"type:varchar(40);not null;default:'portal';index" json:"group"`
	Description string    `gorm:"type:varchar(255)" json:"description"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (SystemSetting) TableName() string {
	return "app.system_settings"
}
