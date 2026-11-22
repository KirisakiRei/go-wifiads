export interface ConnectProfile {
  id: string
  name: string
  display_name: string
  description: string
  is_default: boolean
  bandwidth_up_kbps: number
  bandwidth_down_kbps: number
  session_timeout_seconds: number
  voucher_ttl_seconds: number
  quota_bytes?: number
  shared_users?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateProfilePayload {
  name: string
  display_name: string
  description?: string
  is_default?: boolean
  bandwidth_up_kbps: number
  bandwidth_down_kbps: number
  session_timeout_seconds: number
  voucher_ttl_seconds?: number
  quota_bytes?: number
  shared_users?: number
  is_active?: boolean
}

export interface UpdateProfilePayload {
  display_name: string
  description?: string
  is_default?: boolean
  bandwidth_up_kbps: number
  bandwidth_down_kbps: number
  session_timeout_seconds: number
  voucher_ttl_seconds?: number
  quota_bytes?: number
  shared_users?: number
  is_active?: boolean
}
