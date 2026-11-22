package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wifiads/internal/dto"
	"wifiads/internal/middleware"
	"wifiads/internal/service"
	"wifiads/pkg/httpx"
)

// PlatformOpsHandler exposes admin questionnaire, system settings, and portal ad-metrics endpoints.
type PlatformOpsHandler struct {
	ops service.PlatformOpsService
}

func NewPlatformOpsHandler(ops service.PlatformOpsService) *PlatformOpsHandler {
	return &PlatformOpsHandler{ops: ops}
}

func (h *PlatformOpsHandler) ListQuestionnaireFields(c *gin.Context) {
	items, err := h.ops.ListQuestionnaireFields(c.Request.Context(), false)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Questionnaire fields retrieved", items)
}

func (h *PlatformOpsHandler) CreateQuestionnaireField(c *gin.Context) {
	var req dto.UpsertQuestionnaireFieldRequest
	if !bindJSON(c, &req, "Invalid questionnaire field payload") {
		return
	}
	item, err := h.ops.CreateQuestionnaireField(
		c.Request.Context(),
		middleware.AdminID(c),
		middleware.AdminUsername(c),
		req,
	)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Created(c, "Field kuesioner berhasil dibuat", item)
}

func (h *PlatformOpsHandler) UpdateQuestionnaireField(c *gin.Context) {
	var req dto.UpsertQuestionnaireFieldRequest
	if !bindJSON(c, &req, "Invalid questionnaire field payload") {
		return
	}
	item, err := h.ops.UpdateQuestionnaireField(
		c.Request.Context(),
		middleware.AdminID(c),
		middleware.AdminUsername(c),
		c.Param("id"),
		req,
	)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Field kuesioner berhasil diperbarui", item)
}

func (h *PlatformOpsHandler) DeleteQuestionnaireField(c *gin.Context) {
	if err := h.ops.DeleteQuestionnaireField(
		c.Request.Context(),
		middleware.AdminID(c),
		middleware.AdminUsername(c),
		c.Param("id"),
	); err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Field kuesioner berhasil dihapus", nil)
}

func (h *PlatformOpsHandler) ReorderQuestionnaireFields(c *gin.Context) {
	var req dto.ReorderQuestionnaireFieldsRequest
	if !bindJSON(c, &req, "Invalid reorder payload") {
		return
	}
	if err := h.ops.ReorderQuestionnaireFields(
		c.Request.Context(),
		middleware.AdminID(c),
		middleware.AdminUsername(c),
		req.IDs,
	); err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Urutan kuesioner diperbarui", nil)
}

func (h *PlatformOpsHandler) ListQuestionnaireSubmissions(c *gin.Context) {
	var query dto.QuestionnaireSubmissionListQuery
	if !bindQuery(c, &query, "Invalid submissions query") {
		return
	}
	items, meta, err := h.ops.ListQuestionnaireSubmissions(c.Request.Context(), query)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.Paginated(c, "Jawaban kuesioner retrieved", items, meta)
}

func (h *PlatformOpsHandler) ExportQuestionnaireSubmissions(c *gin.Context) {
	csvBytes, err := h.ops.ExportQuestionnaireSubmissionsCSV(
		c.Request.Context(),
		c.Query("router_id"),
		c.Query("mac"),
	)
	if err != nil {
		writeError(c, err)
		return
	}
	c.Header("Content-Disposition", `attachment; filename="questionnaire-submissions.csv"`)
	c.Data(http.StatusOK, "text/csv; charset=utf-8", csvBytes)
}

func (h *PlatformOpsHandler) ListSettings(c *gin.Context) {
	items, err := h.ops.ListSettings(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Pengaturan sistem retrieved", items)
}

func (h *PlatformOpsHandler) BulkUpdateSettings(c *gin.Context) {
	var req dto.BulkUpdateSettingsRequest
	if !bindJSON(c, &req, "Invalid settings payload") {
		return
	}
	items, err := h.ops.BulkUpdateSettings(
		c.Request.Context(),
		middleware.AdminID(c),
		middleware.AdminUsername(c),
		req,
	)
	if err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Pengaturan berhasil disimpan", items)
}

// RecordPortalAdMetrics records video/ad completion and watch seconds from the captive portal.
func (h *PlatformOpsHandler) RecordPortalAdMetrics(c *gin.Context) {
	var req dto.AdWatchMetricsRequest
	if !bindJSON(c, &req, "Invalid ad metrics payload") {
		return
	}
	if err := h.ops.RecordPortalAdMetrics(c.Request.Context(), c.Param("token"), req); err != nil {
		writeError(c, err)
		return
	}
	httpx.OK(c, "Ad metrics recorded", nil)
}
