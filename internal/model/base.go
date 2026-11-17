package model

import (
	"time"

	"gorm.io/gorm"
)

// Base is embedded by entities that use a UUID primary key and soft deletes.
type Base struct {
	ID        string         `gorm:"type:uuid;primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
