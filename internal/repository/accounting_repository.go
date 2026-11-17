package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"wifiads/internal/model"
	"wifiads/pkg/apperror"
)

type accountingRepository struct {
	db *gorm.DB
}

// NewAccountingRepository builds the RADIUS accounting repository.
func NewAccountingRepository(db *gorm.DB) AccountingRepository {
	return &accountingRepository{db: db}
}

// ApplyStart creates the session or refreshes it on NAS retry.
func (r *accountingRepository) ApplyStart(ctx context.Context, session *model.AccountingSession) (*model.AccountingSession, error) {
	existing, err := r.FindByNASAndAcctSession(ctx, session.NASIdentifier, session.AcctSessionID)
	if errors.Is(err, apperror.ErrNotFound) {
		if createErr := r.db.WithContext(ctx).Create(session).Error; createErr != nil {
			return nil, createErr
		}
		return session, nil
	}
	if err != nil {
		return nil, err
	}
	if existing.Status == model.AccountingSessionStatusClosed {
		return existing, nil
	}

	updates := map[string]any{
		"status":               model.AccountingSessionStatusActive,
		"last_accounting_at":   session.LastAccountingAt,
		"session_time_seconds": session.SessionTimeSeconds,
		"input_octets":         session.InputOctets,
		"output_octets":        session.OutputOctets,
	}
	if session.StartedAt != nil {
		updates["started_at"] = session.StartedAt
	}
	if session.Username != "" {
		updates["username"] = session.Username
	}
	if session.CallingStationID != "" {
		updates["calling_station_id"] = session.CallingStationID
	}
	if session.FramedIPAddress != "" {
		updates["framed_ip_address"] = session.FramedIPAddress
	}
	if session.VoucherID != nil {
		updates["voucher_id"] = session.VoucherID
	}
	if session.RouterID != nil {
		updates["router_id"] = session.RouterID
	}

	if updateErr := r.db.WithContext(ctx).Model(&model.AccountingSession{}).
		Where("id = ?", existing.ID).
		Updates(updates).Error; updateErr != nil {
		return nil, updateErr
	}
	existing.Status = model.AccountingSessionStatusActive
	return existing, nil
}

// ApplyInterim stores the latest counters of a running session.
func (r *accountingRepository) ApplyInterim(ctx context.Context, nasIdentifier, acctSessionID string, updates AccountingUpdates) (*model.AccountingSession, error) {
	return r.applyUpdate(ctx, nasIdentifier, acctSessionID, updates)
}

// ApplyStop closes the session.
func (r *accountingRepository) ApplyStop(ctx context.Context, nasIdentifier, acctSessionID string, updates AccountingUpdates) (*model.AccountingSession, error) {
	return r.applyUpdate(ctx, nasIdentifier, acctSessionID, updates)
}

func (r *accountingRepository) applyUpdate(ctx context.Context, nasIdentifier, acctSessionID string, updates AccountingUpdates) (*model.AccountingSession, error) {
	existing, err := r.FindByNASAndAcctSession(ctx, nasIdentifier, acctSessionID)
	if errors.Is(err, apperror.ErrNotFound) {
		recovered := &model.AccountingSession{
			NASIdentifier:      nasIdentifier,
			AcctSessionID:      acctSessionID,
			Status:             model.AccountingSessionStatusClosed,
			LastAccountingAt:   updates.LastAccountingAt,
			StoppedAt:          updates.StoppedAt,
			SessionTimeSeconds: updates.SessionTimeSeconds,
			InputOctets:        updates.InputOctets,
			OutputOctets:       updates.OutputOctets,
			TerminateCause:     updates.TerminateCause,
		}
		if createErr := r.db.WithContext(ctx).Create(recovered).Error; createErr != nil {
			return nil, createErr
		}
		return recovered, nil
	}
	if err != nil {
		return nil, err
	}

	fields := make(map[string]any, 6)
	if updates.LastAccountingAt != nil {
		fields["last_accounting_at"] = updates.LastAccountingAt
	}
	if updates.SessionTimeSeconds > 0 {
		fields["session_time_seconds"] = updates.SessionTimeSeconds
	}
	if updates.InputOctets > 0 {
		fields["input_octets"] = updates.InputOctets
	}
	if updates.OutputOctets > 0 {
		fields["output_octets"] = updates.OutputOctets
	}
	if updates.TerminateCause != "" {
		fields["terminate_cause"] = updates.TerminateCause
	}
	// A late Interim-Update must never reopen a closed session.
	if existing.Status != model.AccountingSessionStatusClosed {
		if updates.Status != "" {
			fields["status"] = updates.Status
		}
		if updates.StoppedAt != nil {
			fields["stopped_at"] = updates.StoppedAt
		}
	}
	if len(fields) == 0 {
		return existing, nil
	}
	if updateErr := r.db.WithContext(ctx).Model(&model.AccountingSession{}).
		Where("id = ?", existing.ID).
		Updates(fields).Error; updateErr != nil {
		return nil, updateErr
	}
	return existing, nil
}

func (r *accountingRepository) FindByNASAndAcctSession(ctx context.Context, nasIdentifier, acctSessionID string) (*model.AccountingSession, error) {
	var session model.AccountingSession
	err := r.db.WithContext(ctx).
		Where("nas_identifier = ? AND acct_session_id = ?", nasIdentifier, acctSessionID).
		First(&session).Error
	if err != nil {
		return nil, translateNotFound(err)
	}
	return &session, nil
}

func (r *accountingRepository) FindByUsernames(ctx context.Context, usernames []string) ([]model.AccountingSession, error) {
	if len(usernames) == 0 {
		return nil, nil
	}
	var sessions []model.AccountingSession
	err := r.db.WithContext(ctx).Where("username IN ?", usernames).Find(&sessions).Error
	return sessions, err
}
