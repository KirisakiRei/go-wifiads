package model

const (
	PartnerLeadStatusNew       = "NEW"
	PartnerLeadStatusContacted = "CONTACTED"
	PartnerLeadStatusConverted = "CONVERTED"
	PartnerLeadStatusRejected  = "REJECTED"
)

// PartnerLead stores prospective venue owners submitted from the public /daftar-mitra page.
type PartnerLead struct {
	Base
	VenueName            string   `gorm:"type:varchar(150);not null" json:"venue_name"`
	Category             string   `gorm:"type:varchar(64);not null;default:'Kafe'" json:"category"`
	City                 string   `gorm:"type:varchar(100);not null" json:"city"`
	Address              string   `gorm:"type:varchar(255)" json:"address"`
	Latitude             *float64 `gorm:"type:double precision" json:"latitude,omitempty"`
	Longitude            *float64 `gorm:"type:double precision" json:"longitude,omitempty"`
	DailyTrafficEstimate int      `gorm:"not null;default:50" json:"daily_traffic_estimate"`
	ContactName          string   `gorm:"type:varchar(120);not null" json:"contact_name"`
	WhatsApp             string   `gorm:"type:varchar(32);not null" json:"whatsapp"`
	Notes                string   `gorm:"type:text" json:"notes"`
	AdminNote            string   `gorm:"type:text" json:"admin_note"`
	Status               string   `gorm:"type:varchar(24);not null;default:'NEW';index" json:"status"`
	ConvertedPartnerID   *string  `gorm:"type:uuid;index" json:"converted_partner_id,omitempty"`
}

func (PartnerLead) TableName() string {
	return "app.partner_leads"
}
