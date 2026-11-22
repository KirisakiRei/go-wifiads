package model

import "time"

// VoucherBatch groups vouchers generated together in a single batch transaction.
type VoucherBatch struct {
	ID        string    `gorm:"type:uuid;primaryKey" json:"id"`
	Name      string    `gorm:"type:varchar(120);not null" json:"name"`
	RouterID  string    `gorm:"type:uuid;not null;index" json:"router_id"`
	ProfileID *string   `gorm:"type:uuid;index" json:"profile_id,omitempty"`
	Prefix    string    `gorm:"type:varchar(16)" json:"prefix"`
	Quantity  int       `gorm:"not null" json:"quantity"`
	CreatedBy string    `gorm:"type:varchar(64)" json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
}

func (VoucherBatch) TableName() string {
	return "radius.voucher_batches"
}
