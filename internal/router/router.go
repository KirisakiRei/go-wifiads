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
	"wifiads/internal/radius"
	"wifiads/internal/repository"
	"wifiads/internal/service"
	"wifiads/pkg/storage"
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
	roles := repository.NewRoleRepository(db)
	sites := repository.NewSiteRepository(db)
	routers := repository.NewRouterRepository(db)
	nasClients := repository.NewNASClientRepository(db)
	advertisements := repository.NewAdvertisementRepository(db)
	portalSessions := repository.NewPortalSessionRepository(db)
	vouchers := repository.NewVoucherRepository(db)
	visitors := repository.NewWifiVisitorRepository(db)
	connectProfiles := repository.NewConnectProfileRepository(db)
	accounting := repository.NewAccountingRepository(db)
	audits := repository.NewAuditLogRepository(db)
	blockedDevices := repository.NewBlockedDeviceRepository(db)
	questionnaire := repository.NewQuestionnaireRepository(db)
	systemSettings := repository.NewSystemSettingRepository(db)
	marketplace := repository.NewMarketplaceRepository(db)
	partners := repository.NewPartnerRepository(db)
	partnerLeads := repository.NewPartnerLeadRepository(db)

	// Services
	authService := service.NewAuthService(adminUsers, logger, cfg.JWT.Secret, cfg.JWT.Issuer, cfg.JWTExpiry())
	voucherService := service.NewVoucherService(vouchers, routers, sites, connectProfiles, audits, logger, service.VoucherServiceOptions{
		VoucherKey:            cfg.Keys.VoucherKey,
		RadiusSecretKey:       cfg.Keys.RadiusSecretKey,
		Accounting:            accounting,
		NASClients:            nasClients,
		CoADisconnect:         radius.DisconnectSession,
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
		Marketplace:           marketplace,
		Partners:              partners,
		Accounting:            accounting,
		NASClients:            nasClients,
		BlockedDevices:        blockedDevices,
		Questionnaire:         questionnaire,
		RadiusSecretKey:       cfg.Keys.RadiusSecretKey,
		CoADisconnect:         radius.DisconnectSession,
	})
	adminService := service.NewAdminService(visitors, vouchers, accounting, portalSessions, connectProfiles, routers, service.AdminServiceOptions{
		NASClients:      nasClients,
		Sites:           sites,
		Marketplace:     marketplace,
		Partners:        partners,
		BlockedDevices:  blockedDevices,
		Audits:          audits,
		RadiusSecretKey: cfg.Keys.RadiusSecretKey,
		RadiusServerIP:  cfg.Radius.PublicIP,
		PortalBaseURL:   cfg.Portal.PublicBaseURL,
		CoADisconnect:   radius.DisconnectSession,
	})
	profileService := service.NewProfileService(connectProfiles)
	userService := service.NewUserService(adminUsers, roles)
	adService := service.NewAdvertisementService(advertisements)
	platformOpsService := service.NewPlatformOpsService(questionnaire, systemSettings, portalSessions, advertisements, routers, audits)
	marketplaceService := service.NewMarketplaceService(marketplace, routers, accounting, logger, cfg.JWT.Secret, cfg.JWT.Issuer, cfg.JWTExpiry())
	marketplaceService.SetPartnerRepository(partners)
	partnerService := service.NewPartnerService(partners, marketplace, routers, accounting, logger, cfg.JWT.Secret, cfg.JWT.Issuer, cfg.JWTExpiry())
	publicService := service.NewPublicService(partnerLeads, marketplace, partners, routers, systemSettings, audits, partnerService)

	r2Client := storage.NewR2Client(storage.R2Options{
		AccountID:       cfg.R2.AccountID,
		AccessKeyID:     cfg.R2.AccessKeyID,
		SecretAccessKey: cfg.R2.SecretAccessKey,
		BucketName:      cfg.R2.BucketName,
		PublicBaseURL:   cfg.R2.PublicURL,
	})

	// Handlers
	authHandler := handler.NewAuthHandler(authService, cfg.JWT.CookieName, cfg.JWT.CookieSecure)
	portalHandler := handler.NewPortalHandler(portalService, cfg.Portal.AdDurationSeconds)
	portalHandler.SetPlatformOps(platformOpsService)
	platformOpsHandler := handler.NewPlatformOpsHandler(platformOpsService)
	voucherHandler := handler.NewVoucherHandler(voucherService)
	adminHandler := handler.NewAdminHandler(adminService)
	profileHandler := handler.NewProfileHandler(profileService)
	userHandler := handler.NewUserHandler(userService)
	adHandler := handler.NewAdvertisementHandler(adService, r2Client)
	marketplaceHandler := handler.NewMarketplaceHandler(marketplaceService, r2Client, cfg.JWT.CookieSecure)
	partnerHandler := handler.NewPartnerHandler(partnerService, marketplaceHandler, cfg.JWT.CookieSecure)
	publicHandler := handler.NewPublicHandler(publicService)
	mapTileHandler := handler.NewMapTileHandler(cfg.Portal.PublicBaseURL)
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
	engine.GET("/uploads/*filepath", adHandler.ServeMedia)
	engine.HEAD("/uploads/*filepath", adHandler.ServeMedia)
	engine.GET("/map-tiles/:z/:x/:y", mapTileHandler.ServeTile)

	engine.GET("/health/live", healthHandler.Live)
	engine.GET("/health/ready", healthHandler.Ready)
	engine.GET("/portal", portalHandler.ShowPortalPage)

	api := engine.Group("/api/v1")
	api.Use(middleware.RateLimit(120, 0))
	{
		api.GET("/map-geocode", mapTileHandler.SearchPlace)
		api.POST("/map-resolve-link", mapTileHandler.ResolveGoogleMapsLink)
		api.POST("/portal-sessions", portalHandler.CreateSession)
		api.GET("/portal-sessions/active", middleware.RateLimit(30, 0), portalHandler.GetActiveSession)
		api.POST("/portal-sessions/disconnect", middleware.RateLimit(15, 0), portalHandler.DisconnectActiveSession)
		api.GET("/portal-sessions/:token", portalHandler.SessionStatus)
		api.POST("/portal-sessions/:token/survey", portalHandler.SubmitSurvey)
		api.POST("/portal-sessions/:token/connect", portalHandler.Connect)
		api.POST("/portal-sessions/:token/redeem", middleware.RateLimit(15, 0), portalHandler.RedeemVoucher)
		api.POST("/portal-sessions/:token/ad-metrics", middleware.RateLimit(30, 0), platformOpsHandler.RecordPortalAdMetrics)
		api.GET("/portal-sessions/:token/click", portalHandler.ClickPromo)
	}

	admin := api.Group("/admin")
	{
		// Login is the most brute-forceable endpoint: cap it much tighter than
		// the general API limit (10 attempts / minute / IP).
		admin.POST("/auth/login", middleware.RateLimit(10, 0), authHandler.Login)
		admin.POST("/auth/refresh", middleware.RateLimit(20, 0), authHandler.Refresh)
		admin.POST("/auth/logout", authHandler.Logout)
	}

	protected := admin.Group("")
	protected.Use(middleware.Auth(cfg.JWT.Secret, cfg.JWT.CookieName))
	{
		protected.GET("/auth/me", authHandler.Profile)
		protected.PUT("/auth/password", userHandler.ChangeOwnPassword)
		protected.POST("/vouchers", voucherHandler.Create)
		protected.GET("/vouchers", voucherHandler.List)
		protected.GET("/vouchers/summary", voucherHandler.Summary)
		protected.POST("/vouchers/batch", voucherHandler.CreateBatch)
		protected.GET("/vouchers/batches", voucherHandler.ListBatches)
		protected.PUT("/vouchers/:id/revoke", voucherHandler.Revoke)
		protected.GET("/visitors", adminHandler.ListVisitors)
		protected.POST("/visitors/:mac/block", adminHandler.BlockDevice)
		protected.DELETE("/visitors/:mac/block", adminHandler.UnblockDevice)
		protected.GET("/blocked-devices", adminHandler.ListBlockedDevices)
		protected.GET("/sessions", adminHandler.ListSessions)
		protected.POST("/sessions/:id/disconnect", adminHandler.DisconnectSession)
		protected.GET("/audit-logs", adminHandler.ListAuditLogs)
		protected.GET("/audit-logs/filters", adminHandler.AuditLogFilters)
		protected.DELETE("/audit-logs/cleanup", adminHandler.CleanupAuditLogs)

		// Dynamic Questionnaire & Portal/System Settings
		protected.GET("/questionnaire/fields", platformOpsHandler.ListQuestionnaireFields)
		protected.POST("/questionnaire/fields", platformOpsHandler.CreateQuestionnaireField)
		protected.PUT("/questionnaire/fields/reorder", platformOpsHandler.ReorderQuestionnaireFields)
		protected.PUT("/questionnaire/fields/:id", platformOpsHandler.UpdateQuestionnaireField)
		protected.DELETE("/questionnaire/fields/:id", platformOpsHandler.DeleteQuestionnaireField)
		protected.GET("/questionnaire/submissions", platformOpsHandler.ListQuestionnaireSubmissions)
		protected.GET("/questionnaire/submissions/export", platformOpsHandler.ExportQuestionnaireSubmissions)
		protected.GET("/settings", platformOpsHandler.ListSettings)
		protected.PUT("/settings", platformOpsHandler.BulkUpdateSettings)
		protected.GET("/overview", adminHandler.Overview)
		protected.GET("/routers", adminHandler.ListRouters)
		protected.POST("/routers", adminHandler.CreateRouter)
		protected.PUT("/routers/:id/voucher-config", adminHandler.UpdateRouterVoucherConfig)
		protected.DELETE("/routers/:id", adminHandler.DeleteRouter)
		protected.GET("/profiles", profileHandler.List)
		protected.GET("/profiles/:id", profileHandler.Get)
		protected.POST("/profiles", profileHandler.Create)
		protected.PUT("/profiles/:id", profileHandler.Update)
		protected.DELETE("/profiles/:id", profileHandler.Delete)

		// Admin Users & RBAC Roles Management
		protected.GET("/users", userHandler.List)
		protected.GET("/users/:id", userHandler.Get)
		protected.POST("/users", userHandler.Create)
		protected.PUT("/users/:id", userHandler.Update)
		protected.PUT("/users/:id/password", userHandler.ChangePassword)
		protected.DELETE("/users/:id", userHandler.Delete)

		protected.GET("/roles", userHandler.ListRoles)
		protected.POST("/roles", userHandler.CreateRole)
		protected.PUT("/roles/:id", userHandler.UpdateRole)
		protected.DELETE("/roles/:id", userHandler.DeleteRole)

		// Advertisements Management (Admin House Ads)
		protected.GET("/advertisements", adHandler.List)
		protected.GET("/advertisements/:id", adHandler.Get)
		protected.POST("/advertisements", adHandler.Create)
		protected.POST("/advertisements/upload", adHandler.UploadImage)
		protected.PUT("/advertisements/:id", adHandler.Update)
		protected.DELETE("/advertisements/:id", adHandler.Delete)

		// Marketplace, Finance & Partner Management
		protected.GET("/marketplace/badges", partnerHandler.AdminGetBadges)
		protected.GET("/marketplace/finance", partnerHandler.AdminGetFinanceSummary)
		protected.GET("/marketplace/wallet-transactions", partnerHandler.AdminListGlobalTransactions)
		protected.GET("/marketplace/settings", marketplaceHandler.AdminGetSetting)
		protected.PUT("/marketplace/settings", marketplaceHandler.AdminUpdateSetting)
		protected.GET("/marketplace/tiers", marketplaceHandler.AdminListLocationTiers)
		protected.POST("/marketplace/tiers", marketplaceHandler.AdminCreateLocationTier)
		protected.PUT("/marketplace/tiers/:id", marketplaceHandler.AdminUpdateLocationTier)
		protected.DELETE("/marketplace/tiers/:id", marketplaceHandler.AdminDeleteLocationTier)
		protected.GET("/marketplace/payment-methods", marketplaceHandler.AdminListPaymentMethods)
		protected.POST("/marketplace/payment-methods", marketplaceHandler.AdminCreatePaymentMethod)
		protected.PUT("/marketplace/payment-methods/:id", marketplaceHandler.AdminUpdatePaymentMethod)
		protected.DELETE("/marketplace/payment-methods/:id", marketplaceHandler.AdminDeletePaymentMethod)
		protected.POST("/marketplace/payment-methods/upload-qris", marketplaceHandler.AdminUploadQRIS)
		protected.GET("/marketplace/advertisers", marketplaceHandler.AdminListAdvertisers)
		protected.PUT("/marketplace/advertisers/:id/status", marketplaceHandler.AdminToggleAdvertiserStatus)
		protected.POST("/marketplace/advertisers/:id/adjust-balance", marketplaceHandler.AdminAdjustBalance)
		protected.GET("/marketplace/campaigns", marketplaceHandler.AdminListCampaigns)
		protected.PUT("/marketplace/campaigns/:id/moderate", marketplaceHandler.AdminModerateCampaign)
		protected.GET("/marketplace/topups", marketplaceHandler.AdminListTopups)
		protected.PUT("/marketplace/topups/:id/verify", marketplaceHandler.AdminVerifyTopup)

		protected.GET("/partners", partnerHandler.AdminListPartners)
		protected.POST("/partners", partnerHandler.AdminCreatePartner)
		protected.GET("/partners/:id", partnerHandler.AdminGetPartner)
		protected.PUT("/partners/:id", partnerHandler.AdminUpdatePartner)
		protected.POST("/partners/:id/regenerate-invite", partnerHandler.AdminRegeneratePartnerInvite)
		protected.PUT("/partners/:id/password", partnerHandler.AdminChangePartnerPassword)
		protected.DELETE("/partners/:id", partnerHandler.AdminDeletePartner)
		protected.GET("/partners/withdrawals", partnerHandler.AdminListWithdrawals)
		protected.PUT("/partners/withdrawals/:id/process", partnerHandler.AdminProcessWithdrawal)
		protected.POST("/partners/withdrawals/upload-proof", partnerHandler.AdminUploadPayoutProof)
		protected.GET("/partner-leads", publicHandler.AdminListPartnerLeads)
		protected.PUT("/partner-leads/:id/status", publicHandler.AdminUpdatePartnerLeadStatus)
		protected.POST("/partner-leads/:id/convert", publicHandler.AdminConvertPartnerLead)
	}

	// Public Acquisition Website API (/api/v1/public)
	pub := api.Group("/public")
	{
		pub.GET("/landing-data", middleware.RateLimit(60, 0), publicHandler.GetLandingData)
		pub.POST("/partner-leads", middleware.RateLimit(10, 0), publicHandler.SubmitPartnerLead)
	}

	// Advertiser Client API (/api/v1/advertiser)
	advPublic := api.Group("/advertiser")
	{
		advPublic.POST("/auth/register", middleware.RateLimit(10, 0), marketplaceHandler.Register)
		advPublic.POST("/auth/login", middleware.RateLimit(10, 0), marketplaceHandler.Login)
		advPublic.POST("/auth/logout", marketplaceHandler.Logout)
	}

	advProtected := advPublic.Group("")
	advProtected.Use(middleware.AdvertiserAuth(cfg.JWT.Secret, handler.AdvertiserCookieName))
	{
		advProtected.GET("/auth/me", marketplaceHandler.GetProfile)
		advProtected.PUT("/auth/profile", marketplaceHandler.UpdateProfile)
		advProtected.PUT("/auth/password", marketplaceHandler.ChangePassword)

		advProtected.GET("/config", marketplaceHandler.GetAdvertiserConfig)
		advProtected.GET("/routers/map", marketplaceHandler.ListMapRouters)
		advProtected.GET("/overview", marketplaceHandler.GetAdvertiserOverview)
		advProtected.GET("/analytics", marketplaceHandler.GetAdvertiserAnalytics)

		advProtected.POST("/media/upload", marketplaceHandler.UploadAdvertiserMedia)
		advProtected.GET("/campaigns", marketplaceHandler.ListAdvertiserCampaigns)
		advProtected.POST("/campaigns", marketplaceHandler.CreateCampaign)
		advProtected.GET("/campaigns/:id", marketplaceHandler.GetAdvertiserCampaign)
		advProtected.PUT("/campaigns/:id", marketplaceHandler.UpdateCampaign)
		advProtected.PUT("/campaigns/:id/status", marketplaceHandler.ToggleAdvertiserCampaignStatus)
		advProtected.DELETE("/campaigns/:id", marketplaceHandler.DeleteAdvertiserCampaign)

		advProtected.POST("/topups/upload-proof", marketplaceHandler.UploadTopupProofFile)
		advProtected.GET("/topups", marketplaceHandler.ListAdvertiserTopups)
		advProtected.POST("/topups", marketplaceHandler.CreateTopup)
		advProtected.PUT("/topups/:id/proof", marketplaceHandler.SubmitTopupProof)
		advProtected.GET("/wallet/transactions", marketplaceHandler.ListAdvertiserWalletTransactions)
	}

	// Partner Venue Owner API (/api/v1/partner)
	partnerPublic := api.Group("/partner")
	{
		partnerPublic.GET("/invite/:token", middleware.RateLimit(30, 0), partnerHandler.GetInviteInfo)
		partnerPublic.POST("/invite/:token/activate", middleware.RateLimit(15, 0), partnerHandler.ActivateInvite)
		partnerPublic.POST("/auth/login", middleware.RateLimit(10, 0), partnerHandler.Login)
		partnerPublic.POST("/auth/logout", partnerHandler.Logout)
	}

	partnerProtected := partnerPublic.Group("")
	partnerProtected.Use(middleware.PartnerAuth(cfg.JWT.Secret, handler.PartnerCookieName))
	{
		partnerProtected.GET("/auth/me", partnerHandler.GetProfile)
		partnerProtected.PUT("/auth/profile", partnerHandler.UpdateProfile)
		partnerProtected.PUT("/auth/password", partnerHandler.ChangePassword)

		partnerProtected.GET("/overview", partnerHandler.GetOverview)
		partnerProtected.GET("/ads", partnerHandler.ListAds)
		partnerProtected.GET("/routers", partnerHandler.ListRouters)
		partnerProtected.POST("/withdrawals", partnerHandler.CreateWithdrawal)
		partnerProtected.GET("/withdrawals", partnerHandler.ListWithdrawals)
		partnerProtected.GET("/wallet/transactions", partnerHandler.ListTransactions)
	}

	adminIndexHTML, err := fs.ReadFile(staticFS, "admin/index.html")
	if err != nil {
		return nil, fmt.Errorf("read admin index html: %w", err)
	}

	spaHandler := func(c *gin.Context) {
		c.Data(http.StatusOK, "text/html; charset=utf-8", adminIndexHTML)
	}
	// Public acquisition website routes (keep /portal dedicated to MikroTik Captive Portal).
	engine.GET("/", spaHandler)
	engine.GET("/mitra-info", spaHandler)
	engine.GET("/iklan-info", spaHandler)
	engine.GET("/daftar-mitra", spaHandler)
	engine.GET("/tentang", spaHandler)
	engine.GET("/kontak", spaHandler)
	engine.GET("/admin", spaHandler)
	engine.GET("/admin/*path", spaHandler)
	engine.GET("/advertiser", spaHandler)
	engine.GET("/advertiser/*path", spaHandler)
	engine.GET("/partner", spaHandler)
	engine.GET("/partner/*path", spaHandler)

	return engine, nil
}
