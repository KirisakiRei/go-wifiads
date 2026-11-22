package service

import (
	"context"
	"errors"
	"testing"

	"wifiads/internal/dto"
	"wifiads/internal/model"
	"wifiads/internal/repository"
	"wifiads/pkg/apperror"
)

type fakePartnerLeadRepo struct {
	items map[string]*model.PartnerLead
}

func (f *fakePartnerLeadRepo) Create(_ context.Context, lead *model.PartnerLead) error {
	if f.items == nil {
		f.items = map[string]*model.PartnerLead{}
	}
	cp := *lead
	f.items[lead.ID] = &cp
	return nil
}

func (f *fakePartnerLeadRepo) FindByID(_ context.Context, id string) (*model.PartnerLead, error) {
	l, ok := f.items[id]
	if !ok {
		return nil, apperror.ErrNotFound
	}
	cp := *l
	return &cp, nil
}

func (f *fakePartnerLeadRepo) Update(_ context.Context, lead *model.PartnerLead) error {
	cp := *lead
	f.items[lead.ID] = &cp
	return nil
}

func (f *fakePartnerLeadRepo) List(_ context.Context, _ repository.PartnerLeadFilter) ([]model.PartnerLead, int64, error) {
	out := make([]model.PartnerLead, 0, len(f.items))
	for _, v := range f.items {
		out = append(out, *v)
	}
	return out, int64(len(out)), nil
}

type stubPartnerServiceForLead struct {
	PartnerService
	created *dto.AdminPartnerResponse
}

func (s *stubPartnerServiceForLead) AdminCreatePartnerInvite(_ context.Context, req dto.AdminCreatePartnerInviteRequest) (*dto.AdminPartnerResponse, error) {
	share := 20.0
	if req.RevenueSharePercent != nil {
		share = *req.RevenueSharePercent
	}
	s.created = &dto.AdminPartnerResponse{
		ID:                  "partner-uuid-1",
		VenueName:           req.VenueName,
		RevenueSharePercent: share,
		Status:              model.PartnerStatusInvited,
		InviteToken:         "inv-tok-123",
	}
	return s.created, nil
}

func TestPublicServiceSubmitAndConvertLead(t *testing.T) {
	repo := &fakePartnerLeadRepo{}
	stubPartner := &stubPartnerServiceForLead{}
	svc := NewPublicService(repo, nil, nil, nil, nil, nil, stubPartner)

	ctx := context.Background()
	lead, err := svc.SubmitPartnerLead(ctx, dto.SubmitPartnerLeadRequest{
		VenueName:            "Kopi Kenangan Medan",
		Category:             "Kafe",
		City:                 "Medan",
		DailyTrafficEstimate: 180,
		ContactName:          "Budi",
		WhatsApp:             "081234567890",
	})
	if err != nil {
		t.Fatalf("SubmitPartnerLead failed: %v", err)
	}
	if lead.Status != model.PartnerLeadStatusNew {
		t.Fatalf("expected status NEW, got %s", lead.Status)
	}

	// Guard against nil partners repo during prefill by avoiding dereference:
	// let's make sure convert handles nil partners safely or skips prefill if partners is nil.
	share := 25.0
	conv, err := svc.AdminConvertPartnerLead(ctx, lead.ID, dto.ConvertPartnerLeadRequest{
		RevenueSharePercent: &share,
	}, "admin-1", "superadmin")
	if err != nil {
		t.Fatalf("AdminConvertPartnerLead failed: %v", err)
	}
	if conv.Lead.Status != model.PartnerLeadStatusConverted || conv.Partner.InviteToken != "inv-tok-123" {
		t.Fatalf("unexpected conversion result: %+v", conv)
	}

	// Second convert should return ErrAlreadyExists.
	if _, err := svc.AdminConvertPartnerLead(ctx, lead.ID, dto.ConvertPartnerLeadRequest{}, "admin-1", "superadmin"); !errors.Is(err, apperror.ErrAlreadyExists) {
		t.Fatalf("expected ErrAlreadyExists on double convert, got %v", err)
	}
}
