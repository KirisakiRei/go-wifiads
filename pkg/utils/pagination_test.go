package utils

import "testing"

func TestNormalizePage(t *testing.T) {
	page, perPage, offset := NormalizePage(3, 20)
	if page != 3 || perPage != 20 || offset != 40 {
		t.Fatalf("unexpected values: %d %d %d", page, perPage, offset)
	}

	page, perPage, offset = NormalizePage(0, 1000)
	if page != DefaultPage || perPage != MaxPerPage || offset != 0 {
		t.Fatalf("unexpected clamped values: %d %d %d", page, perPage, offset)
	}
}

func TestTotalPages(t *testing.T) {
	if got := TotalPages(0, 20); got != 0 {
		t.Fatalf("expected 0 pages, got %d", got)
	}
	if got := TotalPages(41, 20); got != 3 {
		t.Fatalf("expected 3 pages, got %d", got)
	}
}
