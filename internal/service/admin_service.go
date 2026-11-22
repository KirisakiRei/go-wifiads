package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"wifiads/internal/dto"
	"wifiads/internal/model"
	"wifiads/internal/repository"
	"wifiads/pkg/apperror"
	"wifiads/pkg/utils"
)

type adminService struct {
	visitors       repository.WifiVisitorRepository
	vouchers       repository.VoucherRepository
	accounts       repository.AccountingRepository
	sessions       repository.PortalSessionRepository
	profiles       repository.ConnectProfileRepository
	routers        repository.RouterRepository
	nasClients     repository.NASClientRepository
	sites          repository.SiteRepository
	marketplace    repository.MarketplaceRepository
	partners       repository.PartnerRepository
	blockedDevices repository.BlockedDeviceRepository
	audits         repository.AuditLogRepository

	radiusSecretKey []byte
	radiusServerIP  string
	portalBaseURL   string
	coaDisconnect   CoADisconnectFunc
}

// AdminServiceOptions holds optional dependencies for router, RADIUS & operations.
type AdminServiceOptions struct {
	NASClients      repository.NASClientRepository
	Sites           repository.SiteRepository
	Marketplace     repository.MarketplaceRepository
	Partners        repository.PartnerRepository
	BlockedDevices  repository.BlockedDeviceRepository
	Audits          repository.AuditLogRepository
	RadiusSecretKey []byte
	RadiusServerIP  string
	PortalBaseURL   string
	CoADisconnect   CoADisconnectFunc
}

// NewAdminService builds the dashboard and router provisioning service.
func NewAdminService(
	visitors repository.WifiVisitorRepository,
	vouchers repository.VoucherRepository,
	accounts repository.AccountingRepository,
	sessions repository.PortalSessionRepository,
	profiles repository.ConnectProfileRepository,
	routers repository.RouterRepository,
	opts ...AdminServiceOptions,
) AdminService {
	svc := &adminService{
		visitors: visitors,
		vouchers: vouchers,
		accounts: accounts,
		sessions: sessions,
		profiles: profiles,
		routers:  routers,
	}
	if len(opts) > 0 {
		svc.nasClients = opts[0].NASClients
		svc.sites = opts[0].Sites
		svc.marketplace = opts[0].Marketplace
		svc.partners = opts[0].Partners
		svc.blockedDevices = opts[0].BlockedDevices
		svc.audits = opts[0].Audits
		svc.radiusSecretKey = opts[0].RadiusSecretKey
		svc.radiusServerIP = opts[0].RadiusServerIP
		svc.portalBaseURL = opts[0].PortalBaseURL
		svc.coaDisconnect = opts[0].CoADisconnect
	}
	return svc
}

func (s *adminService) Overview(ctx context.Context) (*dto.OverviewResponse, error) {
	visitorCounts, err := s.visitors.CountByStatus(ctx)
	if err != nil {
		return nil, err
	}
	voucherCounts, err := s.vouchers.CountByStatus(ctx)
	if err != nil {
		return nil, err
	}
	sessionCounts, err := s.accounts.CountByStatus(ctx)
	if err != nil {
		return nil, err
	}

	var totalVouchers int64
	for _, total := range voucherCounts {
		totalVouchers += total
	}

	// Compute real time-series trends and traffic aggregates from recent visitors & accounting sessions
	loc, locErr := time.LoadLocation("Asia/Jakarta")
	if locErr != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	nowLocal := time.Now().In(loc)

	visitorsList, _, _ := s.visitors.List(ctx, repository.VisitorFilter{Page: 1, PerPage: 500, Order: "desc"})
	sessionsList, _, _ := s.accounts.ListSessions(ctx, repository.SessionFilter{Page: 1, PerPage: 500, Order: "desc"})

	var totalIn, totalOut int64
	for _, sess := range sessionsList {
		totalIn += sess.InputOctets
		totalOut += sess.OutputOctets
	}

	// 1. Trend Today: 8 buckets of 3 hours across today (00:00 .. 21:00 WIB)
	startOfDay := time.Date(nowLocal.Year(), nowLocal.Month(), nowLocal.Day(), 0, 0, 0, 0, loc)
	trendToday := make([]dto.ChartPoint, 8)
	hourLabels := []string{"00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"}
	for i := 0; i < 8; i++ {
		trendToday[i] = dto.ChartPoint{Label: hourLabels[i]}
	}
	var peakIdx int
	var peakCount int64
	for _, v := range visitorsList {
		tLocal := v.CreatedAt.In(loc)
		if !tLocal.Before(startOfDay) {
			bucket := tLocal.Hour() / 3
			if bucket >= 0 && bucket < 8 {
				trendToday[bucket].Impressions++
				if v.ConnectedAt != nil || v.Status == model.VisitorStatusConnected || v.Status == model.VisitorStatusClosed {
					trendToday[bucket].Logins++
				}
				if trendToday[bucket].Impressions > peakCount {
					peakCount = trendToday[bucket].Impressions
					peakIdx = bucket
				}
			}
		}
	}

	peakWindowLabel := "Belum ada lonjakan trafik hari ini"
	if peakCount > 0 {
		endHour := (peakIdx + 1) * 3
		if endHour > 24 {
			endHour = 24
		}
		peakWindowLabel = hourLabels[peakIdx] + " - " + time.Date(2000, 1, 1, endHour%24, 0, 0, 0, loc).Format("15:04") + " WIB"
	}

	// 2. Trend 7d: 7 daily buckets (last 7 days)
	trend7d := make([]dto.ChartPoint, 7)
	for i := 0; i < 7; i++ {
		day := startOfDay.AddDate(0, 0, -(6 - i))
		trend7d[i] = dto.ChartPoint{Label: day.Format("02 Jan")}
	}
	for _, v := range visitorsList {
		tLocal := v.CreatedAt.In(loc)
		dayStart := time.Date(tLocal.Year(), tLocal.Month(), tLocal.Day(), 0, 0, 0, 0, loc)
		diffDays := int(startOfDay.Sub(dayStart).Hours() / 24)
		if diffDays >= 0 && diffDays < 7 {
			idx := 6 - diffDays
			trend7d[idx].Impressions++
			if v.ConnectedAt != nil || v.Status == model.VisitorStatusConnected || v.Status == model.VisitorStatusClosed {
				trend7d[idx].Logins++
			}
		}
	}

	// 3. Trend 30d: 6 buckets of 5 days across the last 30 days
	trend30d := make([]dto.ChartPoint, 6)
	for i := 0; i < 6; i++ {
		bucketEnd := startOfDay.AddDate(0, 0, -((5 - i) * 5))
		trend30d[i] = dto.ChartPoint{Label: bucketEnd.Format("02 Jan")}
	}
	for _, v := range visitorsList {
		tLocal := v.CreatedAt.In(loc)
		dayStart := time.Date(tLocal.Year(), tLocal.Month(), tLocal.Day(), 0, 0, 0, 0, loc)
		diffDays := int(startOfDay.Sub(dayStart).Hours() / 24)
		if diffDays >= 0 && diffDays < 30 {
			idx := 5 - (diffDays / 5)
			if idx >= 0 && idx < 6 {
				trend30d[idx].Impressions++
				if v.ConnectedAt != nil || v.Status == model.VisitorStatusConnected || v.Status == model.VisitorStatusClosed {
					trend30d[idx].Logins++
				}
			}
		}
	}

	totalVisitors := int64(len(visitorsList))
	connectedVisitors := visitorCounts[model.VisitorStatusConnected] + visitorCounts[model.VisitorStatusClosed] + visitorCounts[model.VisitorStatusStale]
	loginSuccessRate := 100.0
	if totalVisitors > 0 {
		loginSuccessRate = float64(connectedVisitors) * 100.0 / float64(totalVisitors)
		if loginSuccessRate > 100 {
			loginSuccessRate = 100
		}
	}

	return &dto.OverviewResponse{
		ActiveDevices:        visitorCounts[model.VisitorStatusConnected],
		PendingDevices:       visitorCounts[model.VisitorStatusPending],
		ActiveSessions:       sessionCounts[model.AccountingSessionStatusActive],
		TotalVouchers:        totalVouchers,
		IssuedVouchers:       voucherCounts[model.VoucherStatusIssued],
		ActiveVouchers:       voucherCounts[model.VoucherStatusActive],
		UsedVouchers:         voucherCounts[model.VoucherStatusUsed],
		TotalInputOctets:     totalIn,
		TotalOutputOctets:    totalOut,
		AvgAdDurationSeconds: 10,
		LoginSuccessRate:     loginSuccessRate,
		PeakWindowLabel:      peakWindowLabel,
		TrendToday:           trendToday,
		Trend7d:              trend7d,
		Trend30d:             trend30d,
	}, nil
}

func (s *adminService) ListVisitors(ctx context.Context, query dto.VisitorListQuery) ([]dto.VisitorResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)

	items, total, err := s.visitors.List(ctx, repository.VisitorFilter{
		Page:    page,
		PerPage: perPage,
		Search:  query.Search,
		Status:  query.Status,
		Order:   query.Order,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}

	sessionIDs := make([]string, 0, len(items))
	for _, v := range items {
		if v.PortalSessionID != "" {
			sessionIDs = append(sessionIDs, v.PortalSessionID)
		}
	}
	sessionMap := make(map[string]model.PortalSession)
	if len(sessionIDs) > 0 && s.sessions != nil {
		if sessList, err := s.sessions.FindByIDs(ctx, sessionIDs); err == nil {
			for _, sess := range sessList {
				sessionMap[sess.ID] = sess
			}
		}
	}

	profileMap := make(map[string]string)
	if s.profiles != nil {
		if profList, err := s.profiles.ListActive(ctx); err == nil {
			for _, prof := range profList {
				profileMap[prof.ID] = prof.DisplayName
			}
		}
	}

	usernames := make([]string, 0, len(items))
	for _, v := range items {
		if v.Username != "" {
			usernames = append(usernames, v.Username)
		}
	}

	voucherMap := make(map[string]model.Voucher)
	if len(usernames) > 0 && s.vouchers != nil {
		if vList, err := s.vouchers.FindByUsernames(ctx, usernames); err == nil {
			for _, v := range vList {
				voucherMap[v.Username] = v
			}
		}
	}

	type TrafficStat struct {
		InputOctets  int64
		OutputOctets int64
	}
	trafficMap := make(map[string]TrafficStat)
	if len(usernames) > 0 && s.accounts != nil {
		if acctList, err := s.accounts.FindByUsernames(ctx, usernames); err == nil {
			for _, a := range acctList {
				curr := trafficMap[a.Username]
				curr.InputOctets += a.InputOctets
				curr.OutputOctets += a.OutputOctets
				trafficMap[a.Username] = curr
			}
		}
	}

	macs := make([]string, 0, len(items))
	for _, v := range items {
		if v.MAC != "" {
			macs = append(macs, v.MAC)
		}
	}
	blockedMap := make(map[string]model.BlockedDevice)
	if len(macs) > 0 && s.blockedDevices != nil {
		if bm, bErr := s.blockedDevices.FindBlockedMACs(ctx, macs); bErr == nil {
			blockedMap = bm
		}
	}

	responses := make([]dto.VisitorResponse, 0, len(items))
	for i := range items {
		visitor := items[i]
		sess := sessionMap[visitor.PortalSessionID]
		vouch, hasVoucher := voucherMap[visitor.Username]

		profName := ""
		if sess.ProfileID != nil {
			profName = profileMap[*sess.ProfileID]
		}
		if profName == "" && hasVoucher && vouch.ProfileID != nil {
			profName = profileMap[*vouch.ProfileID]
		}
		if profName == "" {
			profName = "Default Hotspot"
		}

		traffic := trafficMap[visitor.Username]

		var voucherExpiresAt *time.Time
		voucherStatus := ""
		if hasVoucher {
			exp := vouch.ExpiresAt
			voucherExpiresAt = &exp
			voucherStatus = vouch.Status
		}

		sessionSecs := visitor.SessionTimeSeconds
		if visitor.Status == model.VisitorStatusConnected && visitor.ConnectedAt != nil {
			liveSecs := int64(time.Since(*visitor.ConnectedAt).Seconds())
			if liveSecs > sessionSecs {
				sessionSecs = liveSecs
			}
		}

		blockedEntry, isBlocked := blockedMap[utils.NormalizeMAC(visitor.MAC)]

		responses = append(responses, dto.VisitorResponse{
			ID:                 visitor.ID,
			PortalSessionID:    visitor.PortalSessionID,
			SiteID:             visitor.SiteID,
			RouterID:           visitor.RouterID,
			MAC:                visitor.MAC,
			IP:                 visitor.IP,
			Username:           visitor.Username,
			Status:             visitor.Status,
			ConnectedAt:        visitor.ConnectedAt,
			DisconnectedAt:     visitor.DisconnectedAt,
			LastAccountingAt:   visitor.LastAccountingAt,
			SessionTimeSeconds: sessionSecs,
			CreatedAt:          visitor.CreatedAt,
			SurveyEmail:        sess.SurveyEmail,
			SurveyPhone:        sess.SurveyPhone,
			SurveySkipped:      sess.SurveySkipped,
			ProfileName:        profName,
			InputOctets:        traffic.InputOctets,
			OutputOctets:       traffic.OutputOctets,
			VoucherExpiresAt:   voucherExpiresAt,
			VoucherStatus:      voucherStatus,
			IsBlocked:          isBlocked,
			BlockReason:        blockedEntry.Reason,
		})
	}

	meta := dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}
	return responses, meta, nil
}

func (s *adminService) ListSessions(ctx context.Context, query dto.SessionListQuery) ([]dto.SessionResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)

	items, total, err := s.accounts.ListSessions(ctx, repository.SessionFilter{
		Page:     page,
		PerPage:  perPage,
		Search:   query.Search,
		Status:   query.Status,
		RouterID: query.RouterID,
		Order:    query.Order,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}

	routerNameByID := make(map[string]string)
	routerNameByNAS := make(map[string]string)
	if s.routers != nil {
		if rList, rErr := s.routers.ListActive(ctx); rErr == nil {
			for _, r := range rList {
				routerNameByID[r.ID] = r.Name
				routerNameByNAS[strings.ToLower(strings.TrimSpace(r.NASIdentifier))] = r.Name
			}
		}
	}

	responses := make([]dto.SessionResponse, 0, len(items))
	for i := range items {
		session := items[i]
		sessionSecs := session.SessionTimeSeconds
		if session.Status == model.AccountingSessionStatusActive && session.StartedAt != nil {
			liveSecs := int64(time.Since(*session.StartedAt).Seconds())
			if liveSecs > sessionSecs {
				sessionSecs = liveSecs
			}
		}
		routerName := ""
		if session.RouterID != nil {
			routerName = routerNameByID[*session.RouterID]
		}
		if routerName == "" {
			routerName = routerNameByNAS[strings.ToLower(strings.TrimSpace(session.NASIdentifier))]
		}
		responses = append(responses, dto.SessionResponse{
			ID:                 session.ID,
			RouterID:           session.RouterID,
			RouterName:         routerName,
			NASIdentifier:      session.NASIdentifier,
			AcctSessionID:      session.AcctSessionID,
			Username:           session.Username,
			CallingStationID:   session.CallingStationID,
			FramedIPAddress:    session.FramedIPAddress,
			Status:             session.Status,
			StartedAt:          session.StartedAt,
			LastAccountingAt:   session.LastAccountingAt,
			StoppedAt:          session.StoppedAt,
			SessionTimeSeconds: sessionSecs,
			InputOctets:        session.InputOctets,
			OutputOctets:       session.OutputOctets,
			TerminateCause:     session.TerminateCause,
			CreatedAt:          session.CreatedAt,
		})
	}

	meta := dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}
	return responses, meta, nil
}

func (s *adminService) ListRouters(ctx context.Context) ([]dto.RouterResponse, error) {
	if s.routers == nil {
		return nil, nil
	}
	routers, err := s.routers.ListActive(ctx)
	if err != nil {
		return nil, err
	}

	nasByRouterID := make(map[string]model.NASClient)
	nasByIdent := make(map[string]model.NASClient)
	if s.nasClients != nil {
		if list, nErr := s.nasClients.ListAll(ctx); nErr == nil {
			for _, item := range list {
				if item.RouterID != "" {
					nasByRouterID[item.RouterID] = item
				}
				if item.NASIdentifier != "" {
					nasByIdent[item.NASIdentifier] = item
				}
			}
		}
	}

	telemetryByNAS := make(map[string]repository.RouterAccountingStats)
	if s.accounts != nil {
		if agg, aErr := s.accounts.AggregateByNAS(ctx); aErr == nil {
			telemetryByNAS = agg
		}
	}

	var tiers []model.LocationTier
	if s.marketplace != nil {
		tiers, _ = s.marketplace.ListLocationTiers(ctx, false)
	}
	partnerMap := make(map[string]model.Partner)
	trafficMap := make(map[string]repository.RouterTrafficStat)
	if s.partners != nil {
		if pList, pErr := s.partners.ListAllPartners(ctx); pErr == nil {
			for _, p := range pList {
				partnerMap[p.ID] = p
			}
		}
		trafficMap, _ = s.partners.GetRouterTraffic7d(ctx, time.Now().UTC().AddDate(0, 0, -7))
	}

	responses := make([]dto.RouterResponse, 0, len(routers))
	for _, r := range routers {
		var nas *model.NASClient
		if item, ok := nasByRouterID[r.ID]; ok {
			nas = &item
		} else if item, ok := nasByIdent[r.NASIdentifier]; ok {
			nas = &item
		}
		tr := trafficMap[r.ID]
		avgConn := computeAvg7d(tr.TotalConnects7d)
		avgImp := computeAvg7d(tr.TotalImpressions7d)
		effTierID, effTierName, effMult := ResolveEffectiveRouterTier(&r, tiers, avgConn, avgImp)
		_, addr, cat, lat, lng, partnerPtr := ResolveRouterPartnerDisplay(&r, partnerMap)

		resp := s.buildRouterResponse(&r, nas, effTierID, effTierName, effMult, avgConn, avgImp, addr, cat, lat, lng, partnerPtr)
		lastSeen := r.LastSeenAt
		if stat, ok := telemetryByNAS[strings.ToLower(strings.TrimSpace(r.NASIdentifier))]; ok {
			if stat.LastSeenAt != nil && (lastSeen == nil || stat.LastSeenAt.After(*lastSeen)) {
				lastSeen = stat.LastSeenAt
			}
			resp.ActiveSessionsCount = stat.ActiveSessions
			resp.TotalSessionsCount = stat.TotalSessions
			resp.TotalInputOctets = stat.InputOctets
			resp.TotalOutputOctets = stat.OutputOctets
		}
		resp.LastSeenAt = lastSeen
		resp.IsConnected = lastSeen != nil
		resp.IsOnline = IsRouterOnline(lastSeen)
		responses = append(responses, resp)
	}
	return responses, nil
}

func (s *adminService) buildRouterResponse(
	r *model.Router,
	nas *model.NASClient,
	effTierID string,
	effTierName string,
	effMult float64,
	avgConn int64,
	avgImp int64,
	addr string,
	cat string,
	lat, lng *float64,
	partner *model.Partner,
) dto.RouterResponse {
	prefix := r.VoucherPrefix
	if prefix == "" {
		prefix = "MK1-"
	}
	digits := r.VoucherDigitCount
	if digits <= 0 {
		digits = 6
	}
	ttl := r.VoucherTTLSeconds
	if ttl <= 0 {
		ttl = 86400
	}
	timeout := r.SessionTimeoutSeconds
	if timeout <= 0 {
		timeout = 3600
	}

	nasIP := r.IPAddress
	radiusSecret := ""
	if nas != nil {
		if nas.IPAddress != "" {
			nasIP = nas.IPAddress
		}
		if len(s.radiusSecretKey) > 0 && nas.SecretCiphertext != "" {
			if plain, err := utils.DecryptString(s.radiusSecretKey, nas.SecretCiphertext); err == nil {
				radiusSecret = plain
			}
		}
	}

	tierIDPtr := r.LocationTierID
	if tierIDPtr == nil && effTierID != "" {
		idCopy := effTierID
		tierIDPtr = &idCopy
	}
	if effTierName == "" {
		effTierName = "Standard"
	}
	if effMult <= 0 {
		effMult = 1.0
	}
	if cat == "" {
		cat = "Kafe"
	}

	partnerName := ""
	partnerVenue := ""
	if partner != nil {
		partnerName = partner.Name
		partnerVenue = partner.VenueName
	}

	return dto.RouterResponse{
		ID:                    r.ID,
		SiteID:                r.SiteID,
		PartnerID:             r.PartnerID,
		PartnerName:           partnerName,
		PartnerVenueName:      partnerVenue,
		Name:                  r.Name,
		NASIdentifier:         r.NASIdentifier,
		IPAddress:             r.IPAddress,
		NASIPAddress:          nasIP,
		RadiusSecret:          radiusSecret,
		HeartbeatToken:        ComputeRouterHeartbeatToken(r.NASIdentifier, radiusSecret),
		RadiusServerIP:        s.radiusServerIP,
		PortalBaseURL:         s.portalBaseURL,
		Status:                r.Status,
		Description:           r.Description,
		Latitude:              lat,
		Longitude:             lng,
		LocationAddress:       addr,
		VenueCategory:         cat,
		LocationTierID:        tierIDPtr,
		LocationTierName:      effTierName,
		LocationMultiplier:    effMult,
		LocationTierAuto:      r.LocationTierAuto,
		AvgDailyConnects:      avgConn,
		AvgDailyImpressions:   avgImp,
		IsPublicMarketplace:   r.IsPublicMarketplace,
		VoucherPrefix:         prefix,
		VoucherDigitCount:     digits,
		VoucherNumericOnly:    r.VoucherNumericOnly,
		DefaultProfileID:      r.DefaultProfileID,
		SurveyProfileID:       r.SurveyProfileID,
		VoucherTTLSeconds:     ttl,
		SessionTimeoutSeconds: timeout,
	}
}

func (s *adminService) CreateRouter(
	ctx context.Context,
	actorID, actorName string,
	req dto.CreateRouterRequest,
) (*dto.RouterResponse, error) {
	if s.routers == nil || s.sites == nil {
		return nil, apperror.ErrInternalServer
	}
	site, err := s.sites.First(ctx)
	if err != nil {
		return nil, err
	}

	secret := strings.TrimSpace(req.RadiusSecret)
	if secret == "" {
		generated, gErr := utils.GenerateVoucherPassword(24)
		if gErr != nil {
			return nil, gErr
		}
		secret = generated
	}

	isPublic := true
	if req.IsPublicMarketplace != nil {
		isPublic = *req.IsPublicMarketplace
	}
	tierAuto := true
	if req.LocationTierAuto != nil {
		tierAuto = *req.LocationTierAuto
	}
	venueCat := strings.TrimSpace(req.VenueCategory)
	if venueCat == "" {
		venueCat = "Kafe"
	}
	lat := req.Latitude
	lng := req.Longitude
	addr := strings.TrimSpace(req.LocationAddress)

	var linkedPartner *model.Partner
	var cleanPartnerID *string
	if req.PartnerID != nil && strings.TrimSpace(*req.PartnerID) != "" {
		pid := strings.TrimSpace(*req.PartnerID)
		if s.partners != nil {
			if p, pErr := s.partners.FindPartnerByID(ctx, pid); pErr == nil && p != nil {
				linkedPartner = p
				cleanPartnerID = &p.ID
				if (lat == nil || lng == nil) && p.Latitude != nil && p.Longitude != nil {
					lat = p.Latitude
					lng = p.Longitude
				} else if lat != nil && lng != nil && (p.Latitude == nil || p.Longitude == nil) {
					p.Latitude = lat
					p.Longitude = lng
					if addr != "" && strings.TrimSpace(p.Address) == "" {
						p.Address = addr
					}
					_ = s.partners.UpdatePartner(ctx, p)
				}
				if addr == "" && strings.TrimSpace(p.Address) != "" {
					addr = strings.TrimSpace(p.Address)
				}
				if strings.TrimSpace(p.VenueCategory) != "" {
					venueCat = strings.TrimSpace(p.VenueCategory)
				}
			}
		} else {
			cleanPartnerID = &pid
		}
	}

	now := time.Now().UTC()
	router := &model.Router{
		Base: model.Base{
			ID:        uuid.NewString(),
			CreatedAt: now,
			UpdatedAt: now,
		},
		SiteID:                site.ID,
		PartnerID:             cleanPartnerID,
		Name:                  strings.TrimSpace(req.Name),
		NASIdentifier:         strings.TrimSpace(req.NASIdentifier),
		IPAddress:             strings.TrimSpace(req.IPAddress),
		Status:                model.RouterStatusActive,
		Description:           strings.TrimSpace(req.Description),
		Latitude:              lat,
		Longitude:             lng,
		LocationAddress:       addr,
		VenueCategory:         venueCat,
		LocationTierID:        req.LocationTierID,
		LocationTierAuto:      tierAuto,
		IsPublicMarketplace:   isPublic,
		VoucherPrefix:         "MK1-",
		VoucherDigitCount:     6,
		VoucherNumericOnly:    true,
		VoucherTTLSeconds:     86400,
		SessionTimeoutSeconds: 3600,
	}
	if err := s.routers.Create(ctx, router); err != nil {
		return nil, err
	}

	var nas *model.NASClient
	if s.nasClients != nil && len(s.radiusSecretKey) > 0 {
		cipher, cErr := utils.EncryptString(s.radiusSecretKey, secret)
		if cErr != nil {
			return nil, cErr
		}
		nasIP := strings.TrimSpace(req.NASIPAddress)
		if nasIP == "" {
			nasIP = "0.0.0.0"
		}
		nas = &model.NASClient{
			Base: model.Base{
				ID:        uuid.NewString(),
				CreatedAt: now,
				UpdatedAt: now,
			},
			RouterID:         router.ID,
			SiteID:           site.ID,
			Name:             router.Name,
			NASIdentifier:    router.NASIdentifier,
			IPAddress:        nasIP,
			SecretCiphertext: cipher,
			IsActive:         true,
		}
		if err := s.nasClients.UpsertForRouter(ctx, nas); err != nil {
			return nil, err
		}
	}

	var tiers []model.LocationTier
	if s.marketplace != nil {
		tiers, _ = s.marketplace.ListLocationTiers(ctx, false)
	}
	effTierID, effTierName, effMult := ResolveEffectiveRouterTier(router, tiers, 0, 0)
	res := s.buildRouterResponse(router, nas, effTierID, effTierName, effMult, 0, 0, router.LocationAddress, router.VenueCategory, router.Latitude, router.Longitude, linkedPartner)
	return &res, nil
}

func (s *adminService) UpdateRouterVoucherConfig(
	ctx context.Context,
	actorID, actorName, routerID string,
	req dto.UpdateRouterVoucherConfigRequest,
) (*dto.RouterResponse, error) {
	if s.routers == nil {
		return nil, apperror.ErrNotFound
	}
	router, err := s.routers.FindByID(ctx, routerID)
	if err != nil {
		return nil, err
	}

	ttlSeconds := req.VoucherTTLSeconds
	if ttlSeconds <= 0 {
		ttlSeconds = router.VoucherTTLSeconds
		if ttlSeconds <= 0 {
			ttlSeconds = 86400
		}
	}
	sessionTimeoutSeconds := req.SessionTimeoutSeconds
	if sessionTimeoutSeconds <= 0 {
		sessionTimeoutSeconds = router.SessionTimeoutSeconds
		if sessionTimeoutSeconds <= 0 {
			sessionTimeoutSeconds = 3600
		}
	}

	if err := s.routers.UpdateVoucherConfig(
		ctx,
		router.ID,
		req.VoucherPrefix,
		req.VoucherDigitCount,
		req.VoucherNumericOnly,
		req.DefaultProfileID,
		req.SurveyProfileID,
		ttlSeconds,
		sessionTimeoutSeconds,
	); err != nil {
		return nil, err
	}

	updated, err := s.routers.FindByID(ctx, routerID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	needRouterUpdate := false
	if name := strings.TrimSpace(req.Name); name != "" && name != updated.Name {
		updated.Name = name
		needRouterUpdate = true
	}
	if nasID := strings.TrimSpace(req.NASIdentifier); nasID != "" && nasID != updated.NASIdentifier {
		updated.NASIdentifier = nasID
		needRouterUpdate = true
	}
	if ip := strings.TrimSpace(req.IPAddress); ip != "" && ip != updated.IPAddress {
		updated.IPAddress = ip
		needRouterUpdate = true
	}
	if req.Latitude != nil {
		updated.Latitude = req.Latitude
		needRouterUpdate = true
	}
	if req.Longitude != nil {
		updated.Longitude = req.Longitude
		needRouterUpdate = true
	}
	if req.LocationAddress != nil {
		updated.LocationAddress = strings.TrimSpace(*req.LocationAddress)
		needRouterUpdate = true
	}
	if req.VenueCategory != nil {
		vc := strings.TrimSpace(*req.VenueCategory)
		if vc == "" {
			vc = "Kafe"
		}
		updated.VenueCategory = vc
		needRouterUpdate = true
	}
	if req.LocationTierID != nil && *req.LocationTierID != "" {
		updated.LocationTierID = req.LocationTierID
		needRouterUpdate = true
	}
	if req.LocationTierAuto != nil {
		updated.LocationTierAuto = *req.LocationTierAuto
		needRouterUpdate = true
	}
	if req.IsPublicMarketplace != nil {
		updated.IsPublicMarketplace = *req.IsPublicMarketplace
		needRouterUpdate = true
	}

	var linkedPartner *model.Partner
	if req.PartnerID != nil {
		pid := strings.TrimSpace(*req.PartnerID)
		if pid == "" {
			updated.PartnerID = nil
			needRouterUpdate = true
		} else {
			if s.partners != nil {
				if p, pErr := s.partners.FindPartnerByID(ctx, pid); pErr == nil && p != nil {
					linkedPartner = p
					updated.PartnerID = &p.ID
					if req.Latitude == nil && p.Latitude != nil && p.Longitude != nil {
						updated.Latitude = p.Latitude
						updated.Longitude = p.Longitude
					} else if req.Latitude != nil && req.Longitude != nil && (p.Latitude == nil || p.Longitude == nil) {
						p.Latitude = req.Latitude
						p.Longitude = req.Longitude
						if updated.LocationAddress != "" && strings.TrimSpace(p.Address) == "" {
							p.Address = updated.LocationAddress
						}
						_ = s.partners.UpdatePartner(ctx, p)
					}
					if updated.LocationAddress == "" && strings.TrimSpace(p.Address) != "" {
						updated.LocationAddress = strings.TrimSpace(p.Address)
					}
					if req.VenueCategory == nil && strings.TrimSpace(p.VenueCategory) != "" {
						updated.VenueCategory = strings.TrimSpace(p.VenueCategory)
					}
					needRouterUpdate = true
				}
			} else {
				updated.PartnerID = &pid
				needRouterUpdate = true
			}
		}
	} else if updated.PartnerID != nil && s.partners != nil {
		linkedPartner, _ = s.partners.FindPartnerByID(ctx, *updated.PartnerID)
	}

	if needRouterUpdate {
		updated.UpdatedAt = now
		if err := s.routers.Update(ctx, updated); err != nil {
			return nil, err
		}
	}

	var nas *model.NASClient
	if s.nasClients != nil {
		existingNAS, nErr := s.nasClients.FindByRouterID(ctx, updated.ID)
		if nErr != nil {
			existingNAS, _ = s.nasClients.FindByNASIdentifier(ctx, updated.NASIdentifier)
		}
		if existingNAS == nil {
			existingNAS = &model.NASClient{
				Base: model.Base{
					ID:        uuid.NewString(),
					CreatedAt: now,
				},
				RouterID: updated.ID,
				SiteID:   updated.SiteID,
				IsActive: true,
			}
		}
		existingNAS.RouterID = updated.ID
		existingNAS.SiteID = updated.SiteID
		existingNAS.Name = updated.Name
		existingNAS.NASIdentifier = updated.NASIdentifier
		existingNAS.IsActive = true
		existingNAS.UpdatedAt = now

		if nasIP := strings.TrimSpace(req.NASIPAddress); nasIP != "" {
			existingNAS.IPAddress = nasIP
		} else if existingNAS.IPAddress == "" {
			existingNAS.IPAddress = updated.IPAddress
		}
		if secret := strings.TrimSpace(req.RadiusSecret); secret != "" && len(s.radiusSecretKey) > 0 {
			cipher, cErr := utils.EncryptString(s.radiusSecretKey, secret)
			if cErr != nil {
				return nil, cErr
			}
			existingNAS.SecretCiphertext = cipher
		}
		if existingNAS.SecretCiphertext != "" {
			if err := s.nasClients.UpsertForRouter(ctx, existingNAS); err != nil {
				return nil, err
			}
		}
		nas = existingNAS
	}

	var tiers []model.LocationTier
	if s.marketplace != nil {
		tiers, _ = s.marketplace.ListLocationTiers(ctx, false)
	}
	var avgConn, avgImp int64
	if s.partners != nil {
		if trMap, tErr := s.partners.GetRouterTraffic7d(ctx, time.Now().UTC().AddDate(0, 0, -7)); tErr == nil {
			tr := trMap[updated.ID]
			avgConn = computeAvg7d(tr.TotalConnects7d)
			avgImp = computeAvg7d(tr.TotalImpressions7d)
		}
	}
	effTierID, effTierName, effMult := ResolveEffectiveRouterTier(updated, tiers, avgConn, avgImp)
	res := s.buildRouterResponse(updated, nas, effTierID, effTierName, effMult, avgConn, avgImp, updated.LocationAddress, updated.VenueCategory, updated.Latitude, updated.Longitude, linkedPartner)
	return &res, nil
}

func (s *adminService) recordAudit(ctx context.Context, actorID, actorName, action, entityType, entityID string, payload map[string]any) {
	if s.audits == nil {
		return
	}
	raw, _ := json.Marshal(payload)
	if len(raw) == 0 {
		raw = []byte("{}")
	}
	// Best-effort audit write; operational mutation already succeeded.
	_ = s.audits.Create(ctx, &model.AuditLog{
		ID:         uuid.NewString(),
		ActorID:    strings.TrimSpace(actorID),
		ActorName:  actorName,
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		Detail:     string(raw),
		CreatedAt:  time.Now().UTC(),
	})
}

func (s *adminService) DisconnectSession(ctx context.Context, actorID, actorName, sessionID string) (*dto.DisconnectSessionResponse, error) {
	if s.accounts == nil {
		return nil, apperror.ErrInternalServer
	}
	sess, err := s.accounts.FindByID(ctx, strings.TrimSpace(sessionID))
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	voucherRevoked := false
	if s.vouchers != nil {
		if sess.VoucherID != nil && *sess.VoucherID != "" {
			if vErr := s.vouchers.UpdateStatus(ctx, *sess.VoucherID, model.VoucherStatusRevoked); vErr == nil {
				voucherRevoked = true
			}
		} else if sess.Username != "" {
			if v, vErr := s.vouchers.FindByUsername(ctx, sess.Username); vErr == nil && v != nil {
				if uErr := s.vouchers.UpdateStatus(ctx, v.ID, model.VoucherStatusRevoked); uErr == nil {
					voucherRevoked = true
				}
			}
		}
	}

	coaSent := false
	if s.coaDisconnect != nil && s.nasClients != nil && len(s.radiusSecretKey) > 0 {
		var nas *model.NASClient
		if sess.RouterID != nil && *sess.RouterID != "" {
			nas, _ = s.nasClients.FindByRouterID(ctx, *sess.RouterID)
		}
		if nas == nil && sess.NASIdentifier != "" {
			nas, _ = s.nasClients.FindByNASIdentifier(ctx, sess.NASIdentifier)
		}
		if nas != nil && strings.TrimSpace(nas.IPAddress) != "" && nas.SecretCiphertext != "" {
			if secret, decErr := utils.DecryptString(s.radiusSecretKey, nas.SecretCiphertext); decErr == nil && secret != "" {
				if dErr := s.coaDisconnect(ctx, nas.IPAddress, secret, sess.AcctSessionID, sess.Username, sess.FramedIPAddress, sess.CallingStationID); dErr == nil {
					coaSent = true
				}
			}
		}
	}

	resultStatus := sess.Status
	msg := "Voucher dicabut, namun router tidak merespons CoA port 3799"
	if coaSent {
		if cErr := s.accounts.CloseByID(ctx, sess.ID, now, "Admin-Reset"); cErr == nil {
			resultStatus = model.AccountingSessionStatusClosed
		}
		if s.visitors != nil && sess.Username != "" {
			_ = s.visitors.MarkDisconnected(ctx, sess.Username, now, sess.SessionTimeSeconds)
		}
		msg = "Sesi berhasil diputus langsung melalui CoA MikroTik"
	}

	s.recordAudit(ctx, actorID, actorName, "session.disconnect", "accounting_session", sess.ID, map[string]any{
		"username":        sess.Username,
		"mac":             sess.CallingStationID,
		"nas_identifier":  sess.NASIdentifier,
		"coa_sent":        coaSent,
		"voucher_revoked": voucherRevoked,
	})

	return &dto.DisconnectSessionResponse{
		SessionID:      sess.ID,
		Status:         resultStatus,
		CoASent:        coaSent,
		VoucherRevoked: voucherRevoked,
		Message:        msg,
	}, nil
}

func (s *adminService) DeleteRouter(ctx context.Context, actorID, actorName, routerID string) error {
	if s.routers == nil {
		return apperror.ErrInternalServer
	}
	id := strings.TrimSpace(routerID)
	router, err := s.routers.FindByID(ctx, id)
	if err != nil {
		return err
	}
	activeCampaigns, err := s.routers.CountActiveCampaigns(ctx, router.ID)
	if err != nil {
		return err
	}
	if activeCampaigns > 0 {
		return apperror.New(apperror.ErrConflict, "Router masih terikat pada kampanye iklan aktif. Hentikan kampanye terlebih dahulu.")
	}
	if err := s.routers.SoftDelete(ctx, router.ID); err != nil {
		return err
	}
	if s.nasClients != nil {
		_ = s.nasClients.DeactivateByRouterID(ctx, router.ID)
	}
	s.recordAudit(ctx, actorID, actorName, "router.delete", "router", router.ID, map[string]any{
		"name":           router.Name,
		"nas_identifier": router.NASIdentifier,
	})
	return nil
}

func (s *adminService) BlockDevice(ctx context.Context, actorID, actorName, mac string, req dto.BlockDeviceRequest) (*dto.BlockedDeviceResponse, error) {
	if s.blockedDevices == nil {
		return nil, apperror.ErrInternalServer
	}
	normMAC := utils.NormalizeMAC(mac)
	if normMAC == "" {
		return nil, apperror.New(apperror.ErrBadRequest, "MAC address tidak valid")
	}
	var rid *string
	if req.RouterID != nil && strings.TrimSpace(*req.RouterID) != "" {
		v := strings.TrimSpace(*req.RouterID)
		rid = &v
	}
	now := time.Now().UTC()
	entry := &model.BlockedDevice{
		ID:        uuid.NewString(),
		MAC:       normMAC,
		RouterID:  rid,
		Reason:    strings.TrimSpace(req.Reason),
		BlockedBy: actorName,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.blockedDevices.Block(ctx, entry); err != nil {
		return nil, err
	}

	disconnect := true
	if req.DisconnectActive != nil {
		disconnect = *req.DisconnectActive
	}
	if disconnect && s.accounts != nil {
		targetRouter := ""
		if rid != nil {
			targetRouter = *rid
		}
		if activeSess, err := s.accounts.FindActiveByMAC(ctx, normMAC, targetRouter); err == nil && activeSess != nil {
			_, _ = s.DisconnectSession(ctx, actorID, actorName, activeSess.ID)
		}
	}

	routerName := ""
	if rid != nil && s.routers != nil {
		if r, rErr := s.routers.FindByID(ctx, *rid); rErr == nil && r != nil {
			routerName = r.Name
		}
	}

	s.recordAudit(ctx, actorID, actorName, "visitor.block", "blocked_device", entry.ID, map[string]any{
		"mac":       normMAC,
		"router_id": rid,
		"reason":    entry.Reason,
	})

	return &dto.BlockedDeviceResponse{
		ID:         entry.ID,
		MAC:        entry.MAC,
		RouterID:   entry.RouterID,
		RouterName: routerName,
		Reason:     entry.Reason,
		BlockedBy:  entry.BlockedBy,
		CreatedAt:  entry.CreatedAt,
	}, nil
}

func (s *adminService) UnblockDevice(ctx context.Context, actorID, actorName, mac, routerID string) error {
	if s.blockedDevices == nil {
		return apperror.ErrInternalServer
	}
	normMAC := utils.NormalizeMAC(mac)
	if normMAC == "" {
		return apperror.New(apperror.ErrBadRequest, "MAC address tidak valid")
	}
	affected, err := s.blockedDevices.UnblockByMAC(ctx, normMAC, routerID)
	if err != nil {
		return err
	}
	if affected == 0 {
		return apperror.New(apperror.ErrNotFound, "Perangkat tidak ditemukan di daftar blokir")
	}
	s.recordAudit(ctx, actorID, actorName, "visitor.unblock", "blocked_device", normMAC, map[string]any{
		"mac":       normMAC,
		"router_id": routerID,
	})
	return nil
}

func (s *adminService) ListBlockedDevices(ctx context.Context, query dto.BlockedDeviceListQuery) ([]dto.BlockedDeviceResponse, dto.PaginationMeta, error) {
	if s.blockedDevices == nil {
		return []dto.BlockedDeviceResponse{}, dto.PaginationMeta{CurrentPage: 1, PerPage: 20}, nil
	}
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	items, total, err := s.blockedDevices.List(ctx, repository.BlockedDeviceFilter{
		Page:     page,
		PerPage:  perPage,
		Search:   query.Search,
		RouterID: query.RouterID,
		Order:    query.Order,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}
	routerMap := make(map[string]string)
	if s.routers != nil {
		if rList, rErr := s.routers.ListActive(ctx); rErr == nil {
			for _, r := range rList {
				routerMap[r.ID] = r.Name
			}
		}
	}
	out := make([]dto.BlockedDeviceResponse, 0, len(items))
	for _, item := range items {
		rName := ""
		if item.RouterID != nil {
			rName = routerMap[*item.RouterID]
		}
		out = append(out, dto.BlockedDeviceResponse{
			ID:         item.ID,
			MAC:        item.MAC,
			RouterID:   item.RouterID,
			RouterName: rName,
			Reason:     item.Reason,
			BlockedBy:  item.BlockedBy,
			CreatedAt:  item.CreatedAt,
		})
	}
	return out, dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}, nil
}

// suppress unused errors import check if needed
var _ = errors.Is

func (s *adminService) ListAuditLogs(ctx context.Context, query dto.AuditLogListQuery) ([]dto.AuditLogResponse, dto.PaginationMeta, error) {
	if s.audits == nil {
		return []dto.AuditLogResponse{}, dto.PaginationMeta{CurrentPage: 1, PerPage: 20}, nil
	}
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	var fromPtr, toPtr *time.Time
	if v := strings.TrimSpace(query.DateFrom); v != "" {
		if parsed, err := time.Parse("2006-01-02", v); err == nil {
			fromPtr = &parsed
		}
	}
	if v := strings.TrimSpace(query.DateTo); v != "" {
		if parsed, err := time.Parse("2006-01-02", v); err == nil {
			end := parsed.Add(24*time.Hour - time.Second)
			toPtr = &end
		}
	}
	items, total, err := s.audits.List(ctx, repository.AuditLogFilter{
		Page:       page,
		PerPage:    perPage,
		Action:     query.Action,
		EntityType: query.EntityType,
		ActorName:  query.ActorName,
		Search:     query.Search,
		DateFrom:   fromPtr,
		DateTo:     toPtr,
		Order:      query.Order,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}
	out := make([]dto.AuditLogResponse, 0, len(items))
	for _, it := range items {
		out = append(out, dto.AuditLogResponse{
			ID:         it.ID,
			ActorID:    it.ActorID,
			ActorName:  it.ActorName,
			Action:     it.Action,
			EntityType: it.EntityType,
			EntityID:   it.EntityID,
			Detail:     it.Detail,
			IPAddress:  it.IPAddress,
			CreatedAt:  it.CreatedAt,
		})
	}
	return out, dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}, nil
}

func (s *adminService) AuditLogFilters(ctx context.Context) (*dto.AuditLogFiltersResponse, error) {
	if s.audits == nil {
		return &dto.AuditLogFiltersResponse{Actions: []string{}, EntityTypes: []string{}}, nil
	}
	actions, entities, err := s.audits.DistinctFilters(ctx)
	if err != nil {
		return nil, err
	}
	if actions == nil {
		actions = []string{}
	}
	if entities == nil {
		entities = []string{}
	}
	return &dto.AuditLogFiltersResponse{Actions: actions, EntityTypes: entities}, nil
}

func (s *adminService) CleanupAuditLogs(ctx context.Context, actorID, actorName, actorRole string, days int) (*dto.AuditCleanupResponse, error) {
	if actorRole != "super_admin" && actorRole != "admin" {
		return nil, apperror.New(apperror.ErrForbidden, "Hanya super_admin yang dapat membersihkan log sistem")
	}
	if s.audits == nil {
		return nil, apperror.ErrInternalServer
	}
	if days < 7 {
		days = 90
	}
	cutoff := time.Now().UTC().AddDate(0, 0, -days)
	deleted, err := s.audits.CleanupOlderThan(ctx, cutoff)
	if err != nil {
		return nil, err
	}
	s.recordAudit(ctx, actorID, actorName, "audit_logs.cleanup", "audit_log", "", map[string]any{
		"days":    days,
		"deleted": deleted,
	})
	return &dto.AuditCleanupResponse{Days: days, Deleted: deleted}, nil
}

// RouterOnlineWindow defines how long a router remains marked Online after its last
// RADIUS packet or verified MikroTik scheduler heartbeat (2m interval with 6m grace).
const RouterOnlineWindow = 6 * time.Minute

// IsRouterOnline reports whether lastSeen falls within RouterOnlineWindow.
func IsRouterOnline(lastSeen *time.Time) bool {
	return lastSeen != nil && time.Since(*lastSeen) < RouterOnlineWindow
}

// ComputeRouterHeartbeatToken derives a deterministic 128-bit HMAC token for
// RouterOS /tool fetch HTTP heartbeat without exposing the raw RADIUS secret.
func ComputeRouterHeartbeatToken(nasIdentifier, secret string) string {
	nasID := strings.TrimSpace(nasIdentifier)
	if nasID == "" || secret == "" {
		return ""
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte("wifiads-heartbeat:" + nasID))
	return hex.EncodeToString(mac.Sum(nil))[:32]
}

// RecordRouterHeartbeat verifies either the router's raw secret (HTTPS POST) or its
// derived HMAC heartbeat token (HTTP GET for legacy RouterOS 5.x) and updates last_seen_at.
func (s *adminService) RecordRouterHeartbeat(ctx context.Context, nasIdentifier, credential string) (time.Time, error) {
	nasID := strings.TrimSpace(nasIdentifier)
	cred := strings.TrimSpace(credential)
	if nasID == "" || cred == "" {
		return time.Time{}, apperror.New(apperror.ErrUnauthorized, "invalid router heartbeat credentials")
	}
	if s.nasClients == nil || s.routers == nil {
		return time.Time{}, apperror.ErrInternalServer
	}
	nas, err := s.nasClients.FindByNASIdentifier(ctx, nasID)
	if err != nil || nas == nil || !nas.IsActive {
		return time.Time{}, apperror.New(apperror.ErrUnauthorized, "unknown or inactive NAS identifier")
	}
	expectedSecret, err := utils.DecryptString(s.radiusSecretKey, nas.SecretCiphertext)
	if err != nil || expectedSecret == "" {
		return time.Time{}, apperror.New(apperror.ErrUnauthorized, "invalid router secret")
	}
	expectedToken := ComputeRouterHeartbeatToken(nas.NASIdentifier, expectedSecret)
	secretMatch := len(cred) == len(expectedSecret) && subtle.ConstantTimeCompare([]byte(expectedSecret), []byte(cred)) == 1
	tokenMatch := expectedToken != "" && len(cred) == len(expectedToken) && subtle.ConstantTimeCompare([]byte(expectedToken), []byte(cred)) == 1
	if !secretMatch && !tokenMatch {
		return time.Time{}, apperror.New(apperror.ErrUnauthorized, "invalid router secret")
	}
	now := time.Now().UTC()
	if err := s.routers.TouchLastSeenByNAS(ctx, nas.NASIdentifier, now); err != nil {
		return time.Time{}, err
	}
	return now, nil
}
