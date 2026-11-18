package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"wifiads/internal/model"
	"wifiads/pkg/apperror"
)

type adminUserRepository struct {
	db *gorm.DB
}

// NewAdminUserRepository builds the admin account repository.
func NewAdminUserRepository(db *gorm.DB) AdminUserRepository {
	return &adminUserRepository{db: db}
}

func (r *adminUserRepository) Create(ctx context.Context, user *model.AdminUser) error {
	if err := r.db.WithContext(ctx).Create(user).Error; err != nil {
		if isUniqueViolation(err) {
			return apperror.ErrAlreadyExists
		}
		return err
	}
	return nil
}

func (r *adminUserRepository) FindByUsername(ctx context.Context, username string) (*model.AdminUser, error) {
	var user model.AdminUser
	err := r.db.WithContext(ctx).Where("LOWER(username) = LOWER(?)", username).First(&user).Error
	if err != nil {
		return nil, translateNotFound(err)
	}
	return &user, nil
}

func (r *adminUserRepository) FindByID(ctx context.Context, id string) (*model.AdminUser, error) {
	var user model.AdminUser
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&user).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &user, nil
}

func (r *adminUserRepository) TouchLastLogin(ctx context.Context, id string, at time.Time) error {
	return r.db.WithContext(ctx).Model(&model.AdminUser{}).
		Where("id = ?", id).
		Update("last_login_at", at).Error
}

func (r *adminUserRepository) List(ctx context.Context) ([]model.AdminUser, error) {
	var users []model.AdminUser
	if err := r.db.WithContext(ctx).Order("created_at ASC").Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (r *adminUserRepository) Update(ctx context.Context, user *model.AdminUser) error {
	return r.db.WithContext(ctx).Save(user).Error
}

func (r *adminUserRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.AdminUser{}).Error
}

func (r *adminUserRepository) Count(ctx context.Context) (int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&model.AdminUser{}).Count(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}

type roleRepository struct {
	db *gorm.DB
}

// NewRoleRepository builds the RBAC role repository.
func NewRoleRepository(db *gorm.DB) RoleRepository {
	return &roleRepository{db: db}
}

func (r *roleRepository) Create(ctx context.Context, role *model.Role) error {
	if err := r.db.WithContext(ctx).Create(role).Error; err != nil {
		if isUniqueViolation(err) {
			return apperror.ErrAlreadyExists
		}
		return err
	}
	return nil
}

func (r *roleRepository) FindByID(ctx context.Context, id string) (*model.Role, error) {
	var role model.Role
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&role).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &role, nil
}

func (r *roleRepository) FindByName(ctx context.Context, name string) (*model.Role, error) {
	var role model.Role
	if err := r.db.WithContext(ctx).Where("LOWER(name) = LOWER(?)", name).First(&role).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &role, nil
}

func (r *roleRepository) List(ctx context.Context) ([]model.Role, error) {
	var roles []model.Role
	if err := r.db.WithContext(ctx).Order("is_system DESC, created_at ASC").Find(&roles).Error; err != nil {
		return nil, err
	}
	return roles, nil
}

func (r *roleRepository) Update(ctx context.Context, role *model.Role) error {
	return r.db.WithContext(ctx).Save(role).Error
}

func (r *roleRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Role{}).Error
}
