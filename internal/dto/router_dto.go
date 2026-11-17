package dto

// RouterResponse represents a MikroTik router terminating the hotspot.
type RouterResponse struct {
	ID                    string  `json:"id"`
	SiteID                string  `json:"site_id"`
	Name                  string  `json:"name"`
	NASIdentifier         string  `json:"nas_identifier"`
	IPAddress             string  `json:"ip_address"`
	Status                string  `json:"status"`
	Description           string  `json:"description"`
	VoucherPrefix         string  `json:"voucher_prefix"`
	VoucherDigitCount     int     `json:"voucher_digit_count"`
	VoucherNumericOnly    bool    `json:"voucher_numeric_only"`
	DefaultProfileID      *string `json:"default_profile_id,omitempty"`
	SurveyProfileID       *string `json:"survey_profile_id,omitempty"`
	VoucherTTLSeconds     int     `json:"voucher_ttl_seconds"`
	SessionTimeoutSeconds int     `json:"session_timeout_seconds"`
}

// UpdateRouterVoucherConfigRequest contains configuration parameters for automated voucher generation.
type UpdateRouterVoucherConfigRequest struct {
	VoucherPrefix         string  `json:"voucher_prefix" binding:"required,min=1,max=16"`
	VoucherDigitCount     int     `json:"voucher_digit_count" binding:"required,min=4,max=16"`
	VoucherNumericOnly    bool    `json:"voucher_numeric_only"`
	DefaultProfileID      *string `json:"default_profile_id" binding:"omitempty,uuid"`
	SurveyProfileID       *string `json:"survey_profile_id" binding:"omitempty,uuid"`
	VoucherTTLSeconds     int     `json:"voucher_ttl_seconds" binding:"required,min=60,max=604800"`
	SessionTimeoutSeconds int     `json:"session_timeout_seconds" binding:"required,min=60,max=604800"`
}
