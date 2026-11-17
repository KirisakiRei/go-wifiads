package apperror

import (
	"errors"
	"net/http"
)

// Sentinel errors. Business layers return these (wrapped or as-is) so the HTTP
// layer can map them to a status code without knowing transport details.
var (
	ErrNotFound           = errors.New("resource not found")
	ErrAlreadyExists      = errors.New("resource already exists")
	ErrUnauthorized       = errors.New("unauthorized access")
	ErrForbidden          = errors.New("forbidden resource")
	ErrBadRequest         = errors.New("invalid request payload")
	ErrConflict           = errors.New("resource conflict")
	ErrTooManyRequests    = errors.New("too many requests")
	ErrInternalServer     = errors.New("internal server error")
	ErrServiceUnavailable = errors.New("service temporarily unavailable")
)

// Error carries a client-safe message while still matching its sentinel with
// errors.Is, plus optional details for the response envelope.
type Error struct {
	Kind    error
	Message string
	Details any
}

func (e *Error) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return e.Kind.Error()
}

func (e *Error) Unwrap() error {
	return e.Kind
}

// New builds an application error with a custom message.
func New(kind error, message string) *Error {
	return &Error{Kind: kind, Message: message}
}

// WithDetails builds an application error with a custom message and details.
func WithDetails(kind error, message string, details any) *Error {
	return &Error{Kind: kind, Message: message, Details: details}
}

// Details extracts details from an application error, if any.
func Details(err error) any {
	var appErr *Error
	if errors.As(err, &appErr) {
		return appErr.Details
	}
	return nil
}

// MapHTTPStatus converts a domain error into an HTTP status code and error code.
func MapHTTPStatus(err error) (int, string) {
	switch {
	case errors.Is(err, ErrNotFound):
		return http.StatusNotFound, "NOT_FOUND"
	case errors.Is(err, ErrAlreadyExists):
		return http.StatusConflict, "ALREADY_EXISTS"
	case errors.Is(err, ErrUnauthorized):
		return http.StatusUnauthorized, "UNAUTHORIZED"
	case errors.Is(err, ErrForbidden):
		return http.StatusForbidden, "FORBIDDEN"
	case errors.Is(err, ErrBadRequest):
		return http.StatusBadRequest, "BAD_REQUEST"
	case errors.Is(err, ErrConflict):
		return http.StatusConflict, "CONFLICT"
	case errors.Is(err, ErrTooManyRequests):
		return http.StatusTooManyRequests, "TOO_MANY_REQUESTS"
	case errors.Is(err, ErrServiceUnavailable):
		return http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE"
	default:
		return http.StatusInternalServerError, "INTERNAL_SERVER_ERROR"
	}
}
