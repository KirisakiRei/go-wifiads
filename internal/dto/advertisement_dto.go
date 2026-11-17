package dto

import "time"

// AdvertisementResponse represents an ad entity returned to the frontend.
type AdvertisementResponse struct {
	ID              string    `json:"id"`
	Title           string    `json:"title"`
	Body            string    `json:"body"`
	ImageURL        string    `json:"image_url"`
	MediaType       string    `json:"media_type"`
	LayoutMode      string    `json:"layout_mode"`
	DurationSeconds int       `json:"duration_seconds"`
	SortOrder       int       `json:"sort_order"`
	IsActive        bool      `json:"is_active"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// CreateAdvertisementRequest carries fields to register a new advertisement.
type CreateAdvertisementRequest struct {
	Title           string `json:"title" binding:"required,min=2,max=150"`
	Body            string `json:"body"`
	ImageURL        string `json:"image_url"`
	MediaType       string `json:"media_type" binding:"omitempty,oneof=image video"`
	LayoutMode      string `json:"layout_mode" binding:"omitempty,oneof=landscape portrait"`
	DurationSeconds int    `json:"duration_seconds" binding:"min=0,max=300"`
	SortOrder       int    `json:"sort_order"`
	IsActive        bool   `json:"is_active"`
}

// UpdateAdvertisementRequest carries mutable fields for an advertisement.
type UpdateAdvertisementRequest struct {
	Title           string `json:"title" binding:"required,min=2,max=150"`
	Body            string `json:"body"`
	ImageURL        string `json:"image_url"`
	MediaType       string `json:"media_type" binding:"omitempty,oneof=image video"`
	LayoutMode      string `json:"layout_mode" binding:"omitempty,oneof=landscape portrait"`
	DurationSeconds int    `json:"duration_seconds" binding:"min=0,max=300"`
	SortOrder       int    `json:"sort_order"`
	IsActive        bool   `json:"is_active"`
}
