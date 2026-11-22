package repository

import (
	"context"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"wifiads/internal/model"
)

type SystemSettingRepository interface {
	ListAll(ctx context.Context) ([]model.SystemSetting, error)
	GetMap(ctx context.Context) (map[string]string, error)
	UpsertBulk(ctx context.Context, items []model.SystemSetting) error
}

type systemSettingRepository struct {
	db *gorm.DB
}

func NewSystemSettingRepository(db *gorm.DB) SystemSettingRepository {
	return &systemSettingRepository{db: db}
}

func (r *systemSettingRepository) ListAll(ctx context.Context) ([]model.SystemSetting, error) {
	var rows []model.SystemSetting
	if err := r.db.WithContext(ctx).Order("\"group\" ASC, key ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *systemSettingRepository) GetMap(ctx context.Context) (map[string]string, error) {
	rows, err := r.ListAll(ctx)
	if err != nil {
		return nil, err
	}
	out := make(map[string]string, len(rows))
	for _, row := range rows {
		out[row.Key] = row.Value
	}
	return out, nil
}

func (r *systemSettingRepository) UpsertBulk(ctx context.Context, items []model.SystemSetting) error {
	if len(items) == 0 {
		return nil
	}
	now := time.Now().UTC()
	for i := range items {
		items[i].UpdatedAt = now
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "key"}},
			DoUpdates: clause.AssignmentColumns([]string{"value", "group", "description", "updated_at"}),
		}).Create(&items).Error
	})
}
