package dto

import "time"

// AdminUserResponse represents an admin user profile returned to the frontend.
type AdminUserResponse struct {
	ID          string     `json:"id"`
	Username    string     `json:"username"`
	Name        string     `json:"name"`
	Role        string     `json:"role"`
	IsActive    bool       `json:"is_active"`
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// CreateAdminUserRequest carries new admin account data.
type CreateAdminUserRequest struct {
	Username string `json:"username" binding:"required,min=3,max=64"`
	Password string `json:"password" binding:"required,min=6,max=100"`
	Name     string `json:"name" binding:"required,min=2,max=100"`
	Role     string `json:"role" binding:"required,oneof=admin superadmin operator"`
	IsActive bool   `json:"is_active"`
}

// UpdateAdminUserRequest carries mutable admin profile fields.
type UpdateAdminUserRequest struct {
	Name     string `json:"name" binding:"required,min=2,max=100"`
	Role     string `json:"role" binding:"required,oneof=admin superadmin operator"`
	IsActive bool   `json:"is_active"`
}

// ChangePasswordRequest carries a new password for an admin user.
type ChangePasswordRequest struct {
	Password string `json:"password" binding:"required,min=6,max=100"`
}
