package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"wifiads/internal/dto"
	"wifiads/internal/model"
	"wifiads/internal/repository"
	"wifiads/pkg/apperror"
	"wifiads/pkg/utils"
)

type voucherService struct {
	vouchers repository.VoucherRepository
	routers  repository.RouterRepository
	sites    repository.SiteRepository
	profiles repository.ConnectProfileRepository
	audits   repository.AuditLogRepository
	logger   *slog.Logger

	voucherKey            []byte
	usernamePrefix        string
	passwordLength        int
	defaultTTL            time.Duration
	defaultSessionTimeout int
}

// VoucherServiceOptions carries configuration into the voucher service.
type VoucherServiceOptions struct {
	VoucherKey            []byte
	UsernamePrefix        string
	PasswordLength        int
	DefaultTTL            time.Duration
	DefaultSessionTimeout int
}

// NewVoucherService builds the voucher service.
func NewVoucherService(
	vouchers repository.VoucherRepository,
	routers repository.RouterRepository,
	sites repository.SiteRepository,
	profiles repository.ConnectProfileRepository,
	audits repository.AuditLogRepository,
	logger *slog.Logger,
	opts VoucherServiceOptions,
) VoucherService {
	return &voucherService{
		vouchers:              vouchers,
		routers:               routers,
		sites:                 sites,
		profiles:              profiles,
		audits:                audits,
		logger:                logger,
		voucherKey:            opts.VoucherKey,
		usernamePrefix:        opts.UsernamePrefix,
		passwordLength:        opts.PasswordLength,
		defaultTTL:            opts.DefaultTTL,
		defaultSessionTimeout: opts.DefaultSessionTimeout,
	}
}

func (s *voucherService) CreateManual(ctx context.Context, actorID, actorName string, req dto.CreateVoucherRequest) (*dto.VoucherCreatedResponse, error) {
	router, err := s.resolveRouter(ctx, req.RouterID)
	if err != nil {
		return nil, err
	}

	ttl := s.defaultTTL
	sessionTimeout := s.defaultSessionTimeout

	var profileID *string
	var profileName string
	var bwDown int
	var bwUp int

	if req.ProfileID != "" && s.profiles != nil {
		prof, pErr := s.profiles.FindByID(ctx, req.ProfileID)
		if pErr == nil && prof != nil {
			id := prof.ID
			profileID = &id
			profileName = prof.DisplayName
			bwDown = prof.BandwidthDownKbps
			bwUp = prof.BandwidthUpKbps
			if prof.VoucherTTLSeconds > 0 {
				ttl = time.Duration(prof.VoucherTTLSeconds) * time.Second
			}
			if prof.SessionTimeoutSeconds > 0 {
				sessionTimeout = prof.SessionTimeoutSeconds
			}
		}
	}

	if req.TTLSeconds > 0 {
		ttl = time.Duration(req.TTLSeconds) * time.Second
	}
	if req.SessionTimeoutSeconds > 0 {
		sessionTimeout = req.SessionTimeoutSeconds
	}

	prefix := s.usernamePrefix
	if req.Prefix != "" {
		prefix = req.Prefix
	}
	digitCount := req.DigitCount
	if digitCount < 4 || digitCount > 16 {
		digitCount = 6
	}

	voucher, password, err := s.newVoucherCustom(ctx, router, ttl, sessionTimeout, actorName, req.Note, prefix, digitCount, req.NumericOnly, profileID, bwDown, bwUp)
	if err != nil {
		return nil, err
	}

	entry := &model.AuditLog{
		ID:         uuid.NewString(),
		ActorID:    actorID,
		ActorName:  actorName,
		Action:     "voucher.create",
		EntityType: "voucher",
		EntityID:   voucher.ID,
		Detail:     fmt.Sprintf("manual voucher %s for router %s (profile=%s)", voucher.Username, router.Name, profileName),
		CreatedAt:  time.Now().UTC(),
	}
	if auditErr := s.audits.Create(ctx, entry); auditErr != nil {
		s.logger.Warn("failed to write audit log", slog.String("error", auditErr.Error()))
	}

	response := toVoucherResponse(voucher)
	response.ProfileName = profileName
	return &dto.VoucherCreatedResponse{VoucherResponse: response, Password: password}, nil
}

func (s *voucherService) newVoucherCustom(
	ctx context.Context,
	router *model.Router,
	ttl time.Duration,
	sessionTimeout int,
	actorName, note, prefix string,
	digitCount int,
	numericOnly bool,
	profileID *string,
	bwDown, bwUp int,
) (*model.Voucher, string, error) {
	password, err := utils.GenerateVoucherPassword(s.passwordLength)
	if err != nil {
		return nil, "", err
	}
	cipher, err := utils.EncryptString(s.voucherKey, password)
	if err != nil {
		return nil, "", err
	}

	now := time.Now().UTC()
	for attempt := 0; attempt < 5; attempt++ {
		username, genErr := utils.GenerateCustomVoucherUsername(prefix, digitCount, numericOnly)
		if genErr != nil {
			return nil, "", genErr
		}
		voucher := &model.Voucher{
			Base: model.Base{
				ID:        uuid.NewString(),
				CreatedAt: now,
				UpdatedAt: now,
			},
			Username:              username,
			PasswordCiphertext:    cipher,
			Status:                model.VoucherStatusIssued,
			SiteID:                router.SiteID,
			RouterID:              router.ID,
			ProfileID:             profileID,
			BandwidthDownKbps:     bwDown,
			BandwidthUpKbps:       bwUp,
			CreatedBy:             actorName,
			Note:                  note,
			ExpiresAt:             now.Add(ttl),
			SessionTimeoutSeconds: sessionTimeout,
		}
		if createErr := s.vouchers.Create(ctx, voucher); createErr != nil {
			if errors.Is(createErr, apperror.ErrAlreadyExists) {
				continue
			}
			return nil, "", createErr
		}
		return voucher, password, nil
	}
	return nil, "", apperror.New(apperror.ErrConflict, "could not allocate a unique voucher username")
}

func (s *voucherService) resolveRouter(ctx context.Context, routerID string) (*model.Router, error) {
	if routerID != "" {
		return s.routers.FindByID(ctx, routerID)
	}
	routers, err := s.routers.ListActive(ctx)
	if err != nil {
		return nil, err
	}
	switch len(routers) {
	case 1:
		return &routers[0], nil
	case 0:
		return nil, apperror.New(apperror.ErrBadRequest, "no active router is registered")
	default:
		return nil, apperror.New(apperror.ErrBadRequest, "router_id is required when several routers are active")
	}
}

func (s *voucherService) newVoucher(ctx context.Context, router *model.Router, ttl time.Duration, sessionTimeout int, actorName, note string) (*model.Voucher, string, error) {
	password, err := utils.GenerateVoucherPassword(s.passwordLength)
	if err != nil {
		return nil, "", err
	}
	cipher, err := utils.EncryptString(s.voucherKey, password)
	if err != nil {
		return nil, "", err
	}

	now := time.Now().UTC()
	for attempt := 0; attempt < 5; attempt++ {
		username, genErr := utils.GenerateVoucherUsername(s.usernamePrefix)
		if genErr != nil {
			return nil, "", genErr
		}
		voucher := &model.Voucher{
			Base: model.Base{
				ID:        uuid.NewString(),
				CreatedAt: now,
				UpdatedAt: now,
			},
			Username:              username,
			PasswordCiphertext:    cipher,
			Status:                model.VoucherStatusIssued,
			SiteID:                router.SiteID,
			RouterID:              router.ID,
			CreatedBy:             actorName,
			Note:                  note,
			ExpiresAt:             now.Add(ttl),
			SessionTimeoutSeconds: sessionTimeout,
		}
		if createErr := s.vouchers.Create(ctx, voucher); createErr != nil {
			if errors.Is(createErr, apperror.ErrAlreadyExists) {
				continue
			}
			return nil, "", createErr
		}
		return voucher, password, nil
	}
	return nil, "", apperror.New(apperror.ErrConflict, "could not allocate a unique voucher username")
}

func (s *voucherService) List(ctx context.Context, query dto.VoucherListQuery) ([]dto.VoucherResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)

	items, total, err := s.vouchers.List(ctx, repository.VoucherFilter{
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

	profileMap := make(map[string]string)
	if s.profiles != nil {
		if pList, err := s.profiles.ListActive(ctx); err == nil {
			for _, p := range pList {
				profileMap[p.ID] = p.DisplayName
			}
		}
	}

	responses := make([]dto.VoucherResponse, 0, len(items))
	for i := range items {
		vRes := toVoucherResponse(&items[i])
		if items[i].ProfileID != nil {
			vRes.ProfileName = profileMap[*items[i].ProfileID]
		}
		responses = append(responses, vRes)
	}

	meta := dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}
	return responses, meta, nil
}

func toVoucherResponse(voucher *model.Voucher) dto.VoucherResponse {
	return dto.VoucherResponse{
		ID:                    voucher.ID,
		Username:              voucher.Username,
		Status:                voucher.Status,
		SiteID:                voucher.SiteID,
		RouterID:              voucher.RouterID,
		ProfileID:             voucher.ProfileID,
		BandwidthDownKbps:     voucher.BandwidthDownKbps,
		BandwidthUpKbps:       voucher.BandwidthUpKbps,
		PortalSessionID:       voucher.PortalSessionID,
		ExpectedMAC:           voucher.ExpectedMAC,
		CreatedBy:             voucher.CreatedBy,
		Note:                  voucher.Note,
		ExpiresAt:             voucher.ExpiresAt,
		SessionTimeoutSeconds: voucher.SessionTimeoutSeconds,
		UsedAt:                voucher.UsedAt,
		CreatedAt:             voucher.CreatedAt,
	}
}
