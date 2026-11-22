package repository

import (
	"context"
	"strings"
	"time"

	"gorm.io/gorm"

	"wifiads/internal/model"
	"wifiads/pkg/utils"
)

type blockedDeviceRepository struct {
	db *gorm.DB
}

// NewBlockedDeviceRepository builds the MAC blocklist repository.
func NewBlockedDeviceRepository(db *gorm.DB) BlockedDeviceRepository {
	return &blockedDeviceRepository{db: db}
}

func (r *blockedDeviceRepository) Block(ctx context.Context, device *model.BlockedDevice) error {
	device.MAC = utils.NormalizeMAC(device.MAC)
	var existing model.BlockedDevice
	q := r.db.WithContext(ctx).Where("mac = ?", device.MAC)
	if device.RouterID == nil || strings.TrimSpace(*device.RouterID) == "" {
		q = q.Where("router_id IS NULL")
	} else {
		q = q.Where("router_id = ?", strings.TrimSpace(*device.RouterID))
	}
	if err := q.First(&existing).Error; err == nil {
		updates := map[string]any{
			"reason":     device.Reason,
			"blocked_by": device.BlockedBy,
			"updated_at": time.Now().UTC(),
		}
		if err := r.db.WithContext(ctx).Model(&existing).Updates(updates).Error; err != nil {
			return err
		}
		device.ID = existing.ID
		device.CreatedAt = existing.CreatedAt
		return nil
	}
	return r.db.WithContext(ctx).Create(device).Error
}

func (r *blockedDeviceRepository) UnblockByMAC(ctx context.Context, mac string, routerID string) (int64, error) {
	norm := utils.NormalizeMAC(mac)
	if norm == "" {
		return 0, nil
	}
	q := r.db.WithContext(ctx).Where("mac = ?", norm)
	if strings.TrimSpace(routerID) != "" {
		q = q.Where("router_id = ?", strings.TrimSpace(routerID))
	}
	res := q.Delete(&model.BlockedDevice{})
	return res.RowsAffected, res.Error
}

// IsBlocked checks whether the MAC is blocked globally or on the given routerID.
// Uses indexed lookup on mac + deleted_at (GORM soft delete) and returns early with LIMIT 1.
func (r *blockedDeviceRepository) IsBlocked(ctx context.Context, mac string, routerID string) (*model.BlockedDevice, error) {
	norm := utils.NormalizeMAC(mac)
	if norm == "" {
		return nil, nil
	}
	var entry model.BlockedDevice
	q := r.db.WithContext(ctx).Where("mac = ?", norm)
	if strings.TrimSpace(routerID) != "" {
		q = q.Where("(router_id IS NULL OR router_id = ?)", strings.TrimSpace(routerID))
	} else {
		q = q.Where("router_id IS NULL")
	}
	err := q.Order("created_at DESC").Limit(1).First(&entry).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &entry, nil
}

func (r *blockedDeviceRepository) FindBlockedMACs(ctx context.Context, macs []string) (map[string]model.BlockedDevice, error) {
	result := make(map[string]model.BlockedDevice)
	normalized := make([]string, 0, len(macs))
	seen := make(map[string]struct{}, len(macs))
	for _, m := range macs {
		nm := utils.NormalizeMAC(m)
		if nm == "" {
			continue
		}
		if _, ok := seen[nm]; !ok {
			seen[nm] = struct{}{}
			normalized = append(normalized, nm)
		}
	}
	if len(normalized) == 0 {
		return result, nil
	}
	var rows []model.BlockedDevice
	if err := r.db.WithContext(ctx).Where("mac IN ?", normalized).Order("created_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		if _, exists := result[row.MAC]; !exists {
			result[row.MAC] = row
		}
	}
	return result, nil
}

func (r *blockedDeviceRepository) List(ctx context.Context, filter BlockedDeviceFilter) ([]model.BlockedDevice, int64, error) {
	q := r.db.WithContext(ctx).Model(&model.BlockedDevice{})
	if s := strings.TrimSpace(filter.Search); s != "" {
		pat := likePattern(s)
		q = q.Where("(mac ILIKE ? OR reason ILIKE ? OR blocked_by ILIKE ?)", pat, pat, pat)
	}
	if rid := strings.TrimSpace(filter.RouterID); rid != "" {
		q = q.Where("router_id = ?", rid)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []model.BlockedDevice
	if err := q.
		Order(orderClause("created_at", filter.Order)).
		Limit(filter.PerPage).
		Offset((filter.Page - 1) * filter.PerPage).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (r *blockedDeviceRepository) CountActive(ctx context.Context) (int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&model.BlockedDevice{}).Count(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}
