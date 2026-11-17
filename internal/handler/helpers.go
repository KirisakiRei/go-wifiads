package handler

import (
	"github.com/gin-gonic/gin"

	"wifiads/pkg/apperror"
	"wifiads/pkg/httpx"
)

// writeError maps a domain error onto the standard error envelope.
func writeError(c *gin.Context, err error) {
	status, code := apperror.MapHTTPStatus(err)
	httpx.Error(c, status, code, err.Error(), apperror.Details(err))
}

// bindJSON binds and validates a JSON body, writing a 400 on failure.
func bindJSON(c *gin.Context, target any, message string) bool {
	if err := c.ShouldBindJSON(target); err != nil {
		httpx.Error(c, 400, "BAD_REQUEST", message, err.Error())
		return false
	}
	return true
}

// bindQuery binds and validates query parameters, writing a 400 on failure.
func bindQuery(c *gin.Context, target any, message string) bool {
	if err := c.ShouldBindQuery(target); err != nil {
		httpx.Error(c, 400, "BAD_REQUEST", message, err.Error())
		return false
	}
	return true
}
