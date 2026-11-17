package service

import (
	"context"
	"time"

	"wifiads/internal/dto"
	"wifiads/internal/model"
	"wifiads/internal/repository"
	"wifiads/pkg/apperror"
	"wifiads/pkg/utils"
)

type adminService struct {
	visitors repository.WifiVisitorRepository
	vouchers repository.VoucherRepository
	accounts repository.AccountingRepository
	sessions repository.PortalSessionRepository
	profiles repository.ConnectProfileRepository
	routers  repository.RouterRepository
}

// NewAdminService builds the read-only dashboard service.
func NewAdminService(
	visitors repository.WifiVisitorRepository,
	vouchers repository.VoucherRepository,
	accounts repository.AccountingRepository,
	sessions repository.PortalSessionRepository,
	profiles repository.ConnectProfileRepository,
	routers repository.RouterRepository,
) AdminService {
	return &adminService{
		visitors: visitors,
		vouchers: vouchers,
		accounts: accounts,
		sessions: sessions,
		profiles: profiles,
		routers:  routers,
	}
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

	return &dto.OverviewResponse{
		ActiveDevices:  visitorCounts[model.VisitorStatusConnected],
		PendingDevices: visitorCounts[model.VisitorStatusPending],
		ActiveSessions: sessionCounts[model.AccountingSessionStatusActive],
		TotalVouchers:  totalVouchers,
		IssuedVouchers: voucherCounts[model.VoucherStatusIssued],
		ActiveVouchers: voucherCounts[model.VoucherStatusActive],
		UsedVouchers:   voucherCounts[model.VoucherStatusUsed],
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
			SessionTimeSeconds: visitor.SessionTimeSeconds,
			CreatedAt:          visitor.CreatedAt,
			SurveyEmail:        sess.SurveyEmail,
			SurveyPhone:        sess.SurveyPhone,
			SurveySkipped:      sess.SurveySkipped,
			ProfileName:        profName,
			InputOctets:        traffic.InputOctets,
			OutputOctets:       traffic.OutputOctets,
			VoucherExpiresAt:   voucherExpiresAt,
			VoucherStatus:      voucherStatus,
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
		Page:    page,
		PerPage: perPage,
		Search:  query.Search,
		Status:  query.Status,
		Order:   query.Order,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}

	responses := make([]dto.SessionResponse, 0, len(items))
	for i := range items {
		session := items[i]
		responses = append(responses, dto.SessionResponse{
			ID:                 session.ID,
			NASIdentifier:      session.NASIdentifier,
			AcctSessionID:      session.AcctSessionID,
			Username:           session.Username,
			CallingStationID:   session.CallingStationID,
			FramedIPAddress:    session.FramedIPAddress,
			Status:             session.Status,
			StartedAt:          session.StartedAt,
			LastAccountingAt:   session.LastAccountingAt,
			StoppedAt:          session.StoppedAt,
			SessionTimeSeconds: session.SessionTimeSeconds,
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
	responses := make([]dto.RouterResponse, 0, len(routers))
	for _, r := range routers {
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
		responses = append(responses, dto.RouterResponse{
			ID:                    r.ID,
			SiteID:                r.SiteID,
			Name:                  r.Name,
			NASIdentifier:         r.NASIdentifier,
			IPAddress:             r.IPAddress,
			Status:                r.Status,
			Description:           r.Description,
			VoucherPrefix:         prefix,
			VoucherDigitCount:     digits,
			VoucherNumericOnly:    r.VoucherNumericOnly,
			DefaultProfileID:      r.DefaultProfileID,
			SurveyProfileID:       r.SurveyProfileID,
			VoucherTTLSeconds:     ttl,
			SessionTimeoutSeconds: timeout,
		})
	}
	return responses, nil
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

	if err := s.routers.UpdateVoucherConfig(
		ctx,
		router.ID,
		req.VoucherPrefix,
		req.VoucherDigitCount,
		req.VoucherNumericOnly,
		req.DefaultProfileID,
		req.SurveyProfileID,
		req.VoucherTTLSeconds,
		req.SessionTimeoutSeconds,
	); err != nil {
		return nil, err
	}

	updated, err := s.routers.FindByID(ctx, routerID)
	if err != nil {
		return nil, err
	}

	return &dto.RouterResponse{
		ID:                    updated.ID,
		SiteID:                updated.SiteID,
		Name:                  updated.Name,
		NASIdentifier:         updated.NASIdentifier,
		IPAddress:             updated.IPAddress,
		Status:                updated.Status,
		Description:           updated.Description,
		VoucherPrefix:         updated.VoucherPrefix,
		VoucherDigitCount:     updated.VoucherDigitCount,
		VoucherNumericOnly:    updated.VoucherNumericOnly,
		DefaultProfileID:      updated.DefaultProfileID,
		SurveyProfileID:       updated.SurveyProfileID,
		VoucherTTLSeconds:     updated.VoucherTTLSeconds,
		SessionTimeoutSeconds: updated.SessionTimeoutSeconds,
	}, nil
}
