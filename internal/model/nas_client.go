package model

// NASClient is a RADIUS client allowed to send requests. The shared secret is
// stored encrypted (AES-GCM) because the RADIUS server needs the plaintext to
// validate packet digests, and it is a different credential from the voucher
// username/password and from any IPsec credential.
type NASClient struct {
	Base
	RouterID         string `gorm:"type:uuid;index" json:"router_id"`
	SiteID           string `gorm:"type:uuid;index" json:"site_id"`
	Name             string `gorm:"type:varchar(120);not null" json:"name"`
	NASIdentifier    string `gorm:"type:varchar(128);uniqueIndex;not null" json:"nas_identifier"`
	IPAddress        string `gorm:"type:varchar(64);uniqueIndex;not null" json:"ip_address"`
	SecretCiphertext string `gorm:"type:text;not null" json:"-"`
	IsActive         bool   `gorm:"not null;default:true" json:"is_active"`
}

func (NASClient) TableName() string {
	return "radius.nas_clients"
}
