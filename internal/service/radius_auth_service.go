package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"strings"
	"time"

	"wifiads/internal/model"
	"wifiads/internal/repository"
	"wifiads/pkg/apperror"
	"wifiads/pkg/utils"
)

type radiusAuthService struct {
	nas      repository.NASClientRepository
	vouchers repository.VoucherRepository
	accounts repository.AccountingRepository
	logger   *slog.Logger

	voucherKey      []byte
	radiusSecretKey []byte
}

// NewRadiusAuthService builds the RADIUS authentication service.
func NewRadiusAuthService(
	nas repository.NASClientRepository,
	vouchers repository.VoucherRepository,
	accounts repository.AccountingRepository,
	logger *slog.Logger,
	voucherKey, radiusSecretKey []byte,
) RadiusAuthenticator {
	return &radiusAuthService{
		nas:             nas,
		vouchers:        vouchers,
		accounts:        accounts,
		logger:          logger,
		voucherKey:      voucherKey,
		radiusSecretKey: radiusSecretKey,
	}
}

// LookupNAS resolves the RADIUS client by NAS-Identifier (for dynamic ISP public IPs)
// or by source IP, auto-updating the stored NAS public IP when it changes.
func (s *radiusAuthService) LookupNAS(ctx context.Context, remoteIP string) (*model.NASClient, string, error) {
	raw := strings.TrimSpace(remoteIP)
	nasIdent := ""
	if idx := strings.Index(raw, "|"); idx != -1 {
		nasIdent = strings.TrimSpace(raw[idx+1:])
		raw = raw[:idx]
	}
	ip := normalizeIP(raw)
	if ip == "" && nasIdent == "" {
		return nil, "", apperror.ErrUnauthorized
	}

	var client *model.NASClient
	var err error

	// 1. Primary lookup by NAS-Identifier so routers on dynamic public IPs always work
	if nasIdent != "" {
		client, err = s.nas.FindByNASIdentifier(ctx, nasIdent)
		if err == nil && client != nil && ip != "" && client.IPAddress != ip {
			client.IPAddress = ip
			client.UpdatedAt = time.Now().UTC()
			if upErr := s.nas.UpsertForRouter(ctx, client); upErr != nil {
				s.logger.Warn("failed to auto-update nas dynamic public ip",
					slog.String("nas_identifier", client.NASIdentifier),
					slog.String("new_ip", ip),
					slog.String("error", upErr.Error()),
				)
			}
		}
	}

	// 2. Fallback lookup by IP address
	if client == nil {
		client, err = s.nas.FindByIP(ctx, ip)
		if err != nil {
			if errors.Is(err, apperror.ErrNotFound) {
				// 3. Single-router fallback only when NAS-Identifier attribute is present in packet
				if nasIdent != "" {
					if all, listErr := s.nas.ListAll(ctx); listErr == nil && len(all) == 1 && all[0].IsActive {
						client = &all[0]
					}
				}
				if client == nil {
					s.logger.Warn("radius request from unknown nas", slog.String("remote_ip", ip), slog.String("nas_identifier", nasIdent))
					return nil, "", apperror.ErrUnauthorized
				}
			} else {
				return nil, "", err
			}
		}
	}

	if !client.IsActive {
		s.logger.Warn("radius request from disabled nas",
			slog.String("remote_ip", ip),
			slog.String("nas_identifier", client.NASIdentifier),
		)
		return nil, "", apperror.ErrForbidden
	}
	secret, err := utils.DecryptString(s.radiusSecretKey, client.SecretCiphertext)
	if err != nil {
		s.logger.Error("failed to decrypt nas shared secret",
			slog.String("nas_identifier", client.NASIdentifier),
			slog.String("error", err.Error()),
		)
		return nil, "", apperror.ErrInternalServer
	}
	return client, secret, nil
}

func normalizeIP(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err == nil {
		return strings.TrimSpace(host)
	}
	return strings.TrimSpace(remoteAddr)
}

func reject(reason string) *RadiusAuthResult {
	return &RadiusAuthResult{Accepted: false, Reason: reason}
}

// Authenticate validates credentials, binding and voucher state.
func (s *radiusAuthService) Authenticate(ctx context.Context, req RadiusAuthRequest) (*RadiusAuthResult, error) {
	nas, err := s.resolveNAS(ctx, req)
	if err != nil {
		if errors.Is(err, apperror.ErrNotFound) {
			return reject("unknown_nas"), nil
		}
		return nil, err
	}
	if !nas.IsActive {
		return reject("nas_disabled"), nil
	}
	if req.NASIdentifier != "" && !strings.EqualFold(req.NASIdentifier, nas.NASIdentifier) {
		return reject("nas_mismatch"), nil
	}

	username := strings.TrimSpace(req.Username)
	if username == "" {
		return reject("missing_username"), nil
	}

	voucher, err := s.vouchers.FindByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, apperror.ErrNotFound) {
			return reject("unknown_voucher"), nil
		}
		return nil, err
	}
	if nas.RouterID != "" && voucher.RouterID != nas.RouterID {
		return reject("router_mismatch"), nil
	}

	password, err := utils.DecryptString(s.voucherKey, voucher.PasswordCiphertext)
	if err != nil {
		s.logger.Error("failed to decrypt voucher password",
			slog.String("voucher_id", voucher.ID),
			slog.String("error", err.Error()),
		)
		return reject("voucher_secret_unavailable"), nil
	}
	if !s.credentialsMatch(req, password) {
		return reject("invalid_credentials"), nil
	}

	now := time.Now().UTC()
	switch voucher.Status {
	case model.VoucherStatusRevoked:
		return reject("voucher_revoked"), nil
	case model.VoucherStatusUsed:
		return reject("voucher_used"), nil
	case model.VoucherStatusExpired:
		return reject("voucher_expired"), nil
	}
	if !voucher.ExpiresAt.IsZero() && now.After(voucher.ExpiresAt) {
		if updateErr := s.vouchers.UpdateStatus(ctx, voucher.ID, model.VoucherStatusExpired); updateErr != nil {
			s.logger.Warn("failed to expire voucher", slog.String("error", updateErr.Error()))
		}
		return reject("voucher_expired"), nil
	}
	if !macMatches(voucher.ExpectedMAC, req.CallingStationID) {
		return reject("mac_mismatch"), nil
	}

	active, activeErr := s.accounts.HasActiveSessionForVoucher(ctx, voucher.ID)
	if activeErr != nil {
		return nil, activeErr
	}
	// Port-Limit = 1: a voucher may only hold one live session. When the voucher
	// has no MAC binding the MAC check above cannot protect it, so an already
	// active session is authoritative and blocks a second concurrent login.
	// When a MAC binding exists, mac_mismatch already guarantees the caller is
	// the bound device, so a re-auth (NAS retry) of that same device is allowed.
	if active && voucher.ExpectedMAC == "" {
		return reject("session_conflict"), nil
	}

	sessionTimeout := voucher.SessionTimeoutSeconds
	if sessionTimeout <= 0 {
		sessionTimeout = 3600
	}
	if voucher.UsedAt != nil && !voucher.ExpiresAt.IsZero() {
		remaining := int(voucher.ExpiresAt.Sub(now).Seconds())
		if remaining < 1 {
			_ = s.vouchers.UpdateStatus(ctx, voucher.ID, model.VoucherStatusExpired)
			return reject("voucher_expired"), nil
		}
		if remaining < sessionTimeout {
			sessionTimeout = remaining
		}
	}
	return &RadiusAuthResult{
		Accepted:              true,
		Reason:                "accepted",
		VoucherID:             voucher.ID,
		SessionTimeoutSeconds: sessionTimeout,
		BandwidthUpKbps:       voucher.BandwidthUpKbps,
		BandwidthDownKbps:     voucher.BandwidthDownKbps,
	}, nil
}

func (s *radiusAuthService) resolveNAS(ctx context.Context, req RadiusAuthRequest) (*model.NASClient, error) {
	if req.NASIdentifier != "" {
		client, err := s.nas.FindByNASIdentifier(ctx, req.NASIdentifier)
		if err == nil {
			return client, nil
		}
		if !errors.Is(err, apperror.ErrNotFound) {
			return nil, err
		}
	}
	return s.nas.FindByIP(ctx, normalizeIP(req.RemoteIP))
}

func (s *radiusAuthService) credentialsMatch(req RadiusAuthRequest, password string) bool {
	if req.HasCHAP {
		challenge := req.CHAPChallenge
		if len(challenge) == 0 {
			challenge = req.RequestAuthenticator
		}
		result := utils.VerifyCHAP(req.CHAPPassword, []byte(password), challenge)
		s.logger.Debug("chap verify detail",
			slog.String("username", req.Username),
			slog.Int("chap_password_len", len(req.CHAPPassword)),
			slog.Int("challenge_len", len(challenge)),
			slog.String("chap_password_hex", fmt.Sprintf("%x", req.CHAPPassword)),
			slog.String("challenge_hex", fmt.Sprintf("%x", challenge)),
			slog.String("password_len", fmt.Sprintf("%d", len(password))),
			slog.Bool("match", result),
		)
		return result
	}
	return utils.SecureCompare(password, req.Password)
}

func macMatches(expected, reported string) bool {
	expected = utils.NormalizeMAC(expected)
	reported = utils.NormalizeMAC(reported)
	if expected == "" || reported == "" {
		return true
	}
	return expected == reported
}
