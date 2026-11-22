package service

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"wifiads/internal/dto"
	"wifiads/internal/model"
	"wifiads/internal/repository"
	"wifiads/pkg/apperror"
	"wifiads/pkg/utils"
)

// PlatformOpsService manages dynamic questionnaire fields/submissions, system settings, and ad watch metrics.
type PlatformOpsService interface {
	ListQuestionnaireFields(ctx context.Context, activeOnly bool) ([]dto.QuestionnaireFieldResponse, error)
	CreateQuestionnaireField(ctx context.Context, actorID, actorName string, req dto.UpsertQuestionnaireFieldRequest) (*dto.QuestionnaireFieldResponse, error)
	UpdateQuestionnaireField(ctx context.Context, actorID, actorName, id string, req dto.UpsertQuestionnaireFieldRequest) (*dto.QuestionnaireFieldResponse, error)
	DeleteQuestionnaireField(ctx context.Context, actorID, actorName, id string) error
	ReorderQuestionnaireFields(ctx context.Context, actorID, actorName string, ids []string) error
	ListQuestionnaireSubmissions(ctx context.Context, query dto.QuestionnaireSubmissionListQuery) ([]dto.QuestionnaireSubmissionResponse, dto.PaginationMeta, error)
	ExportQuestionnaireSubmissionsCSV(ctx context.Context, routerID, mac string) ([]byte, error)

	ListSettings(ctx context.Context) ([]dto.SystemSettingItem, error)
	GetPortalSettingsMap(ctx context.Context) map[string]string
	BulkUpdateSettings(ctx context.Context, actorID, actorName string, req dto.BulkUpdateSettingsRequest) ([]dto.SystemSettingItem, error)

	RecordPortalAdMetrics(ctx context.Context, sessionToken string, req dto.AdWatchMetricsRequest) error
}

type defaultSettingSpec struct {
	Key         string
	Value       string
	Group       string
	Description string
}

var defaultSystemSettings = []defaultSettingSpec{
	{Key: "portal.brand_name", Value: "WiFiAds", Group: "branding", Description: "Nama merek utama yang tampil di Captive Portal"},
	{Key: "portal.welcome_title", Value: "Wi-Fi Gratis Siap Digunakan", Group: "portal", Description: "Judul utama halaman sambutan Captive Portal"},
	{Key: "portal.welcome_subtitle", Value: "Tonton iklan singkat untuk terhubung ke internet cepat.", Group: "portal", Description: "Subjudul halaman sambutan Captive Portal"},
	{Key: "portal.default_redirect_url", Value: "https://www.google.com", Group: "portal", Description: "URL tujuan default setelah berhasil terhubung ke Wi-Fi"},
	{Key: "portal.enable_voucher_redeem", Value: "true", Group: "portal", Description: "Tampilkan tautan 'Punya kode voucher?' di halaman sambutan"},
	{Key: "portal.enable_survey", Value: "true", Group: "portal", Description: "Tampilkan langkah survei pilihan paket setelah iklan"},
	{Key: "portal.ad_fallback_seconds", Value: "15", Group: "system", Description: "Durasi fallback CNA minimum (detik) bila browser gagal memicu event video"},
}

type platformOpsService struct {
	questionnaire repository.QuestionnaireRepository
	settings      repository.SystemSettingRepository
	sessions      repository.PortalSessionRepository
	ads           repository.AdvertisementRepository
	routers       repository.RouterRepository
	audits        repository.AuditLogRepository
}

func NewPlatformOpsService(
	questionnaire repository.QuestionnaireRepository,
	settings repository.SystemSettingRepository,
	sessions repository.PortalSessionRepository,
	ads repository.AdvertisementRepository,
	routers repository.RouterRepository,
	audits repository.AuditLogRepository,
) PlatformOpsService {
	return &platformOpsService{
		questionnaire: questionnaire,
		settings:      settings,
		sessions:      sessions,
		ads:           ads,
		routers:       routers,
		audits:        audits,
	}
}

func (s *platformOpsService) audit(ctx context.Context, actorID, actorName, action, entityType, entityID string, detail any) {
	if s.audits == nil {
		return
	}
	raw, _ := json.Marshal(detail)
	_ = s.audits.Create(ctx, &model.AuditLog{
		ID:         uuid.NewString(),
		ActorID:    actorID,
		ActorName:  actorName,
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		Detail:     string(raw),
		CreatedAt:  time.Now().UTC(),
	})
}

func toFieldResponse(f *model.QuestionnaireField) dto.QuestionnaireFieldResponse {
	var opts []string
	if strings.TrimSpace(f.Options) != "" {
		_ = json.Unmarshal([]byte(f.Options), &opts)
	}
	if opts == nil {
		opts = []string{}
	}
	return dto.QuestionnaireFieldResponse{
		ID:          f.ID,
		Key:         f.Key,
		Label:       f.Label,
		Type:        f.Type,
		Options:     opts,
		Placeholder: f.Placeholder,
		Required:    f.Required,
		SortOrder:   f.SortOrder,
		IsActive:    f.IsActive,
		CreatedAt:   f.CreatedAt,
		UpdatedAt:   f.UpdatedAt,
	}
}

func sanitizeFieldKey(raw string) string {
	raw = strings.ToLower(strings.TrimSpace(raw))
	var b strings.Builder
	for _, r := range raw {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			b.WriteRune(r)
		} else if r == ' ' || r == '-' {
			b.WriteRune('_')
		}
	}
	return strings.Trim(b.String(), "_")
}

func (s *platformOpsService) ListQuestionnaireFields(ctx context.Context, activeOnly bool) ([]dto.QuestionnaireFieldResponse, error) {
	items, err := s.questionnaire.ListFields(ctx, activeOnly)
	if err != nil {
		return nil, err
	}
	out := make([]dto.QuestionnaireFieldResponse, 0, len(items))
	for i := range items {
		out = append(out, toFieldResponse(&items[i]))
	}
	return out, nil
}

func (s *platformOpsService) CreateQuestionnaireField(ctx context.Context, actorID, actorName string, req dto.UpsertQuestionnaireFieldRequest) (*dto.QuestionnaireFieldResponse, error) {
	key := sanitizeFieldKey(req.Key)
	if key == "" {
		return nil, apperror.New(apperror.ErrBadRequest, "key field tidak valid")
	}
	opts := req.Options
	if opts == nil {
		opts = []string{}
	}
	optJSON, _ := json.Marshal(opts)
	now := time.Now().UTC()
	f := &model.QuestionnaireField{
		ID:          uuid.NewString(),
		Key:         key,
		Label:       strings.TrimSpace(req.Label),
		Type:        strings.ToUpper(strings.TrimSpace(req.Type)),
		Options:     string(optJSON),
		Placeholder: strings.TrimSpace(req.Placeholder),
		Required:    req.Required,
		SortOrder:   req.SortOrder,
		IsActive:    req.IsActive,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.questionnaire.CreateField(ctx, f); err != nil {
		return nil, err
	}
	s.audit(ctx, actorID, actorName, "questionnaire.create_field", "questionnaire_field", f.ID, map[string]any{"key": f.Key, "label": f.Label})
	res := toFieldResponse(f)
	return &res, nil
}

func (s *platformOpsService) UpdateQuestionnaireField(ctx context.Context, actorID, actorName, id string, req dto.UpsertQuestionnaireFieldRequest) (*dto.QuestionnaireFieldResponse, error) {
	f, err := s.questionnaire.FindFieldByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if k := sanitizeFieldKey(req.Key); k != "" {
		f.Key = k
	}
	opts := req.Options
	if opts == nil {
		opts = []string{}
	}
	optJSON, _ := json.Marshal(opts)
	f.Label = strings.TrimSpace(req.Label)
	f.Type = strings.ToUpper(strings.TrimSpace(req.Type))
	f.Options = string(optJSON)
	f.Placeholder = strings.TrimSpace(req.Placeholder)
	f.Required = req.Required
	f.SortOrder = req.SortOrder
	f.IsActive = req.IsActive
	f.UpdatedAt = time.Now().UTC()

	if err := s.questionnaire.UpdateField(ctx, f); err != nil {
		return nil, err
	}
	s.audit(ctx, actorID, actorName, "questionnaire.update_field", "questionnaire_field", f.ID, map[string]any{"key": f.Key, "label": f.Label})
	res := toFieldResponse(f)
	return &res, nil
}

func (s *platformOpsService) DeleteQuestionnaireField(ctx context.Context, actorID, actorName, id string) error {
	if _, err := s.questionnaire.FindFieldByID(ctx, id); err != nil {
		return err
	}
	if err := s.questionnaire.DeleteField(ctx, id); err != nil {
		return err
	}
	s.audit(ctx, actorID, actorName, "questionnaire.delete_field", "questionnaire_field", id, map[string]any{"id": id})
	return nil
}

func (s *platformOpsService) ReorderQuestionnaireFields(ctx context.Context, actorID, actorName string, ids []string) error {
	if err := s.questionnaire.ReorderFields(ctx, ids); err != nil {
		return err
	}
	s.audit(ctx, actorID, actorName, "questionnaire.reorder", "questionnaire_field", "", map[string]any{"count": len(ids)})
	return nil
}

func (s *platformOpsService) ListQuestionnaireSubmissions(ctx context.Context, query dto.QuestionnaireSubmissionListQuery) ([]dto.QuestionnaireSubmissionResponse, dto.PaginationMeta, error) {
	page, perPage, _ := utils.NormalizePage(query.Page, query.PerPage)
	rows, total, err := s.questionnaire.ListSubmissions(ctx, repository.QuestionnaireSubmissionFilter{
		Page:     page,
		PerPage:  perPage,
		RouterID: query.RouterID,
		MAC:      query.MAC,
		Search:   query.Search,
		Order:    query.Order,
	})
	if err != nil {
		return nil, dto.PaginationMeta{}, err
	}
	routerMap := make(map[string]string)
	if s.routers != nil {
		if rList, rErr := s.routers.ListActive(ctx); rErr == nil {
			for _, r := range rList {
				routerMap[r.ID] = r.Name
			}
		}
	}
	out := make([]dto.QuestionnaireSubmissionResponse, 0, len(rows))
	for _, r := range rows {
		ans := map[string]string{}
		_ = json.Unmarshal([]byte(r.Answers), &ans)
		out = append(out, dto.QuestionnaireSubmissionResponse{
			ID:              r.ID,
			PortalSessionID: r.PortalSessionID,
			RouterID:        r.RouterID,
			RouterName:      routerMap[r.RouterID],
			MAC:             r.MAC,
			Answers:         ans,
			CreatedAt:       r.CreatedAt,
		})
	}
	return out, dto.PaginationMeta{
		CurrentPage: page,
		PerPage:     perPage,
		TotalItems:  total,
		TotalPages:  utils.TotalPages(total, perPage),
	}, nil
}

func (s *platformOpsService) ExportQuestionnaireSubmissionsCSV(ctx context.Context, routerID, mac string) ([]byte, error) {
	rows, err := s.questionnaire.ExportSubmissions(ctx, routerID, mac, 5000)
	if err != nil {
		return nil, err
	}
	keySet := make(map[string]struct{})
	parsed := make([]map[string]string, len(rows))
	for i, r := range rows {
		m := map[string]string{}
		_ = json.Unmarshal([]byte(r.Answers), &m)
		parsed[i] = m
		for k := range m {
			keySet[k] = struct{}{}
		}
	}
	keys := make([]string, 0, len(keySet))
	for k := range keySet {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	header := append([]string{"created_at", "router_id", "mac"}, keys...)
	_ = w.Write(header)
	for i, r := range rows {
		rec := []string{r.CreatedAt.Format(time.RFC3339), r.RouterID, r.MAC}
		for _, k := range keys {
			rec = append(rec, parsed[i][k])
		}
		_ = w.Write(rec)
	}
	w.Flush()
	return buf.Bytes(), w.Error()
}

func (s *platformOpsService) ListSettings(ctx context.Context) ([]dto.SystemSettingItem, error) {
	stored, err := s.settings.ListAll(ctx)
	if err != nil {
		return nil, err
	}
	byKey := make(map[string]model.SystemSetting, len(stored))
	for _, st := range stored {
		byKey[st.Key] = st
	}
	out := make([]dto.SystemSettingItem, 0, len(defaultSystemSettings)+len(stored))
	seen := make(map[string]struct{}, len(defaultSystemSettings))
	for _, spec := range defaultSystemSettings {
		seen[spec.Key] = struct{}{}
		if st, ok := byKey[spec.Key]; ok {
			desc := st.Description
			if desc == "" {
				desc = spec.Description
			}
			grp := st.Group
			if grp == "" {
				grp = spec.Group
			}
			out = append(out, dto.SystemSettingItem{
				Key:         st.Key,
				Value:       st.Value,
				Group:       grp,
				Description: desc,
				UpdatedAt:   st.UpdatedAt,
			})
		} else {
			out = append(out, dto.SystemSettingItem{
				Key:         spec.Key,
				Value:       spec.Value,
				Group:       spec.Group,
				Description: spec.Description,
			})
		}
	}
	for _, st := range stored {
		if _, ok := seen[st.Key]; ok {
			continue
		}
		out = append(out, dto.SystemSettingItem{
			Key:         st.Key,
			Value:       st.Value,
			Group:       st.Group,
			Description: st.Description,
			UpdatedAt:   st.UpdatedAt,
		})
	}
	return out, nil
}

func (s *platformOpsService) GetPortalSettingsMap(ctx context.Context) map[string]string {
	out := make(map[string]string, len(defaultSystemSettings))
	for _, spec := range defaultSystemSettings {
		out[spec.Key] = spec.Value
	}
	if s.settings == nil {
		return out
	}
	if dbMap, err := s.settings.GetMap(ctx); err == nil {
		for k, v := range dbMap {
			if strings.TrimSpace(v) != "" || strings.HasPrefix(k, "portal.enable_") {
				out[k] = v
			}
		}
	}
	return out
}

func (s *platformOpsService) BulkUpdateSettings(ctx context.Context, actorID, actorName string, req dto.BulkUpdateSettingsRequest) ([]dto.SystemSettingItem, error) {
	specMap := make(map[string]defaultSettingSpec, len(defaultSystemSettings))
	for _, sp := range defaultSystemSettings {
		specMap[sp.Key] = sp
	}
	toSave := make([]model.SystemSetting, 0, len(req.Settings))
	for k, v := range req.Settings {
		key := strings.TrimSpace(k)
		if key == "" {
			continue
		}
		grp := "portal"
		desc := ""
		if sp, ok := specMap[key]; ok {
			grp = sp.Group
			desc = sp.Description
		}
		toSave = append(toSave, model.SystemSetting{
			Key:         key,
			Value:       strings.TrimSpace(v),
			Group:       grp,
			Description: desc,
		})
	}
	if err := s.settings.UpsertBulk(ctx, toSave); err != nil {
		return nil, err
	}
	s.audit(ctx, actorID, actorName, "settings.update", "system_setting", "", map[string]any{
		"keys_updated": len(toSave),
	})
	return s.ListSettings(ctx)
}

func (s *platformOpsService) RecordPortalAdMetrics(ctx context.Context, sessionToken string, req dto.AdWatchMetricsRequest) error {
	if s.sessions == nil || s.ads == nil {
		return nil
	}
	tok := strings.TrimSpace(sessionToken)
	if tok == "" || tok == "auto-resume" {
		return nil
	}
	sess, err := s.sessions.FindByTokenHash(ctx, utils.HashToken(tok))
	if err != nil {
		return err
	}
	if sess.AdvertisementID == nil || *sess.AdvertisementID == "" {
		return nil
	}
	return s.ads.RecordWatchMetrics(ctx, *sess.AdvertisementID, req.Completed, req.WatchSeconds)
}
