package model

import "time"

// Visitor (device) statuses derived from portal and RADIUS accounting events.
const (
	VisitorStatusPending   = "PENDING"
	VisitorStatusConnected = "CONNECTED"
	VisitorStatusClosed    = "CLOSED"
	VisitorStatusStale     = "STALE"
)

// WifiVisitor is the Alpha "user": a Wi-Fi device session, not a natural person.
type WifiVisitor struct {
	Base
	PortalSessionID    string     `gorm:"type:uuid;uniqueIndex;not null" json:"portal_session_id"`
	SiteID             string     `gorm:"type:uuid;not null;index" json:"site_id"`
	RouterID           string     `gorm:"type:uuid;not null;index" json:"router_id"`
	MAC                string     `gorm:"type:varchar(32);not null;index" json:"mac"`
	IP                 string     `gorm:"type:varchar(64)" json:"ip"`
	VoucherID          *string    `gorm:"type:uuid;index" json:"voucher_id,omitempty"`
	Username           string     `gorm:"type:varchar(64);index" json:"username"`
	Status             string     `gorm:"type:varchar(16);not null;index" json:"status"`
	ConnectedAt        *time.Time `json:"connected_at,omitempty"`
	DisconnectedAt     *time.Time `json:"disconnected_at,omitempty"`
	LastAccountingAt   *time.Time `json:"last_accounting_at,omitempty"`
	SessionTimeSeconds int64      `gorm:"not null;default:0" json:"session_time_seconds"`
}

func (WifiVisitor) TableName() string {
	return "app.wifi_visitors"
}
