package service

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"wifiads/internal/model"
	"wifiads/internal/repository"
	"wifiads/pkg/apperror"
	"wifiads/pkg/utils"
)

type accountingService struct {
	accounts repository.AccountingRepository
	vouchers repository.VoucherRepository
	visitors repository.WifiVisitorRepository
	logger   *slog.Logger

	staleAfter time.Duration
}

// NewAccountingService builds the RADIUS accounting service.
func NewAccountingService(
	accounts repository.AccountingRepository,
	vouchers repository.VoucherRepository,
	visitors repository.WifiVisitorRepository,
	logger *slog.Logger,
	staleAfter time.Duration,
) RadiusAccountant {
	return &accountingService{
		accounts:   accounts,
		vouchers:   vouchers,
		visitors:   visitors,
		logger:     logger,
		staleAfter: staleAfter,
	}
}

// Process applies one Accounting-Request idempotently.
func (s *accountingService) Process(ctx context.Context, req RadiusAccountingRequest) error {
	if req.AcctSessionID == "" {
		return apperror.New(apperror.ErrBadRequest, "acct-session-id is required")
	}

	now := time.Now().UTC()
	voucher, voucherErr := s.vouchers.FindByUsername(ctx, req.Username)
	if voucherErr != nil && !errors.Is(voucherErr, apperror.ErrNotFound) {
		return voucherErr
	}

	var voucherID *string
	var routerID *string
	if voucherErr == nil {
		voucherID = &voucher.ID
		if voucher.RouterID != "" {
			routerID = &voucher.RouterID
		}
	}

	started := now
	if req.SessionTimeSeconds > 0 {
		started = now.Add(-time.Duration(req.SessionTimeSeconds) * time.Second)
	}

	var applyErr error
	switch req.StatusType {
	case "Start":
		_, applyErr = s.accounts.ApplyStart(ctx, &model.AccountingSession{
			Base: model.Base{
				ID:        uuid.NewString(),
				CreatedAt: now,
				UpdatedAt: now,
			},
			NASIdentifier:      req.NASIdentifier,
			AcctSessionID:      req.AcctSessionID,
			RouterID:           routerID,
			VoucherID:          voucherID,
			Username:           req.Username,
			CallingStationID:   utils.NormalizeMAC(req.CallingStationID),
			FramedIPAddress:    req.FramedIPAddress,
			Status:             model.AccountingSessionStatusActive,
			StartedAt:          &started,
			LastAccountingAt:   &now,
			SessionTimeSeconds: req.SessionTimeSeconds,
			InputOctets:        req.InputOctets,
			OutputOctets:       req.OutputOctets,
		})
	case "Interim-Update":
		_, applyErr = s.accounts.ApplyInterim(ctx, req.NASIdentifier, req.AcctSessionID, repository.AccountingUpdates{
			Status:             model.AccountingSessionStatusActive,
			LastAccountingAt:   &now,
			SessionTimeSeconds: req.SessionTimeSeconds,
			InputOctets:        req.InputOctets,
			OutputOctets:       req.OutputOctets,
		})
	case "Stop":
		_, applyErr = s.accounts.ApplyStop(ctx, req.NASIdentifier, req.AcctSessionID, repository.AccountingUpdates{
			Status:             model.AccountingSessionStatusClosed,
			LastAccountingAt:   &now,
			StoppedAt:          &now,
			SessionTimeSeconds: req.SessionTimeSeconds,
			InputOctets:        req.InputOctets,
			OutputOctets:       req.OutputOctets,
			TerminateCause:     req.TerminateCause,
		})
	default:
		return nil
	}
	if applyErr != nil {
		return applyErr
	}

	deduped, eventErr := s.accounts.RecordEvent(ctx, &model.AccountingEvent{
		ID:            uuid.NewString(),
		NASIdentifier: req.NASIdentifier,
		AcctSessionID: req.AcctSessionID,
		StatusType:    req.StatusType,
		EventKey:      req.EventKey,
		Payload:       req.Payload,
		ReceivedAt:    now,
	})
	if eventErr != nil {
		s.logger.Warn("failed to record accounting event", slog.String("error", eventErr.Error()))
	} else if !deduped {
		s.logger.Debug("duplicate accounting event ignored",
			slog.String("acct_session_id", req.AcctSessionID),
			slog.String("status_type", req.StatusType),
		)
	}

	s.syncVoucherAndVisitor(ctx, req, voucher, voucherErr, now)
	return nil
}

func (s *accountingService) syncVoucherAndVisitor(ctx context.Context, req RadiusAccountingRequest, voucher *model.Voucher, voucherErr error, now time.Time) {
	if voucherErr == nil && voucher != nil {
		switch req.StatusType {
		case "Start":
			if voucher.Status == model.VoucherStatusIssued {
				if err := s.vouchers.UpdateStatus(ctx, voucher.ID, model.VoucherStatusActive); err != nil {
					s.logger.Warn("failed to activate voucher", slog.String("error", err.Error()))
				}
			}
		case "Stop":
			if err := s.vouchers.MarkUsed(ctx, voucher.ID, now); err != nil {
				s.logger.Warn("failed to mark voucher as used", slog.String("error", err.Error()))
			}
		}
	}

	switch req.StatusType {
	case "Start":
		if err := s.visitors.MarkConnected(ctx, req.Username, now); err != nil {
			s.logger.Warn("failed to mark visitor connected", slog.String("error", err.Error()))
		}
	case "Stop":
		if err := s.visitors.MarkDisconnected(ctx, req.Username, now, req.SessionTimeSeconds); err != nil {
			s.logger.Warn("failed to mark visitor disconnected", slog.String("error", err.Error()))
		}
	}
}

// MarkStaleSessions flags silently dead sessions without assuming logout.
func (s *accountingService) MarkStaleSessions(ctx context.Context) (int64, error) {
	threshold := time.Now().UTC().Add(-s.staleAfter)
	affected, err := s.accounts.MarkStale(ctx, threshold)
	if err != nil {
		return 0, err
	}
	if affected > 0 {
		s.logger.Info("marked stale accounting sessions", slog.Int64("count", affected))
	}
	return affected, nil
}
