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
	roles repository.RoleRepository
}

// NewUserService builds an admin user and RBAC role management service.
func NewUserService(users repository.AdminUserRepository, roles ...repository.RoleRepository) UserService {
	s := &userService{users: users}
	if len(roles) > 0 {
		s.roles = roles[0]
	}
	return s
}

func (s *userService) List(ctx context.Context) ([]dto.AdminUserResponse, error) {
	items, err := s.users.List(ctx)
	if err != nil {
		return nil, err
	}

	roleMap := make(map[string]model.Role)
	if s.roles != nil {
		if rList, rErr := s.roles.List(ctx); rErr == nil {
			for _, r := range rList {
				roleMap[strings.ToLower(r.Name)] = r
			}
		}
	}

	res := make([]dto.AdminUserResponse, 0, len(items))
	for _, u := range items {
		roleInfo := roleMap[strings.ToLower(u.Role)]
		res = append(res, toAdminUserResponse(&u, &roleInfo))
	}
	return res, nil
}

func (s *userService) Get(ctx context.Context, id string) (*dto.AdminUserResponse, error) {
	u, err := s.users.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	var roleInfo *model.Role
	if s.roles != nil {
		if r, rErr := s.roles.FindByName(ctx, u.Role); rErr == nil {
			roleInfo = r
		}
	}
	res := toAdminUserResponse(u, roleInfo)
	return &res, nil
}

func (s *userService) Create(ctx context.Context, req dto.CreateAdminUserRequest) (*dto.AdminUserResponse, error) {
	username := strings.ToLower(strings.TrimSpace(req.Username))
	existing, err := s.users.FindByUsername(ctx, username)
	if err == nil && existing != nil {
		return nil, apperror.New(apperror.ErrAlreadyExists, "username sudah digunakan")
	}

	roleName := strings.ToLower(strings.TrimSpace(req.Role))
	if roleName == "" {
		roleName = "admin"
	}

	var roleInfo *model.Role
	if s.roles != nil {
		if r, rErr := s.roles.FindByName(ctx, roleName); rErr == nil {
			roleInfo = r
			roleName = r.Name
		}
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
		Role:         roleName,
		IsActive:     req.IsActive,
	}

	if err := s.users.Create(ctx, user); err != nil {
		return nil, err
	}

	res := toAdminUserResponse(user, roleInfo)
	return &res, nil
}

func (s *userService) Update(ctx context.Context, id string, req dto.UpdateAdminUserRequest) (*dto.AdminUserResponse, error) {
	u, err := s.users.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	roleName := strings.ToLower(strings.TrimSpace(req.Role))
	if roleName == "" {
		roleName = u.Role
	}

	var roleInfo *model.Role
	if s.roles != nil {
		if r, rErr := s.roles.FindByName(ctx, roleName); rErr == nil {
			roleInfo = r
			roleName = r.Name
		}
	}

	u.Name = strings.TrimSpace(req.Name)
	u.Role = roleName
	u.IsActive = req.IsActive
	u.UpdatedAt = time.Now().UTC()

	if err := s.users.Update(ctx, u); err != nil {
		return nil, err
	}

	res := toAdminUserResponse(u, roleInfo)
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

func (s *userService) ListRoles(ctx context.Context) ([]dto.RoleResponse, error) {
	if s.roles == nil {
		return nil, nil
	}
	roles, err := s.roles.List(ctx)
	if err != nil {
		return nil, err
	}

	userCountByRole := make(map[string]int)
	if users, uErr := s.users.List(ctx); uErr == nil {
		for _, u := range users {
			userCountByRole[strings.ToLower(u.Role)]++
		}
	}

	res := make([]dto.RoleResponse, 0, len(roles))
	for _, r := range roles {
		res = append(res, toRoleResponse(&r, userCountByRole[strings.ToLower(r.Name)]))
	}
	return res, nil
}

func (s *userService) CreateRole(ctx context.Context, req dto.CreateRoleRequest) (*dto.RoleResponse, error) {
	if s.roles == nil {
		return nil, apperror.ErrInternalServer
	}
	name := strings.ToLower(strings.TrimSpace(req.Name))
	name = strings.ReplaceAll(name, " ", "_")
	if existing, err := s.roles.FindByName(ctx, name); err == nil && existing != nil {
		return nil, apperror.New(apperror.ErrAlreadyExists, "role dengan kode tersebut sudah ada")
	}

	now := time.Now().UTC()
	role := &model.Role{
		Base: model.Base{
			ID:        uuid.NewString(),
			CreatedAt: now,
			UpdatedAt: now,
		},
		Name:        name,
		DisplayName: strings.TrimSpace(req.DisplayName),
		Description: strings.TrimSpace(req.Description),
		Permissions: joinPermissions(req.Permissions),
		IsSystem:    false,
	}

	if err := s.roles.Create(ctx, role); err != nil {
		return nil, err
	}
	res := toRoleResponse(role, 0)
	return &res, nil
}

func (s *userService) UpdateRole(ctx context.Context, id string, req dto.UpdateRoleRequest) (*dto.RoleResponse, error) {
	if s.roles == nil {
		return nil, apperror.ErrInternalServer
	}
	role, err := s.roles.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	role.DisplayName = strings.TrimSpace(req.DisplayName)
	role.Description = strings.TrimSpace(req.Description)
	role.Permissions = joinPermissions(req.Permissions)
	role.UpdatedAt = time.Now().UTC()

	if err := s.roles.Update(ctx, role); err != nil {
		return nil, err
	}

	count := 0
	if users, uErr := s.users.List(ctx); uErr == nil {
		for _, u := range users {
			if strings.EqualFold(u.Role, role.Name) {
				count++
			}
		}
	}

	res := toRoleResponse(role, count)
	return &res, nil
}

func (s *userService) DeleteRole(ctx context.Context, id string) error {
	if s.roles == nil {
		return apperror.ErrInternalServer
	}
	role, err := s.roles.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if role.IsSystem {
		return apperror.New(apperror.ErrForbidden, "role bawaan sistem tidak dapat dihapus")
	}
	if users, uErr := s.users.List(ctx); uErr == nil {
		for _, u := range users {
			if strings.EqualFold(u.Role, role.Name) {
				return apperror.New(apperror.ErrConflict, "role masih digunakan oleh pengguna aktif")
			}
		}
	}
	return s.roles.Delete(ctx, id)
}

func splitPermissions(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return []string{}
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	seen := make(map[string]bool)
	for _, p := range parts {
		clean := strings.TrimSpace(p)
		if clean != "" && !seen[clean] {
			seen[clean] = true
			out = append(out, clean)
		}
	}
	return out
}

func joinPermissions(perms []string) string {
	out := make([]string, 0, len(perms))
	seen := make(map[string]bool)
	for _, p := range perms {
		clean := strings.TrimSpace(p)
		if clean != "" && !seen[clean] {
			seen[clean] = true
			out = append(out, clean)
		}
	}
	return strings.Join(out, ",")
}

func toRoleResponse(r *model.Role, usersCount int) dto.RoleResponse {
	return dto.RoleResponse{
		ID:          r.ID,
		Name:        r.Name,
		DisplayName: r.DisplayName,
		Description: r.Description,
		Permissions: splitPermissions(r.Permissions),
		IsSystem:    r.IsSystem,
		UsersCount:  usersCount,
		CreatedAt:   r.CreatedAt,
		UpdatedAt:   r.UpdatedAt,
	}
}

func toAdminUserResponse(u *model.AdminUser, roleInfo *model.Role) dto.AdminUserResponse {
	displayName := u.Role
	var perms []string
	if roleInfo != nil && roleInfo.Name != "" {
		if roleInfo.DisplayName != "" {
			displayName = roleInfo.DisplayName
		}
		perms = splitPermissions(roleInfo.Permissions)
	} else if strings.EqualFold(u.Role, "admin") || strings.EqualFold(u.Role, "superadmin") {
		displayName = "Super Administrator"
		perms = model.AllPermissionKeys
	}
	return dto.AdminUserResponse{
		ID:              u.ID,
		Username:        u.Username,
		Name:            u.Name,
		Role:            u.Role,
		RoleDisplayName: displayName,
		Permissions:     perms,
		IsActive:        u.IsActive,
		LastLoginAt:     u.LastLoginAt,
		CreatedAt:       u.CreatedAt,
	}
}
