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
	MAC           string `json:"mac" binding:"required,max=32"`
	IP            string `json:"ip" binding:"omitempty,max=64"`
	LinkLoginOnly string `json:"link_login_only" binding:"omitempty,max=512"`
	LinkLogin     string `json:"link_login" binding:"omitempty,max=512"`
	LinkOrig      string `json:"link_orig" binding:"omitempty,max=512"`
	ChapID        string `json:"chap_id" binding:"omitempty,max=16"`
	ChapChallenge string `json:"chap_challenge" binding:"omitempty,max=256"`
	NASIdentifier string `json:"nas_identifier" binding:"omitempty,max=128"`
	RouterID      string `json:"router_id" binding:"omitempty,uuid"`
}

// PortalSessionResponse is returned right after the session is created. The
// countdown starts at AdStartedAt and the button may be used at
// ConnectAvailableAt; the backend re-checks both values on Connect.
type PortalSessionResponse struct {
	SessionToken       string    `json:"session_token"`
	Status             string    `json:"status"`
	AdStartedAt        time.Time `json:"ad_started_at"`
	AdDurationSeconds  int       `json:"ad_duration_seconds"`
	ConnectAvailableAt time.Time `json:"connect_available_at"`
	ExpiresAt          time.Time `json:"expires_at"`
	SiteName           string    `json:"site_name"`
	RouterName         string    `json:"router_name"`
	AuthMode           string    `json:"auth_mode"`
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
}

// SubmitSurveyRequest carries optional contact info from the survey page.
// Both fields are optional: if Skipped is true, the user chose the basic tier.
type SubmitSurveyRequest struct {
	Email   string `json:"email"   binding:"omitempty,email,max=255"`
	Phone   string `json:"phone"   binding:"omitempty,max=32"`
	Skipped bool   `json:"skipped"`
}

// SubmitSurveyResponse tells the browser which connect profile was assigned.
type SubmitSurveyResponse struct {
	ProfileName    string `json:"profile_name"`
	ProfileDisplay string `json:"profile_display"`
	ReadyToConnect bool   `json:"ready_to_connect"`
}
