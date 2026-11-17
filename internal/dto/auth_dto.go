package dto

// LoginRequest authenticates an admin account.
type LoginRequest struct {
	Username string `json:"username" binding:"required,min=3,max=64"`
	Password string `json:"password" binding:"required,min=6,max=128"`
}

// AdminResponse is the public representation of an admin account.
type AdminResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Name     string `json:"name"`
	Role     string `json:"role"`
}

// LoginResponse returns the signed token and the authenticated admin.
type LoginResponse struct {
	Token     string        `json:"token"`
	ExpiresAt string        `json:"expires_at"`
	User      AdminResponse `json:"user"`
}
