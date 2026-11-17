export type VoucherStatus = 'ISSUED' | 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED'
export type VisitorStatus = 'PENDING' | 'CONNECTED' | 'CLOSED' | 'STALE'
export type SessionStatus = 'ACTIVE' | 'CLOSED' | 'STALE'

export interface ListQuery {
  page: number
  per_page: number
  search?: string
  status?: string
}
