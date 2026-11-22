package model

import (
	"time"

	"gorm.io/gorm"
)

// BlockedDevice stores a MAC address denied from connecting via Captive Portal and RADIUS.
// When RouterID is nil, the block applies globally across all routers.
type BlockedDevice struct {
	ID        string         `gorm:"type:uuid;primaryKey" json:"id"`
	MAC       string         `gorm:"type:varchar(32);not null;index:idx_blocked_devices_mac_active" json:"mac"`
	RouterID  *string        `gorm:"type:uuid;index" json:"router_id,omitempty"`
	Reason    string         `gorm:"type:varchar(255)" json:"reason"`
	BlockedBy string         `gorm:"type:varchar(120)" json:"blocked_by"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (BlockedDevice) TableName() string {
	return "app.blocked_devices"
}
