package model

import "time"

// AdminUser is an administrative account. Only admins use password hashing;
// voucher secrets must stay recoverable (see model.Voucher).
type AdminUser struct {
	Base
	Username     string     `gorm:"type:varchar(64);uniqueIndex;not null" json:"username"`
	PasswordHash string     `gorm:"type:varchar(255);not null" json:"-"`
	Name         string     `gorm:"type:varchar(100);not null" json:"name"`
	Role         string     `gorm:"type:varchar(32);not null;default:'admin'" json:"role"`
	IsActive     bool       `gorm:"not null;default:true" json:"is_active"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
}

func (AdminUser) TableName() string {
	return "app.admin_users"
}
