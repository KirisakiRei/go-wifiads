import type { SessionStatus } from '@/types/common'

export interface RadiusSession {
  id: string
  router_id?: string
  router_name?: string
  nas_identifier: string
  acct_session_id: string
  username: string
  calling_station_id: string
  framed_ip_address: string
  status: SessionStatus
  started_at?: string
  last_accounting_at?: string
  stopped_at?: string
  session_time_seconds: number
  input_octets: number
  output_octets: number
  terminate_cause?: string
  created_at: string
}

export interface DisconnectSessionResult {
  session_id: string
  status: string
  coa_sent: boolean
  voucher_revoked: boolean
  message: string
}
