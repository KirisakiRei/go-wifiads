package media

import (
	"context"
	"testing"
)

func TestProcessVideoGracefulFallbackOnInvalidBytes(t *testing.T) {
	raw := []byte("not-a-real-video-stream")
	res, err := ProcessVideo(context.Background(), raw, ".mp4", 60)
	if err != nil {
		t.Fatalf("expected graceful fallback without fatal error, got: %v", err)
	}
	if len(res.VideoBytes) != len(raw) {
		t.Fatalf("expected original bytes returned on fallback")
	}
	if res.ContentType != "video/mp4" {
		t.Fatalf("expected video/mp4, got %s", res.ContentType)
	}
}
