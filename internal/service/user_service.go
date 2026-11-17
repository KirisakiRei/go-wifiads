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
	"wifiads/pkg/utils"
)

type userService struct {
	users repository.AdminUserRepository
}

// NewUserService builds an admin user management service.
func NewUserService(users repository.AdminUserRepository) UserService {
	return &userService{users: users}
}

func (s *userService) List(ctx context.Context) ([]dto.AdminUserResponse, error) {
	items, err := s.users.List(ctx)
	if err != nil {
		return nil, err
	}
	res := make([]dto.AdminUserResponse, 0, len(items))
	for _, u := range items {
		res = append(res, toAdminUserResponse(&u))
	}
	return res, nil
}

func (s *userService) Get(ctx context.Context, id string) (*dto.AdminUserResponse, error) {
	u, err := s.users.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	res := toAdminUserResponse(u)
	return &res, nil
}

func (s *userService) Create(ctx context.Context, req dto.CreateAdminUserRequest) (*dto.AdminUserResponse, error) {
	username := strings.ToLower(strings.TrimSpace(req.Username))
	existing, err := s.users.FindByUsername(ctx, username)
	if err == nil && existing != nil {
		return nil, apperror.New(apperror.ErrAlreadyExists, "username is already taken")
	}

	hash, err := utils.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	user := &model.AdminUser{
		Base: model.Base{
			ID:        uuid.NewString(),
			CreatedAt: now,
			UpdatedAt: now,
		},
		Username:     username,
		PasswordHash: hash,
		Name:         strings.TrimSpace(req.Name),
		Role:         req.Role,
		IsActive:     req.IsActive,
	}

	if err := s.users.Create(ctx, user); err != nil {
		return nil, err
	}

	res := toAdminUserResponse(user)
	return &res, nil
}

func (s *userService) Update(ctx context.Context, id string, req dto.UpdateAdminUserRequest) (*dto.AdminUserResponse, error) {
	u, err := s.users.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	u.Name = strings.TrimSpace(req.Name)
	u.Role = req.Role
	u.IsActive = req.IsActive
	u.UpdatedAt = time.Now().UTC()

	if err := s.users.Update(ctx, u); err != nil {
		return nil, err
	}

	res := toAdminUserResponse(u)
	return &res, nil
}

func (s *userService) ChangePassword(ctx context.Context, id string, req dto.ChangePasswordRequest) error {
	u, err := s.users.FindByID(ctx, id)
	if err != nil {
		return err
	}

	hash, err := utils.HashPassword(req.Password)
	if err != nil {
		return err
	}

	u.PasswordHash = hash
	u.UpdatedAt = time.Now().UTC()
	return s.users.Update(ctx, u)
}

func (s *userService) Delete(ctx context.Context, id string) error {
	return s.users.Delete(ctx, id)
}

func toAdminUserResponse(u *model.AdminUser) dto.AdminUserResponse {
	return dto.AdminUserResponse{
		ID:          u.ID,
		Username:    u.Username,
		Name:        u.Name,
		Role:        u.Role,
		IsActive:    u.IsActive,
		LastLoginAt: u.LastLoginAt,
		CreatedAt:   u.CreatedAt,
	}
}
