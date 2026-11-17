export interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  meta?: PaginationMeta
  error?: string
  details?: unknown
}

export interface PaginationMeta {
  current_page: number
  per_page: number
  total_items: number
  total_pages: number
}
