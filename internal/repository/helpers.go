package repository

import (
	"errors"
	"strings"

	"gorm.io/gorm"

	"wifiads/pkg/apperror"
)

// translateNotFound maps GORM's sentinel onto the application error.
func translateNotFound(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return apperror.ErrNotFound
	}
	return err
}

// isUniqueViolation detects a PostgreSQL unique constraint violation (23505).
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	message := err.Error()
	return strings.Contains(message, "23505") || strings.Contains(message, "duplicate key value")
}

// likePattern builds a case-insensitive contains pattern for ILIKE.
func likePattern(search string) string {
	return "%" + strings.TrimSpace(search) + "%"
}

// orderClause maps a whitelisted sort direction onto a fixed column.
func orderClause(column, direction string) string {
	if strings.EqualFold(direction, "asc") {
		return column + " ASC"
	}
	return column + " DESC"
}
