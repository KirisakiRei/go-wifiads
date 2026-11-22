package model

// Role represents an RBAC role with a comma-separated list of permission keys.
type Role struct {
	Base
	Name        string `gorm:"type:varchar(64);uniqueIndex;not null" json:"name"`
	DisplayName string `gorm:"type:varchar(120);not null" json:"display_name"`
	Description string `gorm:"type:varchar(255)" json:"description"`
	Permissions string `gorm:"type:text;not null;default:''" json:"permissions"`
	IsSystem    bool   `gorm:"not null;default:false" json:"is_system"`
}

func (Role) TableName() string {
	return "app.roles"
}

// AllPermissionKeys lists all supported granular module permissions.
var AllPermissionKeys = []string{
	"dashboard:view",
	"routers:view", "routers:create", "routers:edit", "routers:delete",
	"sessions:view", "sessions:disconnect",
	"profiles:view", "profiles:create", "profiles:edit", "profiles:delete",
	"advertisements:view", "advertisements:create", "advertisements:edit", "advertisements:delete",
	"vouchers:view", "vouchers:create", "vouchers:edit", "vouchers:delete",
	"visitors:view", "visitors:block", "visitors:delete",
	"questionnaire:manage",
	"logs:view",
	"settings:manage",
	"users:view", "users:create", "users:edit", "users:delete",
	"roles:view", "roles:create", "roles:edit", "roles:delete",
}
