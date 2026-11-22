package media

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// ErrVideoTooLong is returned when ffprobe detects a clip exceeding the configured maximum duration.
var ErrVideoTooLong = errors.New("durasi video melebihi batas maksimal")

// ProcessedVideo contains the (optionally transcoded) video payload and extracted poster JPEG.
type ProcessedVideo struct {
	VideoBytes      []byte
	Ext             string
	ContentType     string
	PosterBytes     []byte
	DurationSeconds int
	Transcoded      bool
}

// ProcessVideo validates duration (via ffprobe) and transcodes to mobile-friendly 720p H.264/AAC +faststart
// with a 1-second JPG poster thumbnail (via ffmpeg). When ffmpeg/ffprobe are unavailable on the host,
// it logs a warning and gracefully falls back to the original uploaded bytes.
func ProcessVideo(ctx context.Context, input []byte, origExt string, maxDurationSec int) (*ProcessedVideo, error) {
	ext := strings.ToLower(strings.TrimSpace(origExt))
	if ext == "" {
		ext = ".mp4"
	}
	res := &ProcessedVideo{
		VideoBytes:  input,
		Ext:         ext,
		ContentType: contentTypeForVideoExt(ext),
		Transcoded:  false,
	}

	ffprobePath, probeErr := exec.LookPath("ffprobe")
	ffmpegPath, ffErr := exec.LookPath("ffmpeg")
	if probeErr != nil && ffErr != nil {
		slog.Warn("ffmpeg/ffprobe unavailable; skipping video transcode and keeping original upload")
		return res, nil
	}

	tmpDir, err := os.MkdirTemp("", "wifiads-media-*")
	if err != nil {
		slog.Warn("failed to create temp dir for video processing", slog.String("error", err.Error()))
		return res, nil
	}
	defer os.RemoveAll(tmpDir)

	inPath := filepath.Join(tmpDir, "input"+ext)
	if err := os.WriteFile(inPath, input, 0o600); err != nil {
		slog.Warn("failed to write temp input video", slog.String("error", err.Error()))
		return res, nil
	}

	// 1. Probe actual duration when ffprobe is present.
	if probeErr == nil {
		pCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		dur, dErr := probeDuration(pCtx, ffprobePath, inPath)
		cancel()
		if dErr == nil && dur > 0 {
			rounded := int(math.Round(dur))
			if rounded < 1 {
				rounded = 1
			}
			res.DurationSeconds = rounded
			if maxDurationSec > 0 && dur > float64(maxDurationSec)+1.0 {
				return nil, fmt.Errorf("%w (%d detik, maksimal %d detik)", ErrVideoTooLong, rounded, maxDurationSec)
			}
		} else if dErr != nil {
			slog.Warn("ffprobe failed; continuing without duration check", slog.String("error", dErr.Error()))
		}
	}

	if ffErr != nil {
		slog.Warn("ffmpeg unavailable; keeping original video without transcode")
		return res, nil
	}

	// 2. Transcode to 720p H.264 + AAC + faststart for iOS/Android CNA compatibility.
	outPath := filepath.Join(tmpDir, "output.mp4")
	tCtx, tCancel := context.WithTimeout(ctx, 90*time.Second)
	defer tCancel()
	cmd := exec.CommandContext(
		tCtx,
		ffmpegPath,
		"-y",
		"-i", inPath,
		"-vf", "scale='min(1280,iw)':-2",
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-crf", "24",
		"-pix_fmt", "yuv420p",
		"-c:a", "aac",
		"-b:a", "96k",
		"-movflags", "+faststart",
		outPath,
	)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		slog.Warn("ffmpeg transcode failed; falling back to original file",
			slog.String("error", err.Error()),
			slog.String("stderr", truncate(stderr.String(), 240)),
		)
	} else if outBytes, rErr := os.ReadFile(outPath); rErr == nil && len(outBytes) > 0 {
		res.VideoBytes = outBytes
		res.Ext = ".mp4"
		res.ContentType = "video/mp4"
		res.Transcoded = true
	}

	// 3. Extract poster JPG thumbnail at 1s (fallback to 0s for short clips).
	posterPath := filepath.Join(tmpDir, "poster.jpg")
	seekAt := "00:00:01"
	if res.DurationSeconds > 0 && res.DurationSeconds < 2 {
		seekAt = "00:00:00"
	}
	pCtx, pCancel := context.WithTimeout(ctx, 20*time.Second)
	defer pCancel()
	posterSrc := inPath
	if res.Transcoded {
		posterSrc = outPath
	}
	pCmd := exec.CommandContext(
		pCtx,
		ffmpegPath,
		"-y",
		"-ss", seekAt,
		"-i", posterSrc,
		"-vframes", "1",
		"-vf", "scale='min(720,iw)':-2",
		"-q:v", "4",
		posterPath,
	)
	if err := pCmd.Run(); err == nil {
		if pBytes, rErr := os.ReadFile(posterPath); rErr == nil && len(pBytes) > 0 {
			res.PosterBytes = pBytes
		}
	}

	return res, nil
}

func probeDuration(ctx context.Context, ffprobePath, filePath string) (float64, error) {
	cmd := exec.CommandContext(
		ctx,
		ffprobePath,
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		filePath,
	)
	out, err := cmd.Output()
	if err != nil {
		return 0, err
	}
	raw := strings.TrimSpace(string(out))
	if raw == "" || raw == "N/A" {
		return 0, nil
	}
	return strconv.ParseFloat(raw, 64)
}

func contentTypeForVideoExt(ext string) string {
	switch ext {
	case ".webm":
		return "video/webm"
	case ".mov":
		return "video/quicktime"
	case ".ogg":
		return "video/ogg"
	default:
		return "video/mp4"
	}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}
