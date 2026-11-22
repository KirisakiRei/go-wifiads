package dto

import "time"

// AuditLogResponse represents one entry in app.audit_logs.
type AuditLogResponse struct {
	ID         string    `json:"id"`
	ActorID    string    `json:"actor_id"`
	ActorName  string    `json:"actor_name"`
	Action     string    `json:"action"`
	EntityType string    `json:"entity_type"`
	EntityID   string    `json:"entity_id"`
	Detail     string    `json:"detail"`
	IPAddress  string    `json:"ip_address,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

// AuditLogListQuery filters paginated audit logs.
type AuditLogListQuery struct {
	PaginationQuery
	Action     string `form:"action"`
	EntityType string `form:"entity_type"`
	ActorName  string `form:"actor_name"`
	DateFrom   string `form:"date_from"`
	DateTo     string `form:"date_to"`
}

// AuditLogFiltersResponse lists distinct action and entity_type values for filter dropdowns.
type AuditLogFiltersResponse struct {
	Actions     []string `json:"actions"`
	EntityTypes []string `json:"entity_types"`
}

// AuditCleanupResponse reports how many aged audit rows were removed.
type AuditCleanupResponse struct {
	Days    int   `json:"days"`
	Deleted int64 `json:"deleted"`
}
