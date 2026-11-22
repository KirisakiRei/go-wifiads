package service

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"wifiads/internal/dto"
	"wifiads/internal/model"
	"wifiads/internal/repository"
	"wifiads/pkg/apperror"
)

type profileService struct {
	profiles repository.ConnectProfileRepository
}

// NewProfileService creates an implementation of ProfileService.
func NewProfileService(profiles repository.ConnectProfileRepository) ProfileService {
	return &profileService{profiles: profiles}
}

func (s *profileService) List(ctx context.Context) ([]dto.ConnectProfileResponse, error) {
	items, err := s.profiles.ListActive(ctx)
	if err != nil {
		return nil, err
	}
	res := make([]dto.ConnectProfileResponse, 0, len(items))
	for _, p := range items {
		res = append(res, toProfileResponse(&p))
	}
	return res, nil
}

func (s *profileService) Get(ctx context.Context, id string) (*dto.ConnectProfileResponse, error) {
	p, err := s.profiles.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	res := toProfileResponse(p)
	return &res, nil
}

func (s *profileService) Create(ctx context.Context, req dto.CreateProfileRequest) (*dto.ConnectProfileResponse, error) {
	name := strings.ToLower(strings.TrimSpace(req.Name))
	existing, err := s.profiles.FindByName(ctx, name)
	if err == nil && existing != nil {
		return nil, apperror.New(apperror.ErrAlreadyExists, "profile with this name already exists")
	}

	now := time.Now().UTC()
	voucherTTL := req.VoucherTTLSeconds
	if voucherTTL <= 0 {
		voucherTTL = 300
	}

	sharedUsers := req.SharedUsers
	if sharedUsers <= 0 {
		sharedUsers = 1
	}

	p := &model.ConnectProfile{
		Base: model.Base{
			ID:        uuid.NewString(),
			CreatedAt: now,
			UpdatedAt: now,
		},
		Name:                  strings.TrimSpace(req.Name),
		DisplayName:           strings.TrimSpace(req.DisplayName),
		Description:           strings.TrimSpace(req.Description),
		IsDefault:             req.IsDefault,
		BandwidthUpKbps:       req.BandwidthUpKbps,
		BandwidthDownKbps:     req.BandwidthDownKbps,
		SessionTimeoutSeconds: req.SessionTimeoutSeconds,
		VoucherTTLSeconds:     voucherTTL,
		QuotaBytes:            req.QuotaBytes,
		SharedUsers:           sharedUsers,
		IsActive:              req.IsActive,
	}

	if err := s.profiles.Create(ctx, p); err != nil {
		return nil, err
	}

	res := toProfileResponse(p)
	return &res, nil
}

func (s *profileService) Update(ctx context.Context, id string, req dto.UpdateProfileRequest) (*dto.ConnectProfileResponse, error) {
	p, err := s.profiles.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	p.DisplayName = strings.TrimSpace(req.DisplayName)
	p.Description = strings.TrimSpace(req.Description)
	p.IsDefault = req.IsDefault
	p.BandwidthUpKbps = req.BandwidthUpKbps
	p.BandwidthDownKbps = req.BandwidthDownKbps
	p.SessionTimeoutSeconds = req.SessionTimeoutSeconds
	if req.VoucherTTLSeconds > 0 {
		p.VoucherTTLSeconds = req.VoucherTTLSeconds
	}
	p.QuotaBytes = req.QuotaBytes
	if req.SharedUsers > 0 {
		p.SharedUsers = req.SharedUsers
	}
	p.IsActive = req.IsActive
	p.UpdatedAt = time.Now().UTC()

	if err := s.profiles.Update(ctx, p); err != nil {
		return nil, err
	}

	res := toProfileResponse(p)
	return &res, nil
}

func (s *profileService) Delete(ctx context.Context, actorID, actorName, id string) error {
	p, err := s.profiles.FindByID(ctx, id)
	if err != nil {
		return err
	}
	usedCount, err := s.profiles.CountRoutersUsingProfile(ctx, p.ID)
	if err != nil {
		return err
	}
	if usedCount > 0 {
		return apperror.New(apperror.ErrConflict, "Profil masih digunakan sebagai profil default/survei pada router aktif.")
	}
	return s.profiles.Delete(ctx, p.ID)
}

func toProfileResponse(p *model.ConnectProfile) dto.ConnectProfileResponse {
	shared := p.SharedUsers
	if shared <= 0 {
		shared = 1
	}
	return dto.ConnectProfileResponse{
		ID:                    p.ID,
		Name:                  p.Name,
		DisplayName:           p.DisplayName,
		Description:           p.Description,
		IsDefault:             p.IsDefault,
		BandwidthUpKbps:       p.BandwidthUpKbps,
		BandwidthDownKbps:     p.BandwidthDownKbps,
		SessionTimeoutSeconds: p.SessionTimeoutSeconds,
		VoucherTTLSeconds:     p.VoucherTTLSeconds,
		QuotaBytes:            p.QuotaBytes,
		SharedUsers:           shared,
		IsActive:              p.IsActive,
		CreatedAt:             p.CreatedAt,
		UpdatedAt:             p.UpdatedAt,
	}
}
