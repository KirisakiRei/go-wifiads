import type { VoucherStatus } from '@/types/common'

export interface Voucher {
  id: string
  username: string
  status: VoucherStatus
  site_id: string
  router_id: string
  profile_id?: string
  profile_name?: string
  bandwidth_down_kbps?: number
  bandwidth_up_kbps?: number
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
