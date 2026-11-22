import type { VoucherStatus } from '@/types/common'

export interface Voucher {
  id: string
  username: string
  status: VoucherStatus
  site_id: string
  router_id: string
  profile_id?: string
  batch_id?: string
  profile_name?: string
  bandwidth_down_kbps?: number
  bandwidth_up_kbps?: number
  quota_bytes?: number
  shared_users?: number
  portal_session_id?: string
  expected_mac?: string
  created_by: string
  note?: string
  expires_at: string
  session_timeout_seconds: number
  used_at?: string
  created_at: string
}

export interface CreatedVoucher extends Voucher {
  password: string
}

export interface CreateVoucherInput {
  note?: string
  router_id?: string
  profile_id?: string
  prefix?: string
  digit_count?: number
  numeric_only?: boolean
  ttl_seconds?: number
  session_timeout_seconds?: number
}

export interface CreateVoucherBatchInput {
  name: string
  router_id?: string
  profile_id?: string
  prefix?: string
  quantity: number
  digit_count?: number
  numeric_only?: boolean
  ttl_seconds?: number
  session_timeout_seconds?: number
  note?: string
}

export interface VoucherBatch {
  id: string
  name: string
  router_id: string
  router_name?: string
  profile_id?: string
  profile_name?: string
  prefix: string
  quantity: number
  created_by: string
  created_at: string
}

export interface VoucherBatchCreatedResult {
  batch: VoucherBatch
  vouchers: CreatedVoucher[]
}

export interface VoucherSummary {
  total: number
  issued: number
  active: number
  used: number
  expired: number
  revoked: number
}
