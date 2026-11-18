export interface ChartPoint {
  label: string
  impressions: number
  logins: number
}

export interface Overview {
  active_devices: number
  pending_devices: number
  active_sessions: number
  total_vouchers: number
  issued_vouchers: number
  active_vouchers: number
  used_vouchers: number
  total_input_octets?: number
  total_output_octets?: number
  avg_ad_duration_seconds?: number
  login_success_rate?: number
  peak_window_label?: string
  trend_today?: ChartPoint[]
  trend_7d?: ChartPoint[]
  trend_30d?: ChartPoint[]
}
