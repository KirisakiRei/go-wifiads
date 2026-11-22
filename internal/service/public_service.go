package service

import (
	"context"
	"encoding/json"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"

	"wifiads/internal/dto"
	"wifiads/internal/model"
	"wifiads/internal/repository"
	"wifiads/pkg/apperror"
	"wifiads/pkg/utils"
)

type PublicService interface {
	GetLandingData(ctx context.Context) (*dto.PublicLandingDataResponse, error)
	SubmitPartnerLead(ctx context.Context, req dto.SubmitPartnerLeadRequest) (*dto.PartnerLeadResponse, error)
	AdminListPartnerLeads(ctx context.Context, query dto.PartnerLeadListQuery) ([]dto.PartnerLeadResponse, dto.PaginationMeta, error)
	AdminUpdatePartnerLeadStatus(ctx context.Context, id string, req dto.UpdatePartnerLeadStatusRequest, actorID, actorName string) (*dto.PartnerLeadResponse, error)
	AdminConvertPartnerLead(ctx context.Context, id string, req dto.ConvertPartnerLeadRequest, actorID, actorName string) (*dto.ConvertPartnerLeadResponse, error)
}

type publicService struct {
	leads       repository.PartnerLeadRepository
	marketplace repository.MarketplaceRepository
	partners    repository.PartnerRepository
	routers     repository.RouterRepository
	settings    repository.SystemSettingRepository
	audits      repository.AuditLogRepository
	partnerSvc  PartnerService
}

func NewPublicService(
	leads repository.PartnerLeadRepository,
	marketplace repository.MarketplaceRepository,
	partners repository.PartnerRepository,
	routers repository.RouterRepository,
	settings repository.SystemSettingRepository,
	audits repository.AuditLogRepository,
	partnerSvc PartnerService,
) PublicService {
	return &publicService{
		leads:       leads,
		marketplace: marketplace,
		partners:    partners,
		routers:     routers,
		settings:    settings,
		audits:      audits,
		partnerSvc:  partnerSvc,
	}
}

func (s *publicService) GetLandingData(ctx context.Context) (*dto.PublicLandingDataResponse, error) {
	brandName := "AdWave WiFi"
	if s.settings != nil {
		if m, err := s.settings.GetMap(ctx); err == nil {
			if bn := strings.TrimSpace(m["portal.brand_name"]); bn != "" {
				brandName = bn
			}
		}
	}

	pricing := dto.PublicPricingInfo{
		BasePriceImageIDR:          50,
		BasePriceVideoIDR:          50,
		MaxAdDurationSeconds:       30,
		MinTopupAmountIDR:          50000,
		DefaultPartnerSharePercent: 20,
		MinWithdrawalAmountIDR:     50000,
	}
	if s.marketplace != nil {
		if ps, err := s.marketplace.GetPlatformSetting(ctx); err == nil && ps != nil {
			pricing = dto.PublicPricingInfo{
				BasePriceImageIDR:          ps.BasePriceImageIDR,
				BasePriceVideoIDR:          ps.BasePriceVideoIDR,
				MaxAdDurationSeconds:       ps.MaxAdDurationSeconds,
				MinTopupAmountIDR:          ps.MinTopupAmountIDR,
				DefaultPartnerSharePercent: ps.DefaultPartnerSharePercent,
				MinWithdrawalAmountIDR:     ps.MinWithdrawalAmountIDR,
			}
		}
	}

	var tierModels []model.LocationTier
	if s.marketplace != nil {
		tierModels, _ = s.marketplace.ListLocationTiers(ctx, true)
	}
	tierDTOs := make([]dto.LocationTierResponse, 0, len(tierModels))
	for _, t := range tierModels {
		tierDTOs = append(tierDTOs, dto.LocationTierResponse{
			ID:                  t.ID,
			Name:                t.Name,
			Multiplier:          t.Multiplier,
			MinDailyConnects:    t.MinDailyConnects,
			MinDailyImpressions: t.MinDailyImpressions,
			Description:         t.Description,
			SortOrder:           t.SortOrder,
			IsActive:            t.IsActive,
			CreatedAt:           t.CreatedAt,
			UpdatedAt:           t.UpdatedAt,
		})
	}

	activeRouters, err := s.routers.ListActive(ctx)
	if err != nil {
		return nil, err
	}
	allPartners, _ := s.partners.ListAllPartners(ctx)
	partnerMap := make(map[string]model.Partner, len(allPartners))
	for _, p := range allPartners {
		partnerMap[p.ID] = p
	}
	traffic7d, _ := s.partners.GetRouterTraffic7d(ctx, time.Now().UTC().AddDate(0, 0, -7))

	locations := make([]dto.PublicLocationItem, 0)
	catSet := make(map[string]struct{})
	for i := range activeRouters {
		r := activeRouters[i]
		if !r.IsPublicMarketplace {
			continue
		}
		venueName, address, category, lat, lng, _ := ResolveRouterPartnerDisplay(&r, partnerMap)
		tr := traffic7d[r.ID]
		avgConnects := computeAvg7d(tr.TotalConnects7d)
		avgImps := computeAvg7d(tr.TotalImpressions7d)
		_, tierName, mult := ResolveEffectiveRouterTier(&r, tierModels, avgConnects, avgImps)

		estViews := avgImps
		if avgConnects > estViews {
			estViews = avgConnects
		}
		if estViews < 20 {
			estViews = 20
		}
		imgPrice := int64(math.Round(float64(pricing.BasePriceImageIDR) * mult))
		vidPrice := int64(math.Round(float64(pricing.BasePriceVideoIDR) * mult))
		isOnline := r.LastSeenAt != nil && time.Since(*r.LastSeenAt) < 5*time.Minute
		catSet[strings.ToLower(strings.TrimSpace(category))] = struct{}{}

		locations = append(locations, dto.PublicLocationItem{
			ID:                  r.ID,
			VenueName:           venueName,
			VenueCategory:       category,
			Address:             address,
			Latitude:            lat,
			Longitude:           lng,
			TierName:            tierName,
			Multiplier:          mult,
			EstimatedDailyViews: estViews,
			ImagePriceIDR:       imgPrice,
			VideoPriceIDR:       vidPrice,
			IsConnected:         isOnline,
		})
	}

	return &dto.PublicLandingDataResponse{
		BrandName: brandName,
		Pricing:   pricing,
		Tiers:     tierDTOs,
		Stats: dto.PublicLandingStats{
			TotalPublicLocations: len(locations),
			TotalCategories:      len(catSet),
			TotalActiveRouters:   len(activeRouters),
		},
		Locations: locations,
	}, nil
}

func (s *publicService) SubmitPartnerLead(ctx context.Context, req dto.SubmitPartnerLeadRequest) (*dto.PartnerLeadResponse, error) {
	cat := strings.TrimSpace(req.Category)
	if cat == "" {
		cat = "Kafe"
	}
	lead := &model.PartnerLead{
		Base:                 model.Base{ID: uuid.NewString()},
		VenueName:            strings.TrimSpace(req.VenueName),
		Category:             cat,
		City:                 strings.TrimSpace(req.City),
		Address:              strings.TrimSpace(req.Address),
		Latitude:             req.Latitude,
		Longitude:            req.Longitude,
		DailyTrafficEstimate: req.DailyTrafficEstimate,
		ContactName:          strings.TrimSpace(req.ContactName),
		WhatsApp:             strings.TrimSpace(req.WhatsApp),
		Notes:                strings.TrimSpace(req.Notes),
		Status:               model.PartnerLeadStatusNew,
	}
	if err := s.leads.Create(ctx, lead); err != nil {
		return nil, err
	}
	res := toPartnerLeadDTO(lead, "")
	return &res, nil
}

func (s *publicService) AdminListPartnerLeads(ctx context.Context, query dto.PartnerLeadListQuery) ([]dto.PartnerLeadResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	items, total, err := s.leads.List(ctx, repository.PartnerLeadFilter{
		Page:    page,
		PerPage: perPage,
		Status:  query.Status,
		Search:  query.Search,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}

	partnerIDs := make([]string, 0)
	for _, l := range items {
		if l.ConvertedPartnerID != nil && *l.ConvertedPartnerID != "" {
			partnerIDs = append(partnerIDs, *l.ConvertedPartnerID)
		}
	}
	partnerMap := map[string]model.Partner{}
	if len(partnerIDs) > 0 && s.partners != nil {
		partnerMap, _ = s.partners.FindPartnersByIDs(ctx, partnerIDs)
	}

	out := make([]dto.PartnerLeadResponse, 0, len(items))
	for i := range items {
		inviteTok := ""
		if items[i].ConvertedPartnerID != nil {
			if p, ok := partnerMap[*items[i].ConvertedPartnerID]; ok && p.InviteToken != nil {
				inviteTok = *p.InviteToken
			}
		}
		out = append(out, toPartnerLeadDTO(&items[i], inviteTok))
	}
	meta := dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}
	return out, meta, nil
}

func (s *publicService) AdminUpdatePartnerLeadStatus(
	ctx context.Context,
	id string,
	req dto.UpdatePartnerLeadStatusRequest,
	actorID, actorName string,
) (*dto.PartnerLeadResponse, error) {
	lead, err := s.leads.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	lead.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	lead.AdminNote = strings.TrimSpace(req.AdminNote)
	if err := s.leads.Update(ctx, lead); err != nil {
		return nil, err
	}
	s.writeAudit(ctx, actorID, actorName, "UPDATE_PARTNER_LEAD", "partner_lead", lead.ID, map[string]any{
		"status":     lead.Status,
		"venue_name": lead.VenueName,
	})
	res := toPartnerLeadDTO(lead, "")
	return &res, nil
}

func (s *publicService) AdminConvertPartnerLead(
	ctx context.Context,
	id string,
	req dto.ConvertPartnerLeadRequest,
	actorID, actorName string,
) (*dto.ConvertPartnerLeadResponse, error) {
	lead, err := s.leads.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if lead.Status == model.PartnerLeadStatusConverted && lead.ConvertedPartnerID != nil && *lead.ConvertedPartnerID != "" {
		return nil, apperror.ErrAlreadyExists
	}

	partner, err := s.partnerSvc.AdminCreatePartnerInvite(ctx, dto.AdminCreatePartnerInviteRequest{
		VenueName:           lead.VenueName,
		RevenueSharePercent: req.RevenueSharePercent,
	})
	if err != nil {
		return nil, err
	}

	// Best-effort prefill partner contact/venue details so invite onboarding starts clean.
	if s.partners != nil {
		if pModel, findErr := s.partners.FindPartnerByID(ctx, partner.ID); findErr == nil && pModel != nil {
			if strings.TrimSpace(lead.Category) != "" {
				pModel.VenueCategory = lead.Category
			}
			if strings.TrimSpace(lead.Address) != "" {
				pModel.Address = lead.Address
			} else if strings.TrimSpace(lead.City) != "" {
				pModel.Address = lead.City
			}
			if strings.TrimSpace(lead.WhatsApp) != "" {
				pModel.Phone = lead.WhatsApp
			}
			if strings.TrimSpace(lead.ContactName) != "" {
				pModel.Name = lead.ContactName
			}
			if lead.Latitude != nil && lead.Longitude != nil {
				pModel.Latitude = lead.Latitude
				pModel.Longitude = lead.Longitude
			}
			_ = s.partners.UpdatePartner(ctx, pModel)
		}
	}

	pid := partner.ID
	lead.Status = model.PartnerLeadStatusConverted
	lead.ConvertedPartnerID = &pid
	if err := s.leads.Update(ctx, lead); err != nil {
		return nil, err
	}

	s.writeAudit(ctx, actorID, actorName, "CONVERT_PARTNER_LEAD", "partner_lead", lead.ID, map[string]any{
		"venue_name": lead.VenueName,
		"partner_id": partner.ID,
	})

	return &dto.ConvertPartnerLeadResponse{
		Lead:    toPartnerLeadDTO(lead, partner.InviteToken),
		Partner: *partner,
	}, nil
}

func (s *publicService) writeAudit(ctx context.Context, actorID, actorName, action, entityType, entityID string, detail any) {
	if s.audits == nil {
		return
	}
	raw, _ := json.Marshal(detail)
	_ = s.audits.Create(ctx, &model.AuditLog{
		ID:         uuid.NewString(),
		ActorID:    actorID,
		ActorName:  actorName,
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		Detail:     string(raw),
	})
}

func toPartnerLeadDTO(l *model.PartnerLead, inviteToken string) dto.PartnerLeadResponse {
	return dto.PartnerLeadResponse{
		ID:                   l.ID,
		VenueName:            l.VenueName,
		Category:             l.Category,
		City:                 l.City,
		Address:              l.Address,
		Latitude:             l.Latitude,
		Longitude:            l.Longitude,
		DailyTrafficEstimate: l.DailyTrafficEstimate,
		ContactName:          l.ContactName,
		WhatsApp:             l.WhatsApp,
		Notes:                l.Notes,
		AdminNote:            l.AdminNote,
		Status:               l.Status,
		ConvertedPartnerID:   l.ConvertedPartnerID,
		InviteToken:          inviteToken,
		CreatedAt:            l.CreatedAt,
		UpdatedAt:            l.UpdatedAt,
	}
}
