package dto

// PaginationQuery is embedded by every list endpoint.
type PaginationQuery struct {
	Page    int    `form:"page,default=1" binding:"omitempty,min=1"`
	PerPage int    `form:"per_page,default=20" binding:"omitempty,min=1,max=100"`
	Search  string `form:"search" binding:"omitempty,max=100"`
	SortBy  string `form:"sort_by" binding:"omitempty,max=32"`
	Order   string `form:"order,default=desc" binding:"omitempty,oneof=asc desc"`
}

// PaginationMeta is returned in the response envelope meta field.
type PaginationMeta struct {
	CurrentPage int   `json:"current_page"`
	PerPage     int   `json:"per_page"`
	TotalItems  int64 `json:"total_items"`
	TotalPages  int   `json:"total_pages"`
}
