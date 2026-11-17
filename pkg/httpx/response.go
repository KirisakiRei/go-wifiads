package httpx

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Response is the single response envelope used by every JSON endpoint.
type Response struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
	Meta    any    `json:"meta,omitempty"`
	Error   string `json:"error,omitempty"`
	Details any    `json:"details,omitempty"`
}

// OK writes a 200 response.
func OK(c *gin.Context, message string, data any) {
	c.JSON(http.StatusOK, Response{
		Success: true,
		Message: message,
		Data:    data,
	})
}

// Created writes a 201 response.
func Created(c *gin.Context, message string, data any) {
	c.JSON(http.StatusCreated, Response{
		Success: true,
		Message: message,
		Data:    data,
	})
}

// Paginated writes a 200 response carrying pagination metadata.
func Paginated(c *gin.Context, message string, data any, meta any) {
	c.JSON(http.StatusOK, Response{
		Success: true,
		Message: message,
		Data:    data,
		Meta:    meta,
	})
}

// Error writes a failure response with the standardized envelope.
func Error(c *gin.Context, httpStatus int, errCode string, message string, details any) {
	c.JSON(httpStatus, Response{
		Success: false,
		Message: message,
		Error:   errCode,
		Details: details,
	})
}
