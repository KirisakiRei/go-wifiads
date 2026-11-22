package model

import "time"

// QuestionnaireField defines one configurable survey field rendered in the Captive Portal.
// When no active rows exist, the portal automatically falls back to default Email & Phone inputs.
type QuestionnaireField struct {
	ID          string    `gorm:"type:uuid;primaryKey" json:"id"`
	Key         string    `gorm:"type:varchar(64);uniqueIndex;not null" json:"key"`
	Label       string    `gorm:"type:varchar(150);not null" json:"label"`
	Type        string    `gorm:"type:varchar(24);not null;default:'TEXT'" json:"type"` // TEXT, EMAIL, PHONE, NUMBER, SELECT, TEXTAREA
	Options     string    `gorm:"type:jsonb;not null;default:'[]'" json:"options"`
	Placeholder string    `gorm:"type:varchar(180)" json:"placeholder"`
	Required    bool      `gorm:"not null;default:false" json:"required"`
	SortOrder   int       `gorm:"not null;default:0;index" json:"sort_order"`
	IsActive    bool      `gorm:"not null;default:true;index" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (QuestionnaireField) TableName() string {
	return "app.questionnaire_fields"
}

// QuestionnaireSubmission stores one visitor's dynamic questionnaire answers as JSONB.
type QuestionnaireSubmission struct {
	ID              string    `gorm:"type:uuid;primaryKey" json:"id"`
	PortalSessionID string    `gorm:"type:uuid;index" json:"portal_session_id"`
	RouterID        string    `gorm:"type:uuid;index" json:"router_id"`
	MAC             string    `gorm:"type:varchar(32);index" json:"mac"`
	Answers         string    `gorm:"type:jsonb;not null;default:'{}'" json:"answers"`
	CreatedAt       time.Time `gorm:"index" json:"created_at"`
}

func (QuestionnaireSubmission) TableName() string {
	return "app.questionnaire_submissions"
}
