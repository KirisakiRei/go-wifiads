export interface RouterDevice {
  id: string
  site_id: string
  partner_id?: string
  partner_name?: string
  partner_venue_name?: string
  name: string
  nas_identifier: string
  ip_address: string
  nas_ip_address?: string
  radius_server_ip?: string
  radius_secret?: string
  heartbeat_token?: string
  portal_base_url?: string
  status: string
  description?: string
  latitude?: number
  longitude?: number
  location_address?: string
  venue_category?: string
  location_tier_id?: string
  location_tier_name?: string
  location_multiplier?: number
  location_tier_auto?: boolean
  avg_daily_connects?: number
  avg_daily_impressions?: number
  is_public_marketplace?: boolean
  voucher_prefix?: string
  voucher_digit_count?: number
  voucher_numeric_only?: boolean
  default_profile_id?: string
  survey_profile_id?: string
  voucher_ttl_seconds?: number
  session_timeout_seconds?: number
  is_connected?: boolean
  is_online?: boolean
  last_seen_at?: string
  active_sessions_count?: number
  total_sessions_count?: number
  total_input_octets?: number
  total_output_octets?: number
}

export interface CreateRouterInput {
  name: string
  nas_identifier: string
  ip_address: string
  nas_ip_address: string
  radius_secret?: string
  description?: string
  partner_id?: string
  latitude?: number | null
  longitude?: number | null
  location_address?: string
  venue_category?: string
  location_tier_id?: string
  location_tier_auto?: boolean
  is_public_marketplace?: boolean
}

export interface UpdateRouterVoucherConfigInput {
  name?: string
  nas_identifier?: string
  ip_address?: string
  nas_ip_address?: string
  radius_secret?: string
  partner_id?: string
  latitude?: number | null
  longitude?: number | null
  location_address?: string
  venue_category?: string
  location_tier_id?: string
  location_tier_auto?: boolean
  is_public_marketplace?: boolean
  voucher_prefix: string
  voucher_digit_count: number
  voucher_numeric_only: boolean
  default_profile_id?: string
  survey_profile_id?: string
  voucher_ttl_seconds?: number
  session_timeout_seconds?: number
}
