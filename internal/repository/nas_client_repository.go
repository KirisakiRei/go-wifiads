package repository

import (
	"context"
	"strings"
	"time"

	"gorm.io/gorm"

	"wifiads/internal/model"
	"wifiads/pkg/apperror"
)

type nasClientRepository struct {
	db *gorm.DB
}

// NewNASClientRepository builds the RADIUS client repository.
func NewNASClientRepository(db *gorm.DB) NASClientRepository {
	return &nasClientRepository{db: db}
}

func (r *nasClientRepository) Create(ctx context.Context, client *model.NASClient) error {
	if err := r.db.WithContext(ctx).Create(client).Error; err != nil {
		if isUniqueViolation(err) {
			return apperror.ErrAlreadyExists
		}
		return err
	}
	return nil
}

func (r *nasClientRepository) UpsertForRouter(ctx context.Context, client *model.NASClient) error {
	var existing model.NASClient
	err := r.db.WithContext(ctx).Where("router_id = ? OR nas_identifier = ?", client.RouterID, client.NASIdentifier).First(&existing).Error
	if err != nil {
		if translateNotFound(err) == apperror.ErrNotFound {
			return r.Create(ctx, client)
		}
		return err
	}
	updates := map[string]any{
		"router_id":         client.RouterID,
		"site_id":           client.SiteID,
		"name":              client.Name,
		"nas_identifier":    client.NASIdentifier,
		"ip_address":        client.IPAddress,
		"secret_ciphertext": client.SecretCiphertext,
		"is_active":         client.IsActive,
		"updated_at":        client.UpdatedAt,
	}
	return r.db.WithContext(ctx).Model(&existing).Updates(updates).Error
}

func (r *nasClientRepository) FindByRouterID(ctx context.Context, routerID string) (*model.NASClient, error) {
	var client model.NASClient
	if err := r.db.WithContext(ctx).Where("router_id = ?", routerID).First(&client).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &client, nil
}

func (r *nasClientRepository) ListAll(ctx context.Context) ([]model.NASClient, error) {
	var clients []model.NASClient
	if err := r.db.WithContext(ctx).Order("created_at ASC").Find(&clients).Error; err != nil {
		return nil, err
	}
	return clients, nil
}

func (r *nasClientRepository) FindByIP(ctx context.Context, ipAddress string) (*model.NASClient, error) {
	var client model.NASClient
	if err := r.db.WithContext(ctx).Where("ip_address = ?", ipAddress).First(&client).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &client, nil
}

func (r *nasClientRepository) FindByNASIdentifier(ctx context.Context, nasIdentifier string) (*model.NASClient, error) {
	var client model.NASClient
	if err := r.db.WithContext(ctx).Where("nas_identifier = ?", nasIdentifier).First(&client).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &client, nil
}

func (r *nasClientRepository) Count(ctx context.Context) (int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&model.NASClient{}).Count(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}

func (r *nasClientRepository) DeactivateByRouterID(ctx context.Context, routerID string) error {
	return r.db.WithContext(ctx).Model(&model.NASClient{}).Where("router_id = ?", routerID).Update("is_active", false).Error
}

type advertisementRepository struct {
	db *gorm.DB
}

// NewAdvertisementRepository builds the advertisement repository.
func NewAdvertisementRepository(db *gorm.DB) AdvertisementRepository {
	return &advertisementRepository{db: db}
}

func (r *advertisementRepository) Create(ctx context.Context, ad *model.Advertisement) error {
	return r.db.WithContext(ctx).Create(ad).Error
}

func (r *advertisementRepository) FindByID(ctx context.Context, id string) (*model.Advertisement, error) {
	var ad model.Advertisement
	if err := r.db.WithContext(ctx).Where("id = ? AND advertiser_id IS NULL", id).First(&ad).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &ad, nil
}

func (r *advertisementRepository) FindActive(ctx context.Context) (*model.Advertisement, error) {
	var ad model.Advertisement
	if err := r.db.WithContext(ctx).
		Where("advertiser_id IS NULL AND is_active = ?", true).
		Order("sort_order ASC, created_at ASC").
		First(&ad).Error; err != nil {
		return nil, translateNotFound(err)
	}
	return &ad, nil
}

func (r *advertisementRepository) List(ctx context.Context) ([]model.Advertisement, error) {
	var ads []model.Advertisement
	if err := r.db.WithContext(ctx).
		Where("advertiser_id IS NULL").
		Order("sort_order ASC, created_at ASC").
		Find(&ads).Error; err != nil {
		return nil, err
	}
	return ads, nil
}

func (r *advertisementRepository) Update(ctx context.Context, ad *model.Advertisement) error {
	return r.db.WithContext(ctx).Save(ad).Error
}

func (r *advertisementRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ? AND advertiser_id IS NULL", id).Delete(&model.Advertisement{}).Error
}

func (r *advertisementRepository) Count(ctx context.Context) (int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&model.Advertisement{}).Count(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}

func (r *advertisementRepository) RecordWatchMetrics(ctx context.Context, adID string, completed bool, watchSeconds int) error {
	if adID == "" {
		return nil
	}
	updates := map[string]any{}
	if completed {
		updates["completions_count"] = gorm.Expr("completions_count + 1")
	}
	if watchSeconds > 0 {
		updates["total_watch_seconds"] = gorm.Expr("total_watch_seconds + ?", watchSeconds)
	}
	if len(updates) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Model(&model.Advertisement{}).Where("id = ?", adID).Updates(updates).Error
}

type auditLogRepository struct {
	db *gorm.DB
}

// NewAuditLogRepository builds the audit trail repository.
func NewAuditLogRepository(db *gorm.DB) AuditLogRepository {
	return &auditLogRepository{db: db}
}

func (r *auditLogRepository) Create(ctx context.Context, entry *model.AuditLog) error {
	return r.db.WithContext(ctx).Create(entry).Error
}

func (r *auditLogRepository) List(ctx context.Context, filter AuditLogFilter) ([]model.AuditLog, int64, error) {
	q := r.db.WithContext(ctx).Model(&model.AuditLog{})
	if v := strings.TrimSpace(filter.Action); v != "" {
		q = q.Where("action = ?", v)
	}
	if v := strings.TrimSpace(filter.EntityType); v != "" {
		q = q.Where("entity_type = ?", v)
	}
	if v := strings.TrimSpace(filter.ActorName); v != "" {
		q = q.Where("actor_name ILIKE ?", likePattern(v))
	}
	if v := strings.TrimSpace(filter.Search); v != "" {
		pat := likePattern(v)
		q = q.Where("(action ILIKE ? OR entity_type ILIKE ? OR entity_id ILIKE ? OR actor_name ILIKE ? OR detail ILIKE ?)", pat, pat, pat, pat, pat)
	}
	if filter.DateFrom != nil {
		q = q.Where("created_at >= ?", *filter.DateFrom)
	}
	if filter.DateTo != nil {
		q = q.Where("created_at <= ?", *filter.DateTo)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []model.AuditLog
	if err := q.
		Order(orderClause("created_at", filter.Order)).
		Limit(filter.PerPage).
		Offset((filter.Page - 1) * filter.PerPage).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (r *auditLogRepository) DistinctFilters(ctx context.Context) ([]string, []string, error) {
	var actions []string
	if err := r.db.WithContext(ctx).Model(&model.AuditLog{}).
		Distinct("action").Where("action <> ''").Order("action ASC").Pluck("action", &actions).Error; err != nil {
		return nil, nil, err
	}
	var entities []string
	if err := r.db.WithContext(ctx).Model(&model.AuditLog{}).
		Distinct("entity_type").Where("entity_type <> ''").Order("entity_type ASC").Pluck("entity_type", &entities).Error; err != nil {
		return nil, nil, err
	}
	return actions, entities, nil
}

func (r *auditLogRepository) CleanupOlderThan(ctx context.Context, cutoff time.Time) (int64, error) {
	res := r.db.WithContext(ctx).Where("created_at < ?", cutoff).Delete(&model.AuditLog{})
	return res.RowsAffected, res.Error
}
