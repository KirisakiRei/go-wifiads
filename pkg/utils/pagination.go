package utils

// Pagination defaults shared by every list endpoint.
const (
	DefaultPage    = 1
	DefaultPerPage = 20
	MaxPerPage     = 100
)

// NormalizePage returns safe page, per-page and offset values.
func NormalizePage(page, perPage int) (int, int, int) {
	if page < 1 {
		page = DefaultPage
	}
	if perPage < 1 {
		perPage = DefaultPerPage
	}
	if perPage > MaxPerPage {
		perPage = MaxPerPage
	}
	return page, perPage, (page - 1) * perPage
}

// TotalPages computes the number of pages for a total item count.
func TotalPages(totalItems int64, perPage int) int {
	if perPage <= 0 {
		return 0
	}
	pages := totalItems / int64(perPage)
	if totalItems%int64(perPage) != 0 {
		pages++
	}
	return int(pages)
}
