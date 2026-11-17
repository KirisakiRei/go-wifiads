export interface RouterDevice {
  id: string
  site_id: string
  name: string
  nas_identifier: string
  ip_address: string
  status: string
  description?: string
  voucher_prefix?: string
  voucher_digit_count?: number
  voucher_numeric_only?: boolean
  default_profile_id?: string
  survey_profile_id?: string
  voucher_ttl_seconds?: number
  session_timeout_seconds?: number
}

export interface UpdateRouterVoucherConfigInput {
  voucher_prefix: string
  voucher_digit_count: number
  voucher_numeric_only: boolean
  default_profile_id?: string
  survey_profile_id?: string
  voucher_ttl_seconds: number
  session_timeout_seconds: number
}
