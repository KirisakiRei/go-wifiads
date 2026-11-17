package router

import (
	"context"
	"fmt"
	"html/template"
	"io/fs"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"wifiads/internal/config"
	"wifiads/internal/handler"
	"wifiads/internal/middleware"
	"wifiads/internal/repository"
	"wifiads/internal/service"
	"wifiads/portal"
)

// New wires repositories, services, handlers and routes.
func New(cfg *config.Config, db *gorm.DB, logger *slog.Logger) (*gin.Engine, error) {
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	templates, err := template.New("").Funcs(templateFuncs()).ParseFS(portal.Templates(), "*.html")
	if err != nil {
		return nil, fmt.Errorf("parse templates: %w", err)
	}
	staticFS, err := fs.Sub(portal.Static(), ".")
	if err != nil {
		return nil, fmt.Errorf("load static assets: %w", err)
	}

	// Repositories
	adminUsers := repository.NewAdminUserRepository(db)
	sites := repository.NewSiteRepository(db)
	routers := repository.NewRouterRepository(db)
	advertisements := repository.NewAdvertisementRepository(db)
	portalSessions := repository.NewPortalSessionRepository(db)
	vouchers := repository.NewVoucherRepository(db)
	visitors := repository.NewWifiVisitorRepository(db)
	connectProfiles := repository.NewConnectProfileRepository(db)
	accounting := repository.NewAccountingRepository(db)
	audits := repository.NewAuditLogRepository(db)

	// Services
	authService := service.NewAuthService(adminUsers, logger, cfg.JWT.Secret, cfg.JWT.Issuer, cfg.JWTExpiry())
	voucherService := service.NewVoucherService(vouchers, routers, sites, connectProfiles, audits, logger, service.VoucherServiceOptions{
		VoucherKey:            cfg.Keys.VoucherKey,
		UsernamePrefix:        cfg.Portal.VoucherUsernamePrefix,
		PasswordLength:        cfg.Portal.VoucherPasswordLength,
		DefaultTTL:            cfg.VoucherTTL(),
		DefaultSessionTimeout: cfg.Portal.SessionTimeoutSeconds,
	})
	portalService := service.NewPortalService(portalSessions, vouchers, visitors, connectProfiles, routers, sites, advertisements, logger, service.PortalServiceOptions{
		VoucherKey:            cfg.Keys.VoucherKey,
		UsernamePrefix:        cfg.Portal.VoucherUsernamePrefix,
		PasswordLength:        cfg.Portal.VoucherPasswordLength,
		AdDuration:            cfg.AdDuration(),
		SessionTTL:            cfg.PortalSessionTTL(),
		VoucherTTL:            cfg.VoucherTTL(),
		DefaultSessionTimeout: cfg.Portal.SessionTimeoutSeconds,
		AllowedLoginHosts:     cfg.Portal.AllowedLoginHosts,
		DevMode:               cfg.Portal.DevMode,
	})
	adminService := service.NewAdminService(visitors, vouchers, accounting, portalSessions, connectProfiles, routers)
	profileService := service.NewProfileService(connectProfiles)
	userService := service.NewUserService(adminUsers)
	adService := service.NewAdvertisementService(advertisements)

	// Handlers
	authHandler := handler.NewAuthHandler(authService, cfg.JWT.CookieName, cfg.JWT.CookieSecure)
	portalHandler := handler.NewPortalHandler(portalService, cfg.Portal.AdDurationSeconds)
	voucherHandler := handler.NewVoucherHandler(voucherService)
	adminHandler := handler.NewAdminHandler(adminService)
	profileHandler := handler.NewProfileHandler(profileService)
	userHandler := handler.NewUserHandler(userService)
	adHandler := handler.NewAdvertisementHandler(adService)
	healthHandler := handler.NewHealthHandler(func(ctx context.Context) error {
		sqlDB, err := db.DB()
		if err != nil {
			return err
		}
		return sqlDB.PingContext(ctx)
	})

	engine := gin.New()
	engine.Use(middleware.Recovery(logger))
	engine.Use(middleware.RequestID())
	engine.Use(middleware.SecurityHeaders(cfg.IsProduction()))
	engine.Use(middleware.Logger(logger))
	engine.Use(middleware.CORS(cfg.Portal.AllowedLoginHosts))
	engine.SetHTMLTemplate(templates)
	engine.StaticFS("/static", http.FS(staticFS))
	engine.Static("/uploads", "./uploads")

	engine.GET("/health/live", healthHandler.Live)
	engine.GET("/health/ready", healthHandler.Ready)
	engine.GET("/portal", portalHandler.ShowPortalPage)
	engine.GET("/", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "/portal")
	})

	api := engine.Group("/api/v1")
	api.Use(middleware.RateLimit(120, 0))
	{
		api.POST("/portal-sessions", portalHandler.CreateSession)
		api.GET("/portal-sessions/:token", portalHandler.SessionStatus)
		api.POST("/portal-sessions/:token/survey", portalHandler.SubmitSurvey)
		api.POST("/portal-sessions/:token/connect", portalHandler.Connect)
	}

	admin := api.Group("/admin")
	{
		// Login is the most brute-forceable endpoint: cap it much tighter than
		// the general API limit (10 attempts / minute / IP).
		admin.POST("/auth/login", middleware.RateLimit(10, 0), authHandler.Login)
		admin.POST("/auth/logout", authHandler.Logout)
	}

	protected := admin.Group("")
	protected.Use(middleware.Auth(cfg.JWT.Secret, cfg.JWT.CookieName))
	{
		protected.GET("/auth/me", authHandler.Profile)
		protected.POST("/vouchers", voucherHandler.Create)
		protected.GET("/vouchers", voucherHandler.List)
		protected.GET("/visitors", adminHandler.ListVisitors)
		protected.GET("/sessions", adminHandler.ListSessions)
		protected.GET("/overview", adminHandler.Overview)
		protected.GET("/routers", adminHandler.ListRouters)
		protected.PUT("/routers/:id/voucher-config", adminHandler.UpdateRouterVoucherConfig)
		protected.GET("/profiles", profileHandler.List)
		protected.GET("/profiles/:id", profileHandler.Get)
		protected.POST("/profiles", profileHandler.Create)
		protected.PUT("/profiles/:id", profileHandler.Update)

		// Admin Users Management
		protected.GET("/users", userHandler.List)
		protected.GET("/users/:id", userHandler.Get)
		protected.POST("/users", userHandler.Create)
		protected.PUT("/users/:id", userHandler.Update)
		protected.PUT("/users/:id/password", userHandler.ChangePassword)
		protected.DELETE("/users/:id", userHandler.Delete)

		// Advertisements Management
		protected.GET("/advertisements", adHandler.List)
		protected.GET("/advertisements/:id", adHandler.Get)
		protected.POST("/advertisements", adHandler.Create)
		protected.POST("/advertisements/upload", adHandler.UploadImage)
		protected.PUT("/advertisements/:id", adHandler.Update)
		protected.DELETE("/advertisements/:id", adHandler.Delete)
	}

	adminIndexHTML, err := fs.ReadFile(staticFS, "admin/index.html")
	if err != nil {
		return nil, fmt.Errorf("read admin index html: %w", err)
	}

	adminSPA := func(c *gin.Context) {
		c.Data(http.StatusOK, "text/html; charset=utf-8", adminIndexHTML)
	}
	engine.GET("/admin", adminSPA)
	engine.GET("/admin/*path", adminSPA)

	return engine, nil
}
