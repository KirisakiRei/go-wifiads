package service

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"wifiads/internal/dto"
	"wifiads/internal/model"
	"wifiads/internal/repository"
)

type advertisementService struct {
	ads repository.AdvertisementRepository
}

// NewAdvertisementService builds an advertisement management service.
func NewAdvertisementService(ads repository.AdvertisementRepository) AdvertisementService {
	return &advertisementService{ads: ads}
}

func (s *advertisementService) List(ctx context.Context) ([]dto.AdvertisementResponse, error) {
	items, err := s.ads.List(ctx)
	if err != nil {
		return nil, err
	}
	res := make([]dto.AdvertisementResponse, 0, len(items))
	for _, a := range items {
		res = append(res, toAdvertisementResponse(&a))
	}
	return res, nil
}

func (s *advertisementService) Get(ctx context.Context, id string) (*dto.AdvertisementResponse, error) {
	a, err := s.ads.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	res := toAdvertisementResponse(a)
	return &res, nil
}

func (s *advertisementService) Create(ctx context.Context, req dto.CreateAdvertisementRequest) (*dto.AdvertisementResponse, error) {
	now := time.Now().UTC()
	layoutMode := strings.ToLower(strings.TrimSpace(req.LayoutMode))
	if layoutMode != "portrait" {
		layoutMode = "landscape"
	}

	mediaType := strings.ToLower(strings.TrimSpace(req.MediaType))
	if mediaType != "video" {
		mediaType = "image"
	}

	ad := &model.Advertisement{
		Base: model.Base{
			ID:        uuid.NewString(),
			CreatedAt: now,
			UpdatedAt: now,
		},
		Title:           strings.TrimSpace(req.Title),
		Body:            strings.TrimSpace(req.Body),
		ImageURL:        strings.TrimSpace(req.ImageURL),
		MediaType:       mediaType,
		LayoutMode:      layoutMode,
		DurationSeconds: req.DurationSeconds,
		SortOrder:       req.SortOrder,
		IsActive:        req.IsActive,
	}

	if err := s.ads.Create(ctx, ad); err != nil {
		return nil, err
	}

	res := toAdvertisementResponse(ad)
	return &res, nil
}

func (s *advertisementService) Update(ctx context.Context, id string, req dto.UpdateAdvertisementRequest) (*dto.AdvertisementResponse, error) {
	ad, err := s.ads.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	ad.Title = strings.TrimSpace(req.Title)
	ad.Body = strings.TrimSpace(req.Body)
	ad.ImageURL = strings.TrimSpace(req.ImageURL)
	if req.MediaType != "" {
		ad.MediaType = req.MediaType
	}
	if req.LayoutMode != "" {
		ad.LayoutMode = req.LayoutMode
	}
	if req.DurationSeconds >= 0 {
		ad.DurationSeconds = req.DurationSeconds
	}
	ad.SortOrder = req.SortOrder
	ad.IsActive = req.IsActive
	ad.UpdatedAt = time.Now().UTC()

	if err := s.ads.Update(ctx, ad); err != nil {
		return nil, err
	}

	res := toAdvertisementResponse(ad)
	return &res, nil
}

func (s *advertisementService) Delete(ctx context.Context, id string) error {
	return s.ads.Delete(ctx, id)
}

func toAdvertisementResponse(a *model.Advertisement) dto.AdvertisementResponse {
	layoutMode := a.LayoutMode
	if layoutMode == "" {
		layoutMode = "landscape"
	}
	mediaType := a.MediaType
	if mediaType == "" {
		mediaType = "image"
	}
	return dto.AdvertisementResponse{
		ID:              a.ID,
		Title:           a.Title,
		Body:            a.Body,
		ImageURL:        a.ImageURL,
		MediaType:       mediaType,
		LayoutMode:      layoutMode,
		DurationSeconds: a.DurationSeconds,
		SortOrder:       a.SortOrder,
		IsActive:        a.IsActive,
		CreatedAt:       a.CreatedAt,
		UpdatedAt:       a.UpdatedAt,
	}
}
