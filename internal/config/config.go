package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"

	"wifiads/pkg/utils"
)

const (
	EnvDevelopment = "development"
	EnvProduction  = "production"
)

// Config holds every runtime setting. Values come from environment variables
// (optionally loaded from .env) and are validated once at startup.
type Config struct {
	AppEnv   string
	AppName  string
	HTTPAddr string
	LogLevel string

	DB     DBConfig
	JWT    JWTConfig
	Portal PortalConfig
	Radius RadiusConfig
	R2     R2Config
	Keys   KeysConfig
	Seed   SeedConfig
}

// R2Config holds Cloudflare R2 Object Storage settings.
type R2Config struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	BucketName      string
	PublicURL       string
}

// DBConfig describes the PostgreSQL connection.
type DBConfig struct {
	Host                  string
	Port                  int
	User                  string
	Password              string
	Name                  string
	SSLMode               string
	MaxIdleConns          int
	MaxOpenConns          int
	ConnMaxLifetimeMinute int
}

// DSN builds the lib/pq style connection string used by the Postgres driver.
func (d DBConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s TimeZone=UTC",
		d.Host, d.Port, d.User, d.Password, d.Name, d.SSLMode,
	)
}

// JWTConfig controls admin authentication.
type JWTConfig struct {
	Secret       string
	Issuer       string
	ExpiryHours  int
	CookieName   string
	CookieSecure bool
}

// PortalConfig controls the visitor-facing portal.
type PortalConfig struct {
	PublicBaseURL         string
	AdDurationSeconds     int
	SessionTTLSeconds     int
	VoucherTTLSeconds     int
	SessionTimeoutSeconds int
	VoucherPasswordLength int
	VoucherUsernamePrefix string
	AllowedLoginHosts     []string
	// DevMode relaxes the link-login-only requirement so portal and Connect can
	// be exercised on a laptop without a MikroTik.
	DevMode bool
}

// RadiusConfig controls both RADIUS listeners and accounting behaviour.
type RadiusConfig struct {
	AuthAddr          string
	AcctAddr          string
	StaleAfterSeconds int
	RetentionDays     int
}

// KeysConfig holds the AES-256 keys used for reversible secrets.
type KeysConfig struct {
	VoucherKey      []byte
	RadiusSecretKey []byte
}

// SeedConfig provides the initial Alpha data written by cmd/migrate.
type SeedConfig struct {
	AdminUsername         string
	AdminPassword         string
	AdminName             string
	SiteName              string
	SiteTimezone          string
	RouterName            string
	RouterIPAddress       string
	NASIdentifier         string
	NASIPAddress          string
	NASSharedSecret       string
	AdvertisementTitle    string
	AdvertisementBody     string
	AdvertisementImageURL string
}

// Load reads the configuration from the environment and validates it.
func Load() (*Config, error) {
	// A missing .env is fine: production deployments set real environment vars.
	_ = godotenv.Load()

	cfg := &Config{
		AppEnv:   env("APP_ENV", EnvDevelopment),
		AppName:  env("APP_NAME", "wifiads"),
		HTTPAddr: env("HTTP_ADDR", ":8080"),
		LogLevel: env("LOG_LEVEL", "info"),
		DB: DBConfig{
			Host:                  env("DB_HOST", "localhost"),
			Port:                  envInt("DB_PORT", 5432),
			User:                  env("DB_USER", "postgres"),
			Password:              env("DB_PASSWORD", ""),
			Name:                  env("DB_NAME", "wifi_advertising"),
			SSLMode:               env("DB_SSLMODE", "disable"),
			MaxIdleConns:          envInt("DB_MAX_IDLE_CONNS", 10),
			MaxOpenConns:          envInt("DB_MAX_OPEN_CONNS", 100),
			ConnMaxLifetimeMinute: envInt("DB_CONN_MAX_LIFETIME_MINUTES", 60),
		},
		JWT: JWTConfig{
			Secret:       env("JWT_SECRET", ""),
			Issuer:       env("JWT_ISSUER", "wifiads-api"),
			ExpiryHours:  envInt("JWT_EXPIRY_HOURS", 12),
			CookieName:   env("JWT_COOKIE_NAME", "wifiads_admin"),
			CookieSecure: envBool("JWT_COOKIE_SECURE", false),
		},
		Portal: PortalConfig{
			PublicBaseURL:         env("PORTAL_PUBLIC_BASE_URL", "http://localhost:8080"),
			AdDurationSeconds:     envInt("PORTAL_AD_DURATION_SECONDS", 5),
			SessionTTLSeconds:     envInt("PORTAL_SESSION_TTL_SECONDS", 900),
			VoucherTTLSeconds:     envInt("PORTAL_VOUCHER_TTL_SECONDS", 300),
			SessionTimeoutSeconds: envInt("PORTAL_SESSION_TIMEOUT_SECONDS", 3600),
			VoucherPasswordLength: envInt("PORTAL_VOUCHER_PASSWORD_LENGTH", 12),
			VoucherUsernamePrefix: env("PORTAL_VOUCHER_USERNAME_PREFIX", "wf"),
			AllowedLoginHosts:     envList("PORTAL_ALLOWED_LOGIN_HOSTS", nil),
			DevMode:               envBool("PORTAL_DEV_MODE", false),
		},
		Radius: RadiusConfig{
			AuthAddr:          env("RADIUS_AUTH_ADDR", ":1812"),
			AcctAddr:          env("RADIUS_ACCT_ADDR", ":1813"),
			StaleAfterSeconds: envInt("RADIUS_STALE_AFTER_SECONDS", 900),
			RetentionDays:     envInt("RADIUS_EVENT_RETENTION_DAYS", 30),
		},
		R2: R2Config{
			AccountID:       env("R2_ACCOUNT_ID", ""),
			AccessKeyID:     env("R2_ACCESS_KEY_ID", ""),
			SecretAccessKey: env("R2_SECRET_ACCESS_KEY", ""),
			BucketName:      env("R2_BUCKET_NAME", ""),
			PublicURL:       env("R2_PUBLIC_URL", ""),
		},
		Seed: SeedConfig{
			AdminUsername:         env("SEED_ADMIN_USERNAME", "admin"),
			AdminPassword:         env("SEED_ADMIN_PASSWORD", ""),
			AdminName:             env("SEED_ADMIN_NAME", "Alpha Administrator"),
			SiteName:              env("SEED_SITE_NAME", "Alpha Site"),
			SiteTimezone:          env("SEED_SITE_TIMEZONE", "Asia/Jakarta"),
			RouterName:            env("SEED_ROUTER_NAME", "alpha-router-01"),
			RouterIPAddress:       env("SEED_ROUTER_IP", "192.168.88.1"),
			NASIdentifier:         env("SEED_NAS_IDENTIFIER", "alpha-router-01"),
			NASIPAddress:          env("SEED_NAS_IP", "192.168.88.1"),
			NASSharedSecret:       env("SEED_NAS_SHARED_SECRET", ""),
			AdvertisementTitle:    env("SEED_AD_TITLE", "Wi-Fi Gratis"),
			AdvertisementBody:     env("SEED_AD_BODY", "Nikmati akses internet gratis. Tunggu hitung mundur selesai lalu tekan Connect."),
			AdvertisementImageURL: env("SEED_AD_IMAGE_URL", "/static/img/ad-placeholder.svg"),
		},
	}

	if err := cfg.normalizeAndValidate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) normalizeAndValidate() error {
	c.AppEnv = strings.ToLower(strings.TrimSpace(c.AppEnv))
	if c.AppEnv != EnvDevelopment && c.AppEnv != EnvProduction {
		return fmt.Errorf("APP_ENV must be %q or %q", EnvDevelopment, EnvProduction)
	}

	var problems []string
	if strings.TrimSpace(c.DB.Host) == "" {
		problems = append(problems, "DB_HOST is required")
	}
	if strings.TrimSpace(c.DB.User) == "" {
		problems = append(problems, "DB_USER is required")
	}
	if strings.TrimSpace(c.DB.Name) == "" {
		problems = append(problems, "DB_NAME is required")
	}
	if c.Portal.AdDurationSeconds < 1 {
		problems = append(problems, "PORTAL_AD_DURATION_SECONDS must be >= 1")
	}
	if c.Portal.SessionTTLSeconds < c.Portal.AdDurationSeconds {
		problems = append(problems, "PORTAL_SESSION_TTL_SECONDS must be >= PORTAL_AD_DURATION_SECONDS")
	}
	if c.Radius.StaleAfterSeconds < 60 {
		problems = append(problems, "RADIUS_STALE_AFTER_SECONDS must be >= 60")
	}
	if c.JWT.ExpiryHours < 1 {
		problems = append(problems, "JWT_EXPIRY_HOURS must be >= 1")
	}

	if strings.TrimSpace(c.JWT.Secret) == "" {
		if c.IsProduction() {
			problems = append(problems, "JWT_SECRET is required in production")
		} else {
			c.JWT.Secret = "dev-only-jwt-secret-change-me-please"
		}
	}
	if c.IsProduction() && len(c.JWT.Secret) < 32 {
		problems = append(problems, "JWT_SECRET must be at least 32 characters in production")
	}

	voucherKey, err := loadKey("VOUCHER_ENC_KEY", c, "voucher")
	if err != nil {
		problems = append(problems, err.Error())
	} else {
		c.Keys.VoucherKey = voucherKey
	}

	radiusKey, err := loadKey("RADIUS_SECRET_ENC_KEY", c, "radius-secret")
	if err != nil {
		problems = append(problems, err.Error())
	} else {
		c.Keys.RadiusSecretKey = radiusKey
	}

	if c.IsProduction() {
		if c.Portal.DevMode {
			problems = append(problems, "PORTAL_DEV_MODE must be disabled in production")
		}
		if len(c.Portal.AllowedLoginHosts) == 0 {
			problems = append(problems, "PORTAL_ALLOWED_LOGIN_HOSTS is required in production")
		}
		if !strings.HasPrefix(strings.ToLower(c.Portal.PublicBaseURL), "https://") {
			problems = append(problems, "PORTAL_PUBLIC_BASE_URL must use https in production")
		}
		if c.Seed.NASSharedSecret == "" {
			problems = append(problems, "SEED_NAS_SHARED_SECRET is required in production")
		}
		if c.Seed.AdminPassword == "" {
			problems = append(problems, "SEED_ADMIN_PASSWORD is required in production")
		}
	}

	if len(problems) > 0 {
		return errors.New("invalid configuration: " + strings.Join(problems, "; "))
	}
	return nil
}

// IsProduction reports whether the app runs in production mode.
func (c *Config) IsProduction() bool {
	return c.AppEnv == EnvProduction
}

// JWTExpiry returns the admin token lifetime.
func (c *Config) JWTExpiry() time.Duration {
	return time.Duration(c.JWT.ExpiryHours) * time.Hour
}

// AdDuration returns the mandatory advertisement countdown.
func (c *Config) AdDuration() time.Duration {
	return time.Duration(c.Portal.AdDurationSeconds) * time.Second
}

// PortalSessionTTL returns how long a portal session stays usable.
func (c *Config) PortalSessionTTL() time.Duration {
	return time.Duration(c.Portal.SessionTTLSeconds) * time.Second
}

// VoucherTTL returns how long an issued voucher may be used to log in.
func (c *Config) VoucherTTL() time.Duration {
	return time.Duration(c.Portal.VoucherTTLSeconds) * time.Second
}

// StaleAfter returns the accounting silence threshold.
func (c *Config) StaleAfter() time.Duration {
	return time.Duration(c.Radius.StaleAfterSeconds) * time.Second
}

// ConnMaxLifetime returns the database connection lifetime.
func (c *Config) ConnMaxLifetime() time.Duration {
	return time.Duration(c.DB.ConnMaxLifetimeMinute) * time.Minute
}

func loadKey(envName string, cfg *Config, label string) ([]byte, error) {
	raw := strings.TrimSpace(os.Getenv(envName))
	if raw == "" {
		if cfg.IsProduction() {
			return nil, fmt.Errorf("%s is required in production", envName)
		}
		return utils.DeriveDevKey(label), nil
	}
	key, err := utils.ParseKey(raw)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", envName, err)
	}
	return key, nil
}

func env(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && strings.TrimSpace(value) != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) int {
	value, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(value) == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return fallback
	}
	return parsed
}

func envBool(key string, fallback bool) bool {
	value, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(value) == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(strings.TrimSpace(value))
	if err != nil {
		return fallback
	}
	return parsed
}

func envList(key string, fallback []string) []string {
	value, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(value) == "" {
		return fallback
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	if len(result) == 0 {
		return fallback
	}
	return result
}
