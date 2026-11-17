package dto

import "time"

// VisitorResponse is one row of the Wi-Fi users/devices table.
type VisitorResponse struct {
	ID                 string     `json:"id"`
	PortalSessionID    string     `json:"portal_session_id"`
	SiteID             string     `json:"site_id"`
	RouterID           string     `json:"router_id"`
	MAC                string     `json:"mac"`
	IP                 string     `json:"ip"`
	Username           string     `json:"username"`
	Status             string     `json:"status"`
	ConnectedAt        *time.Time `json:"connected_at,omitempty"`
	DisconnectedAt     *time.Time `json:"disconnected_at,omitempty"`
	LastAccountingAt   *time.Time `json:"last_accounting_at,omitempty"`
	SessionTimeSeconds int64      `json:"session_time_seconds"`
	CreatedAt          time.Time  `json:"created_at"`
	SurveyEmail        string     `json:"survey_email"`
	SurveyPhone        string     `json:"survey_phone"`
	SurveySkipped      bool       `json:"survey_skipped"`
	ProfileName        string     `json:"profile_name"`
	InputOctets        int64      `json:"input_octets"`
	OutputOctets       int64      `json:"output_octets"`
	VoucherExpiresAt   *time.Time `json:"voucher_expires_at,omitempty"`
	VoucherStatus      string     `json:"voucher_status,omitempty"`
}

// VisitorListQuery filters the visitor list.
type VisitorListQuery struct {
	PaginationQuery
	Status string `form:"status" binding:"omitempty,oneof=PENDING CONNECTED CLOSED STALE"`
}

// SessionResponse is one RADIUS accounting session.
type SessionResponse struct {
	ID                 string     `json:"id"`
	NASIdentifier      string     `json:"nas_identifier"`
	AcctSessionID      string     `json:"acct_session_id"`
	Username           string     `json:"username"`
	CallingStationID   string     `json:"calling_station_id"`
	FramedIPAddress    string     `json:"framed_ip_address"`
	Status             string     `json:"status"`
	StartedAt          *time.Time `json:"started_at,omitempty"`
	LastAccountingAt   *time.Time `json:"last_accounting_at,omitempty"`
	StoppedAt          *time.Time `json:"stopped_at,omitempty"`
	SessionTimeSeconds int64      `json:"session_time_seconds"`
	InputOctets        int64      `json:"input_octets"`
	OutputOctets       int64      `json:"output_octets"`
	TerminateCause     string     `json:"terminate_cause,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
}

// SessionListQuery filters the accounting session list.
type SessionListQuery struct {
	PaginationQuery
	Status string `form:"status" binding:"omitempty,oneof=ACTIVE CLOSED STALE"`
}

// OverviewResponse powers the admin dashboard cards.
type OverviewResponse struct {
	ActiveDevices  int64 `json:"active_devices"`
	PendingDevices int64 `json:"pending_devices"`
	ActiveSessions int64 `json:"active_sessions"`
	TotalVouchers  int64 `json:"total_vouchers"`
	IssuedVouchers int64 `json:"issued_vouchers"`
	ActiveVouchers int64 `json:"active_vouchers"`
	UsedVouchers   int64 `json:"used_vouchers"`
}
