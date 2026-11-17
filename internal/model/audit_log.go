package model

import "time"

// AuditLog records administrative actions. It is append-only and is never
// soft-deleted.
type AuditLog struct {
	ID         string    `gorm:"type:uuid;primaryKey" json:"id"`
	ActorID    string    `gorm:"type:uuid;index" json:"actor_id"`
	ActorName  string    `gorm:"type:varchar(64)" json:"actor_name"`
	Action     string    `gorm:"type:varchar(64);not null;index" json:"action"`
	EntityType string    `gorm:"type:varchar(64)" json:"entity_type"`
	EntityID   string    `gorm:"type:varchar(64)" json:"entity_id"`
	Detail     string    `gorm:"type:text" json:"detail"`
	IPAddress  string    `gorm:"type:varchar(64)" json:"ip_address"`
	CreatedAt  time.Time `json:"created_at"`
}

func (AuditLog) TableName() string {
	return "app.audit_logs"
}
