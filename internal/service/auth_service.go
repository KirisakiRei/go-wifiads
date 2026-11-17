package service

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"wifiads/internal/dto"
	"wifiads/internal/model"
	"wifiads/internal/repository"
	"wifiads/pkg/apperror"
	"wifiads/pkg/utils"
)

type authService struct {
	repo   repository.AdminUserRepository
	logger *slog.Logger

	jwtSecret string
	jwtIssuer string
	jwtTTL    time.Duration
}

// NewAuthService builds the admin authentication service.
func NewAuthService(repo repository.AdminUserRepository, logger *slog.Logger, jwtSecret, jwtIssuer string, jwtTTL time.Duration) AuthService {
	return &authService{
		repo:      repo,
		logger:    logger,
		jwtSecret: jwtSecret,
		jwtIssuer: jwtIssuer,
		jwtTTL:    jwtTTL,
	}
}

func (s *authService) Login(ctx context.Context, req dto.LoginRequest) (*dto.LoginResponse, error) {
	admin, err := s.repo.FindByUsername(ctx, req.Username)
	if err != nil {
		if errors.Is(err, apperror.ErrNotFound) {
			return nil, apperror.ErrUnauthorized
		}
		return nil, err
	}
	if !admin.IsActive {
		return nil, apperror.ErrForbidden
	}
	if !utils.CheckPasswordHash(req.Password, admin.PasswordHash) {
		return nil, apperror.ErrUnauthorized
	}

	token, err := utils.GenerateJWT(s.jwtSecret, s.jwtIssuer, admin.ID, admin.Username, admin.Role, s.jwtTTL)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	if err := s.repo.TouchLastLogin(ctx, admin.ID, now); err != nil {
		s.logger.Warn("failed to record admin login timestamp",
			slog.String("admin_id", admin.ID),
			slog.String("error", err.Error()),
		)
	}

	return &dto.LoginResponse{
		Token:     token,
		ExpiresAt: now.Add(s.jwtTTL).Format(time.RFC3339),
		User:      toAdminResponse(admin),
	}, nil
}

func (s *authService) Profile(ctx context.Context, adminID string) (*dto.AdminResponse, error) {
	admin, err := s.repo.FindByID(ctx, adminID)
	if err != nil {
		return nil, err
	}
	response := toAdminResponse(admin)
	return &response, nil
}

func toAdminResponse(admin *model.AdminUser) dto.AdminResponse {
	return dto.AdminResponse{
		ID:       admin.ID,
		Username: admin.Username,
		Name:     admin.Name,
		Role:     admin.Role,
	}
}
