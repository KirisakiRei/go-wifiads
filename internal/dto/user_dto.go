package dto

import "time"

// AdminUserResponse represents an admin user profile returned to the frontend.
type AdminUserResponse struct {
	ID              string     `json:"id"`
	Username        string     `json:"username"`
	Name            string     `json:"name"`
	Role            string     `json:"role"`
	RoleDisplayName string     `json:"role_display_name"`
	Permissions     []string   `json:"permissions"`
	IsActive        bool       `json:"is_active"`
	LastLoginAt     *time.Time `json:"last_login_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// CreateAdminUserRequest carries new admin account data.
type CreateAdminUserRequest struct {
	Username string `json:"username" binding:"required,min=3,max=64"`
	Password string `json:"password" binding:"required,min=6,max=100"`
	Name     string `json:"name" binding:"required,min=2,max=100"`
	Role     string `json:"role" binding:"required,min=2,max=64"`
	IsActive bool   `json:"is_active"`
}

// UpdateAdminUserRequest carries mutable admin profile fields.
type UpdateAdminUserRequest struct {
	Name     string `json:"name" binding:"required,min=2,max=100"`
	Role     string `json:"role" binding:"required,min=2,max=64"`
	IsActive bool   `json:"is_active"`
}

// ChangePasswordRequest carries a new password for an admin user.
type ChangePasswordRequest struct {
	Password string `json:"password" binding:"required,min=6,max=100"`
}

// RoleResponse represents an RBAC role with its assigned permissions and user count.
type RoleResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	DisplayName string    `json:"display_name"`
	Description string    `json:"description"`
	Permissions []string  `json:"permissions"`
	IsSystem    bool      `json:"is_system"`
	UsersCount  int       `json:"users_count"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CreateRoleRequest creates a new RBAC role.
type CreateRoleRequest struct {
	Name        string   `json:"name" binding:"required,min=2,max=64"`
	DisplayName string   `json:"display_name" binding:"required,min=2,max=120"`
	Description string   `json:"description" binding:"max=255"`
	Permissions []string `json:"permissions"`
}

// UpdateRoleRequest updates an existing RBAC role.
type UpdateRoleRequest struct {
	DisplayName string   `json:"display_name" binding:"required,min=2,max=120"`
	Description string   `json:"description" binding:"max=255"`
	Permissions []string `json:"permissions"`
}
