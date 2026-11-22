package dto

import "time"

// Authentication modes the portal can drive on the Hotspot login form.
const (
	AuthModeCHAP = "CHAP"
	AuthModePAP  = "PAP"
)

// CreatePortalSessionRequest carries the redirect context from MikroTik.
// Every field here is untrusted browser input: it is stored as metadata and
// never used as proof of identity.
type CreatePortalSessionRequest struct {
	MAC             string `json:"mac" binding:"required,max=32"`
	IP              string `json:"ip" binding:"omitempty,max=64"`
	LinkLoginOnly   string `json:"link_login_only" binding:"omitempty,max=512"`
	LinkLogin       string `json:"link_login" binding:"omitempty,max=512"`
	LinkOrig        string `json:"link_orig" binding:"omitempty,max=512"`
	ChapID          string `json:"chap_id" binding:"omitempty,max=16"`
	ChapChallenge   string `json:"chap_challenge" binding:"omitempty,max=256"`
	NASIdentifier   string `json:"nas_identifier" binding:"omitempty,max=128"`
	RouterID        string `json:"router_id" binding:"omitempty,uuid"`
	AdvertisementID string `json:"advertisement_id" binding:"omitempty,uuid"`
}

// PortalProfileSummary describes a connect profile tier shown on the survey/choice screen.
type PortalProfileSummary struct {
	DisplayName           string `json:"display_name"`
	BandwidthDownKbps     int    `json:"bandwidth_down_kbps"`
	BandwidthUpKbps       int    `json:"bandwidth_up_kbps"`
	SessionTimeoutSeconds int    `json:"session_timeout_seconds"`
}

// PortalSessionResponse is returned right after the session is created. The
// countdown starts at AdStartedAt and the button may be used at
// ConnectAvailableAt; the backend re-checks both values on Connect.
type PortalSessionResponse struct {
	SessionToken       string                `json:"session_token"`
	Status             string                `json:"status"`
	AdStartedAt        time.Time             `json:"ad_started_at"`
	AdDurationSeconds  int                   `json:"ad_duration_seconds"`
	ConnectAvailableAt time.Time             `json:"connect_available_at"`
	ExpiresAt          time.Time             `json:"expires_at"`
	SiteName           string                `json:"site_name"`
	RouterName         string                `json:"router_name"`
	AuthMode           string                `json:"auth_mode"`
	AutoConnect        bool                  `json:"auto_connect,omitempty"`
	ConnectData        *ConnectResponse      `json:"connect_data,omitempty"`
	DefaultProfile     *PortalProfileSummary `json:"default_profile,omitempty"`
	SurveyProfile      *PortalProfileSummary `json:"survey_profile,omitempty"`
}

// ActivePortalSessionResponse reports a live RADIUS accounting session for a visitor MAC.
type ActivePortalSessionResponse struct {
	Active                bool       `json:"active"`
	SessionID             string     `json:"session_id,omitempty"`
	Username              string     `json:"username,omitempty"`
	RouterName            string     `json:"router_name,omitempty"`
	ProfileDisplay        string     `json:"profile_display,omitempty"`
	FramedIP              string     `json:"framed_ip,omitempty"`
	BandwidthDownKbps     int        `json:"bandwidth_down_kbps,omitempty"`
	BandwidthUpKbps       int        `json:"bandwidth_up_kbps,omitempty"`
	UptimeSeconds         int64      `json:"uptime_seconds"`
	RemainingSeconds      int64      `json:"remaining_seconds"`
	SessionTimeoutSeconds int        `json:"session_timeout_seconds"`
	InputOctets           int64      `json:"input_octets"`
	OutputOctets          int64      `json:"output_octets"`
	StartedAt             *time.Time `json:"started_at,omitempty"`
	ExpiresAt             *time.Time `json:"expires_at,omitempty"`
}

// PortalDisconnectRequest allows a visitor to disconnect their own active Wi-Fi session.
type PortalDisconnectRequest struct {
	MAC           string `json:"mac" binding:"required,max=32"`
	NASIdentifier string `json:"nas_identifier" binding:"omitempty,max=128"`
	LinkLogout    string `json:"link_logout" binding:"omitempty,max=512"`
}

// PortalDisconnectResponse reports the result of a self-service disconnect request.
type PortalDisconnectResponse struct {
	Disconnected bool   `json:"disconnected"`
	CoASent      bool   `json:"coa_sent"`
	Message      string `json:"message"`
	LogoutURL    string `json:"logout_url,omitempty"`
}

// RedeemVoucherRequest allows VIP/cashier guests to connect directly with an admin-issued voucher.
type RedeemVoucherRequest struct {
	Code     string `json:"code" binding:"omitempty,max=64"`
	Username string `json:"username" binding:"omitempty,max=64"`
	Password string `json:"password" binding:"omitempty,max=128"`
}

// PortalSessionStatusResponse reports the current session state.
type PortalSessionStatusResponse struct {
	Status             string    `json:"status"`
	AdStartedAt        time.Time `json:"ad_started_at"`
	ConnectAvailableAt time.Time `json:"connect_available_at"`
	ExpiresAt          time.Time `json:"expires_at"`
	VoucherIssued      bool      `json:"voucher_issued"`
}

// ConnectResponse hands the browser everything it needs to submit the Hotspot
// login form. The password is intentionally part of the payload: HTTP-CHAP
// requires the browser to compute the MD5 digest locally.
type ConnectResponse struct {
	Username              string    `json:"username"`
	Password              string    `json:"password"`
	LinkLoginOnly         string    `json:"link_login_only"`
	LinkLogin             string    `json:"link_login"`
	LinkOrig              string    `json:"link_orig"`
	ChapID                string    `json:"chap_id"`
	ChapChallenge         string    `json:"chap_challenge"`
	AuthMode              string    `json:"auth_mode"`
	SessionTimeoutSeconds int       `json:"session_timeout_seconds"`
	VoucherExpiresAt      time.Time `json:"voucher_expires_at"`
	BandwidthUpKbps       int       `json:"bandwidth_up_kbps"`
	BandwidthDownKbps     int       `json:"bandwidth_down_kbps"`
	PromoURL              string    `json:"promo_url,omitempty"`
	PromoTitle            string    `json:"promo_title,omitempty"`
}

// SubmitSurveyRequest carries optional contact info from the survey page.
// Both fields are optional: if Skipped is true, the user chose the basic tier.
// SubmitSurveyRequest submits optional survey details before connecting.
type SubmitSurveyRequest struct {
	Email   string            `json:"email" binding:"omitempty,email,max=160"`
	Phone   string            `json:"phone" binding:"omitempty,max=32"`
	Answers map[string]string `json:"answers"`
	Skipped bool              `json:"skipped"`
}

// SubmitSurveyResponse tells the browser which connect profile was assigned.
type SubmitSurveyResponse struct {
	ProfileName    string `json:"profile_name"`
	ProfileDisplay string `json:"profile_display"`
	ReadyToConnect bool   `json:"ready_to_connect"`
}
