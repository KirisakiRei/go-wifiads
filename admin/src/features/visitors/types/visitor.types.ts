import type { VisitorStatus } from '@/types/common'

export interface Visitor {
  id: string
  portal_session_id: string
  site_id: string
  router_id: string
  mac: string
  ip: string
  username: string
  status: VisitorStatus
  connected_at?: string
  disconnected_at?: string
  last_accounting_at?: string
  session_time_seconds: number
  created_at: string
  survey_email?: string
  survey_phone?: string
  survey_skipped?: boolean
  profile_name?: string
  input_octets?: number
  output_octets?: number
  voucher_expires_at?: string
  voucher_status?: string
}
