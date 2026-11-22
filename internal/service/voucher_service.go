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
	vouchers   repository.VoucherRepository
	routers    repository.RouterRepository
	sites      repository.SiteRepository
	profiles   repository.ConnectProfileRepository
	audits     repository.AuditLogRepository
	accounts   repository.AccountingRepository
	nasClients repository.NASClientRepository
	logger     *slog.Logger

	voucherKey            []byte
	radiusSecretKey       []byte
	coaDisconnect         CoADisconnectFunc
	usernamePrefix        string
	passwordLength        int
	defaultTTL            time.Duration
	defaultSessionTimeout int
}

// VoucherServiceOptions carries configuration into the voucher service.
type VoucherServiceOptions struct {
	VoucherKey            []byte
	RadiusSecretKey       []byte
	Accounting            repository.AccountingRepository
	NASClients            repository.NASClientRepository
	CoADisconnect         CoADisconnectFunc
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
		accounts:              opts.Accounting,
		nasClients:            opts.NASClients,
		logger:                logger,
		voucherKey:            opts.VoucherKey,
		radiusSecretKey:       opts.RadiusSecretKey,
		coaDisconnect:         opts.CoADisconnect,
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
	var quotaBytes int64
	sharedUsers := 1

	if req.ProfileID != "" && s.profiles != nil {
		prof, pErr := s.profiles.FindByID(ctx, req.ProfileID)
		if pErr == nil && prof != nil {
			id := prof.ID
			profileID = &id
			profileName = prof.DisplayName
			bwDown = prof.BandwidthDownKbps
			bwUp = prof.BandwidthUpKbps
			quotaBytes = prof.QuotaBytes
			if prof.SharedUsers > 0 {
				sharedUsers = prof.SharedUsers
			}
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

	voucher, password, err := s.newVoucherCustom(ctx, router, ttl, sessionTimeout, actorName, req.Note, prefix, digitCount, req.NumericOnly, profileID, bwDown, bwUp, quotaBytes, sharedUsers)
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
	quotaBytes int64,
	sharedUsers int,
) (*model.Voucher, string, error) {
	if sharedUsers <= 0 {
		sharedUsers = 1
	}
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
			QuotaBytes:            quotaBytes,
			SharedUsers:           sharedUsers,
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
	shared := voucher.SharedUsers
	if shared <= 0 {
		shared = 1
	}
	return dto.VoucherResponse{
		ID:                    voucher.ID,
		Username:              voucher.Username,
		Status:                voucher.Status,
		SiteID:                voucher.SiteID,
		RouterID:              voucher.RouterID,
		ProfileID:             voucher.ProfileID,
		BatchID:               voucher.BatchID,
		BandwidthDownKbps:     voucher.BandwidthDownKbps,
		BandwidthUpKbps:       voucher.BandwidthUpKbps,
		QuotaBytes:            voucher.QuotaBytes,
		SharedUsers:           shared,
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

func (s *voucherService) Revoke(ctx context.Context, actorID, actorName, voucherID string) (*dto.VoucherResponse, error) {
	v, err := s.vouchers.FindByID(ctx, voucherID)
	if err != nil {
		return nil, err
	}
	if v.Status == model.VoucherStatusRevoked {
		res := toVoucherResponse(v)
		return &res, nil
	}
	if err := s.vouchers.UpdateStatus(ctx, v.ID, model.VoucherStatusRevoked); err != nil {
		return nil, err
	}
	v.Status = model.VoucherStatusRevoked

	// Best-effort CoA disconnect if this voucher currently has an active RADIUS session.
	if s.accounts != nil && s.coaDisconnect != nil && s.nasClients != nil && len(s.radiusSecretKey) > 0 {
		if sessions, sErr := s.accounts.FindByUsernames(ctx, []string{v.Username}); sErr == nil {
			for i := range sessions {
				sess := sessions[i]
				if sess.Status != model.AccountingSessionStatusActive {
					continue
				}
				var nas *model.NASClient
				if sess.RouterID != nil && *sess.RouterID != "" {
					nas, _ = s.nasClients.FindByRouterID(ctx, *sess.RouterID)
				}
				if nas == nil && sess.NASIdentifier != "" {
					nas, _ = s.nasClients.FindByNASIdentifier(ctx, sess.NASIdentifier)
				}
				if nas != nil && nas.IPAddress != "" && nas.SecretCiphertext != "" {
					if secret, dErr := utils.DecryptString(s.radiusSecretKey, nas.SecretCiphertext); dErr == nil && secret != "" {
						if cErr := s.coaDisconnect(ctx, nas.IPAddress, secret, sess.AcctSessionID, sess.Username, sess.FramedIPAddress, sess.CallingStationID); cErr == nil {
							_ = s.accounts.CloseByID(ctx, sess.ID, time.Now().UTC(), "Admin-Reset")
						}
					}
				}
			}
		}
	}

	if s.audits != nil {
		_ = s.audits.Create(ctx, &model.AuditLog{
			ID:         uuid.NewString(),
			ActorID:    actorID,
			ActorName:  actorName,
			Action:     "voucher.revoke",
			EntityType: "voucher",
			EntityID:   v.ID,
			Detail:     fmt.Sprintf("revoked voucher %s", v.Username),
			CreatedAt:  time.Now().UTC(),
		})
	}
	res := toVoucherResponse(v)
	return &res, nil
}

func (s *voucherService) CreateBatch(ctx context.Context, actorID, actorName string, req dto.CreateVoucherBatchRequest) (*dto.VoucherBatchCreatedResponse, error) {
	if req.Quantity < 1 || req.Quantity > 500 {
		return nil, apperror.New(apperror.ErrBadRequest, "jumlah voucher harus antara 1 sampai 500")
	}
	router, err := s.resolveRouter(ctx, req.RouterID)
	if err != nil {
		return nil, err
	}

	ttl := s.defaultTTL
	sessionTimeout := s.defaultSessionTimeout
	var profileID *string
	var profileName string
	var bwDown, bwUp int
	var quotaBytes int64
	sharedUsers := 1

	if req.ProfileID != "" && s.profiles != nil {
		if prof, pErr := s.profiles.FindByID(ctx, req.ProfileID); pErr == nil && prof != nil {
			id := prof.ID
			profileID = &id
			profileName = prof.DisplayName
			bwDown = prof.BandwidthDownKbps
			bwUp = prof.BandwidthUpKbps
			quotaBytes = prof.QuotaBytes
			if prof.SharedUsers > 0 {
				sharedUsers = prof.SharedUsers
			}
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

	now := time.Now().UTC()
	batchID := uuid.NewString()
	batch := &model.VoucherBatch{
		ID:        batchID,
		Name:      req.Name,
		RouterID:  router.ID,
		ProfileID: profileID,
		Prefix:    prefix,
		Quantity:  req.Quantity,
		CreatedBy: actorName,
		CreatedAt: now,
	}

	vouchers := make([]model.Voucher, 0, req.Quantity)
	created := make([]dto.VoucherCreatedResponse, 0, req.Quantity)
	seen := make(map[string]struct{}, req.Quantity)

	for i := 0; i < req.Quantity; i++ {
		var username string
		for attempt := 0; attempt < 10; attempt++ {
			cand, gErr := utils.GenerateCustomVoucherUsername(prefix, digitCount, req.NumericOnly)
			if gErr != nil {
				return nil, gErr
			}
			if _, dup := seen[cand]; !dup {
				seen[cand] = struct{}{}
				username = cand
				break
			}
		}
		if username == "" {
			return nil, apperror.New(apperror.ErrConflict, "gagal menghasilkan kode voucher unik; coba perpanjang jumlah digit")
		}
		pw, pErr := utils.GenerateVoucherPassword(s.passwordLength)
		if pErr != nil {
			return nil, pErr
		}
		cipher, cErr := utils.EncryptString(s.voucherKey, pw)
		if cErr != nil {
			return nil, cErr
		}
		bID := batchID
		v := model.Voucher{
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
			BatchID:               &bID,
			BandwidthDownKbps:     bwDown,
			BandwidthUpKbps:       bwUp,
			QuotaBytes:            quotaBytes,
			SharedUsers:           sharedUsers,
			CreatedBy:             actorName,
			Note:                  req.Note,
			ExpiresAt:             now.Add(ttl),
			SessionTimeoutSeconds: sessionTimeout,
		}
		vouchers = append(vouchers, v)
		vRes := toVoucherResponse(&v)
		vRes.ProfileName = profileName
		created = append(created, dto.VoucherCreatedResponse{
			VoucherResponse: vRes,
			Password:        pw,
		})
	}

	if err := s.vouchers.CreateBatch(ctx, batch, vouchers); err != nil {
		return nil, err
	}

	if s.audits != nil {
		_ = s.audits.Create(ctx, &model.AuditLog{
			ID:         uuid.NewString(),
			ActorID:    actorID,
			ActorName:  actorName,
			Action:     "voucher.batch_create",
			EntityType: "voucher_batch",
			EntityID:   batch.ID,
			Detail:     fmt.Sprintf("batch %q (%d vouchers) for router %s", batch.Name, batch.Quantity, router.Name),
			CreatedAt:  now,
		})
	}

	return &dto.VoucherBatchCreatedResponse{
		Batch: dto.VoucherBatchResponse{
			ID:          batch.ID,
			Name:        batch.Name,
			RouterID:    batch.RouterID,
			RouterName:  router.Name,
			ProfileID:   batch.ProfileID,
			ProfileName: profileName,
			Prefix:      batch.Prefix,
			Quantity:    batch.Quantity,
			CreatedBy:   batch.CreatedBy,
			CreatedAt:   batch.CreatedAt,
		},
		Vouchers: created,
	}, nil
}

func (s *voucherService) ListBatches(ctx context.Context, query dto.VoucherBatchListQuery) ([]dto.VoucherBatchResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	items, total, err := s.vouchers.ListBatches(ctx, page, perPage, query.RouterID)
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
	profileMap := make(map[string]string)
	if s.profiles != nil {
		if pList, pErr := s.profiles.ListActive(ctx); pErr == nil {
			for _, p := range pList {
				profileMap[p.ID] = p.DisplayName
			}
		}
	}

	out := make([]dto.VoucherBatchResponse, 0, len(items))
	for _, b := range items {
		pName := ""
		if b.ProfileID != nil {
			pName = profileMap[*b.ProfileID]
		}
		out = append(out, dto.VoucherBatchResponse{
			ID:          b.ID,
			Name:        b.Name,
			RouterID:    b.RouterID,
			RouterName:  routerMap[b.RouterID],
			ProfileID:   b.ProfileID,
			ProfileName: pName,
			Prefix:      b.Prefix,
			Quantity:    b.Quantity,
			CreatedBy:   b.CreatedBy,
			CreatedAt:   b.CreatedAt,
		})
	}
	return out, dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}, nil
}

func (s *voucherService) Summary(ctx context.Context) (*dto.VoucherSummaryResponse, error) {
	counts, err := s.vouchers.CountByStatus(ctx)
	if err != nil {
		return nil, err
	}
	res := &dto.VoucherSummaryResponse{
		Issued:  counts[model.VoucherStatusIssued],
		Active:  counts[model.VoucherStatusActive],
		Used:    counts[model.VoucherStatusUsed],
		Expired: counts[model.VoucherStatusExpired],
		Revoked: counts[model.VoucherStatusRevoked],
	}
	res.Total = res.Issued + res.Active + res.Used + res.Expired + res.Revoked
	return res, nil
}
