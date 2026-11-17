package model

import "time"

// AccountingEvent is the raw audit trail of accepted accounting packets. The
// unique EventKey makes repeated UDP packets idempotent.
type AccountingEvent struct {
	ID            string    `gorm:"type:uuid;primaryKey" json:"id"`
	SessionID     *string   `gorm:"type:uuid;index" json:"session_id,omitempty"`
	NASIdentifier string    `gorm:"type:varchar(128);index" json:"nas_identifier"`
	AcctSessionID string    `gorm:"type:varchar(128);index" json:"acct_session_id"`
	StatusType    string    `gorm:"type:varchar(24);not null;index" json:"status_type"`
	EventKey      string    `gorm:"type:char(64);uniqueIndex;not null" json:"-"`
	Payload       string    `gorm:"type:text" json:"payload"`
	ReceivedAt    time.Time `gorm:"not null;index" json:"received_at"`
}

func (AccountingEvent) TableName() string {
	return "radius.accounting_events"
}
