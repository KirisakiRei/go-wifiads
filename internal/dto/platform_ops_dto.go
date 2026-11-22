package dto

import "time"

// QuestionnaireFieldResponse represents one configurable captive-portal survey field.
type QuestionnaireFieldResponse struct {
	ID          string    `json:"id"`
	Key         string    `json:"key"`
	Label       string    `json:"label"`
	Type        string    `json:"type"`
	Options     []string  `json:"options"`
	Placeholder string    `json:"placeholder"`
	Required    bool      `json:"required"`
	SortOrder   int       `json:"sort_order"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// UpsertQuestionnaireFieldRequest creates or updates a questionnaire field.
type UpsertQuestionnaireFieldRequest struct {
	Key         string   `json:"key" binding:"required,min=2,max=64"`
	Label       string   `json:"label" binding:"required,min=2,max=150"`
	Type        string   `json:"type" binding:"required,oneof=TEXT EMAIL PHONE NUMBER SELECT TEXTAREA"`
	Options     []string `json:"options"`
	Placeholder string   `json:"placeholder" binding:"max=180"`
	Required    bool     `json:"required"`
	SortOrder   int      `json:"sort_order"`
	IsActive    bool     `json:"is_active"`
}

// ReorderQuestionnaireFieldsRequest updates sort_order for all provided IDs.
type ReorderQuestionnaireFieldsRequest struct {
	IDs []string `json:"ids" binding:"required,min=1"`
}

// QuestionnaireSubmissionResponse represents one visitor's survey submission.
type QuestionnaireSubmissionResponse struct {
	ID              string            `json:"id"`
	PortalSessionID string            `json:"portal_session_id"`
	RouterID        string            `json:"router_id"`
	RouterName      string            `json:"router_name,omitempty"`
	MAC             string            `json:"mac"`
	Answers         map[string]string `json:"answers"`
	CreatedAt       time.Time         `json:"created_at"`
}

// QuestionnaireSubmissionListQuery filters paginated questionnaire submissions.
type QuestionnaireSubmissionListQuery struct {
	PaginationQuery
	RouterID string `form:"router_id" binding:"omitempty,uuid"`
	MAC      string `form:"mac"`
}

// SystemSettingItem represents one editable setting entry.
type SystemSettingItem struct {
	Key         string    `json:"key"`
	Value       string    `json:"value"`
	Group       string    `json:"group"`
	Description string    `json:"description"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// BulkUpdateSettingsRequest updates multiple settings at once.
type BulkUpdateSettingsRequest struct {
	Settings map[string]string `json:"settings" binding:"required"`
}

// AdWatchMetricsRequest reports video/ad completion and watch duration from the captive portal.
type AdWatchMetricsRequest struct {
	Completed    bool `json:"completed"`
	WatchSeconds int  `json:"watch_seconds" binding:"min=0,max=600"`
}
