package model

import "time"

// Accounting session statuses.
const (
	AccountingSessionStatusActive = "ACTIVE"
	AccountingSessionStatusClosed = "CLOSED"
	AccountingSessionStatusStale  = "STALE"
)

// AccountingSession is the authoritative record of a live or finished Wi-Fi
// session. It is keyed by NAS identifier plus Acct-Session-Id so duplicated
// UDP packets cannot create a second session.
type AccountingSession struct {
	Base
	NASIdentifier      string     `gorm:"type:varchar(128);not null;uniqueIndex:uq_accounting_nas_session" json:"nas_identifier"`
	AcctSessionID      string     `gorm:"type:varchar(128);not null;uniqueIndex:uq_accounting_nas_session" json:"acct_session_id"`
	RouterID           *string    `gorm:"type:uuid;index" json:"router_id,omitempty"`
	VoucherID          *string    `gorm:"type:uuid;index" json:"voucher_id,omitempty"`
	Username           string     `gorm:"type:varchar(64);index" json:"username"`
	CallingStationID   string     `gorm:"type:varchar(32);index" json:"calling_station_id"`
	FramedIPAddress    string     `gorm:"type:varchar(64)" json:"framed_ip_address"`
	Status             string     `gorm:"type:varchar(16);not null;index" json:"status"`
	StartedAt          *time.Time `json:"started_at,omitempty"`
	LastAccountingAt   *time.Time `json:"last_accounting_at,omitempty"`
	StoppedAt          *time.Time `json:"stopped_at,omitempty"`
	SessionTimeSeconds int64      `gorm:"not null;default:0" json:"session_time_seconds"`
	InputOctets        int64      `gorm:"not null;default:0" json:"input_octets"`
	OutputOctets       int64      `gorm:"not null;default:0" json:"output_octets"`
	TerminateCause     string     `gorm:"type:varchar(64)" json:"terminate_cause"`
}

func (AccountingSession) TableName() string {
	return "radius.accounting_sessions"
}
