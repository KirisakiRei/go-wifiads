package model

// Site is a physical location hosting one or more routers.
type Site struct {
	Base
	Name     string `gorm:"type:varchar(120);not null" json:"name"`
	Address  string `gorm:"type:varchar(255)" json:"address"`
	Timezone string `gorm:"type:varchar(64);not null;default:'Asia/Jakarta'" json:"timezone"`
}

func (Site) TableName() string {
	return "app.sites"
}
