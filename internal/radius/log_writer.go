package radius

import (
	"log/slog"
	"strings"
)

// slogWriter routes the RADIUS library's internal log output into slog.
type slogWriter struct {
	logger *slog.Logger
}

func newSlogWriter(logger *slog.Logger) *slogWriter {
	return &slogWriter{logger: logger}
}

func (w *slogWriter) Write(p []byte) (int, error) {
	message := strings.TrimSpace(string(p))
	if message != "" {
		w.logger.Warn("radius library", slog.String("message", message))
	}
	return len(p), nil
}
