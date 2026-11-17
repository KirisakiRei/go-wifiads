package router

import (
	"fmt"
	"html/template"
	"time"
)

// templateFuncs are the small helpers the admin templates rely on.
func templateFuncs() template.FuncMap {
	return template.FuncMap{
		"ts":       formatTimestamp,
		"duration": formatDuration,
		"octets":   formatOctets,
		"add":      func(a, b int) int { return a + b },
		"sub":      func(a, b int) int { return a - b },
	}
}

func formatTimestamp(value any) string {
	var moment time.Time
	switch typed := value.(type) {
	case time.Time:
		moment = typed
	case *time.Time:
		if typed == nil {
			return "-"
		}
		moment = *typed
	default:
		return "-"
	}
	if moment.IsZero() {
		return "-"
	}
	return moment.UTC().Format("02 Jan 2006 15:04:05 UTC")
}

func formatDuration(value any) string {
	var seconds int64
	switch typed := value.(type) {
	case int:
		seconds = int64(typed)
	case int64:
		seconds = typed
	case int32:
		seconds = int64(typed)
	default:
		return "-"
	}
	if seconds <= 0 {
		return "-"
	}
	hours := seconds / 3600
	minutes := (seconds % 3600) / 60
	remaining := seconds % 60
	if hours > 0 {
		return fmt.Sprintf("%dj %dm %ds", hours, minutes, remaining)
	}
	if minutes > 0 {
		return fmt.Sprintf("%dm %ds", minutes, remaining)
	}
	return fmt.Sprintf("%ds", remaining)
}

func formatOctets(value int64) string {
	const unit = 1024
	if value < unit {
		return fmt.Sprintf("%d B", value)
	}
	div, exp := int64(unit), 0
	for n := value / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(value)/float64(div), "KMGTPE"[exp])
}
