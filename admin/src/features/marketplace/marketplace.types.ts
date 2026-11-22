export interface LocationTier {
  id: string
  name: string
  multiplier: number
  min_daily_connects: number
  min_daily_impressions: number
  description: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PlatformAdSetting {
  base_price_image_idr: number
  base_price_video_idr: number
  max_ad_duration_seconds: number
  min_topup_amount_idr: number
  default_partner_share_percent: number
  min_withdrawal_amount_idr: number
  require_ad_approval: boolean
  updated_at: string
}

export interface PaymentMethod {
  id: string
  type: 'BANK_TRANSFER' | 'QRIS_STATIC' | 'GATEWAY'
  provider_name: string
  account_number: string
  account_holder: string
  qris_image_url: string
  instructions: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface AdvertiserProfile {
  id: string
  name: string
  company_name: string
  email: string
  phone: string
  wallet_balance_idr: number
  active_campaigns_count?: number
  total_campaigns_count?: number
  total_topup_idr?: number
  total_spent_idr?: number
  is_active: boolean
  last_login_at?: string
  created_at: string
}

export interface AdvertiserAuthResult {
  token: string
  expires_at: string
  advertiser: AdvertiserProfile
}

export interface MarketplaceRouterItem {
  id: string
  name: string
  location_address: string
  venue_category: string
  latitude?: number
  longitude?: number
  tier_id?: string
  tier_name: string
  multiplier: number
  price_image_idr: number
  price_video_idr: number
  avg_daily_visitors: number
  active_sessions_count: number
  is_connected: boolean
}

export interface CampaignRouterSummary {
  router_id: string
  router_name: string
  location_address: string
  venue_category: string
  latitude?: number
  longitude?: number
  tier_name: string
  multiplier: number
  unit_price_idr: number
}

export type CampaignStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'ACTIVE'
  | 'PAUSED'
  | 'REJECTED'
  | 'COMPLETED'

export interface CampaignItem {
  id: string
  advertiser_id: string
  advertiser_name?: string
  advertiser_company?: string
  title: string
  body: string
  image_url: string
  target_url: string
  media_type: 'image' | 'video'
  layout_mode: 'landscape' | 'portrait'
  duration_seconds: number
  status: CampaignStatus
  is_active: boolean
  rejection_reason?: string
  start_date?: string
  end_date?: string
  start_hour: number
  end_hour: number
  active_days: string
  daily_budget_idr: number
  total_budget_idr: number
  spent_amount_idr: number
  daily_spent_today_idr: number
  impressions_count: number
  clicks_count: number
  completions_count?: number
  completion_rate_percent?: number
  avg_watch_seconds?: number
  target_routers: CampaignRouterSummary[]
  created_at: string
  updated_at: string
}

export interface CreateCampaignPayload {
  title: string
  body: string
  image_url: string
  target_url: string
  media_type: 'image' | 'video'
  layout_mode: 'landscape' | 'portrait'
  duration_seconds: number
  router_ids: string[]
  start_date: string
  end_date: string
  start_hour: number
  end_hour: number
  active_days: string
  daily_budget_idr: number
  total_budget_idr: number
  save_as_draft?: boolean
}

export interface TopupInvoiceItem {
  id: string
  invoice_number: string
  advertiser_id: string
  advertiser_name?: string
  advertiser_email?: string
  advertiser_company?: string
  payment_method_id?: string
  payment_channel: string
  payment_provider_name: string
  amount_idr: number
  proof_image_url: string
  sender_name: string
  status: 'PENDING_PROOF' | 'WAITING_VERIFICATION' | 'PAID' | 'REJECTED' | 'EXPIRED'
  admin_note: string
  verified_at?: string
  created_at: string
}

export interface WalletTransactionItem {
  id: string
  advertiser_id?: string
  advertiser_name?: string
  advertiser_company?: string
  type: 'TOPUP' | 'AD_IMPRESSION' | 'ADMIN_ADJUSTMENT' | 'REFUND'
  amount_idr: number
  balance_after_idr: number
  reference_type: string
  reference_id: string
  description: string
  created_at: string
}

export interface AdvertiserChartPoint {
  label: string
  impressions: number
  clicks: number
  spent_idr: number
}

export interface AdvertiserOverview {
  wallet_balance_idr: number
  active_campaigns_count: number
  pending_campaigns_count: number
  total_impressions: number
  total_clicks: number
  total_spent_idr: number
  trend_today: AdvertiserChartPoint[]
  trend_7d: AdvertiserChartPoint[]
  trend_30d: AdvertiserChartPoint[]
}

export interface RouterAnalyticsBreakdown {
  router_id: string
  router_name: string
  venue_category: string
  location_address: string
  impressions: number
  clicks: number
  ctr_percent: number
  spent_idr: number
}

export interface AdvertiserAnalytics {
  total_impressions: number
  total_clicks: number
  ctr_percent: number
  total_completions?: number
  completion_rate_percent?: number
  avg_watch_seconds?: number
  total_spent_idr: number
  series: AdvertiserChartPoint[]
  by_router: RouterAnalyticsBreakdown[]
}

// ==================== ADMIN SIDEBAR BADGES, FINANCE & PARTNERS ====================

export interface AdminSidebarBadges {
  pending_campaigns_count: number
  waiting_topups_count: number
  pending_withdrawals_count: number
}

export interface AdminFinanceChartPoint {
  label: string
  impressions: number
  gross_ad_spend_idr: number
  partner_share_idr: number
  net_platform_idr: number
}

export interface AdminRouterRevenueItem {
  router_id: string
  router_name: string
  venue_name: string
  partner_name: string
  tier_name: string
  impressions: number
  clicks: number
  gross_ad_spend_idr: number
  partner_share_idr: number
  net_platform_idr: number
}

export interface AdminFinanceSummary {
  total_topup_paid_idr: number
  period_topup_paid_idr: number
  waiting_topup_count: number
  waiting_topup_idr: number
  total_gross_ad_spend_idr: number
  period_gross_ad_spend_idr: number
  total_partner_share_idr: number
  period_partner_share_idr: number
  total_net_platform_idr: number
  period_net_platform_idr: number
  total_withdrawals_paid_idr: number
  pending_withdrawals_count: number
  pending_withdrawals_idr: number
  total_client_wallet_idr: number
  total_partner_wallet_idr: number
  series: AdminFinanceChartPoint[]
  by_router: AdminRouterRevenueItem[]
}

export interface AdminPartnerItem {
  id: string
  username: string
  name: string
  venue_name: string
  venue_category: string
  email: string
  phone: string
  address: string
  latitude?: number
  longitude?: number
  has_coordinates: boolean
  revenue_share_percent: number
  wallet_balance_idr: number
  total_earned_idr: number
  bank_name: string
  bank_account_number: string
  bank_account_holder: string
  routers_count: number
  router_names: string[]
  status: 'INVITED' | 'ACTIVE'
  invite_token?: string
  invite_expires_at?: string
  activated_at?: string
  is_active: boolean
  last_login_at?: string
  created_at: string
}

export interface AdminWithdrawalItem {
  id: string
  withdrawal_number: string
  partner_id: string
  partner_name: string
  venue_name: string
  partner_email: string
  amount_idr: number
  bank_name: string
  bank_account_number: string
  bank_account_holder: string
  status: 'PENDING' | 'PAID' | 'REJECTED'
  proof_image_url: string
  admin_note: string
  processed_at?: string
  created_at: string
}

// ==================== PARTNER PORTAL TYPES (NO PERCENTAGE FIELDS) ====================

export interface PartnerInviteInfo {
  venue_name: string
  venue_category: string
  status: 'INVITED' | 'ACTIVE'
  expires_at?: string
}

export interface PartnerProfile {
  id: string
  username: string
  name: string
  venue_name: string
  venue_category: string
  email: string
  phone: string
  address: string
  latitude?: number
  longitude?: number
  has_coordinates: boolean
  wallet_balance_idr: number
  total_earned_idr: number
  min_withdrawal_amount_idr: number
  bank_name: string
  bank_account_number: string
  bank_account_holder: string
  status: 'INVITED' | 'ACTIVE'
  is_active: boolean
  last_login_at?: string
  created_at: string
}

export interface PartnerAuthResult {
  token: string
  expires_at: string
  partner: PartnerProfile
}

export interface PartnerChartPoint {
  label: string
  visitors: number
  impressions: number
  earned_idr: number
}

export interface PartnerRankProgress {
  current_tier_name: string
  avg_daily_connects: number
  avg_daily_impressions: number
  next_tier_name?: string
  next_tier_min_connects?: number
}

export interface PartnerOverview {
  wallet_balance_idr: number
  total_earned_idr: number
  today_earned_idr: number
  month_earned_idr: number
  today_visitors: number
  active_ads_count: number
  routers_count: number
  online_routers_count: number
  needs_location_setup: boolean
  rank: PartnerRankProgress
  trend_today: PartnerChartPoint[]
  trend_7d: PartnerChartPoint[]
  trend_30d: PartnerChartPoint[]
}

export interface PartnerAdItem {
  id: string
  title: string
  body: string
  image_url: string
  target_url: string
  media_type: 'image' | 'video'
  layout_mode: 'landscape' | 'portrait'
  duration_seconds: number
  advertiser_name: string
  status: string
  start_hour: number
  end_hour: number
  impressions_at_venue: number
  clicks_at_venue: number
  earned_idr: number
}

export interface PartnerRouterItem {
  id: string
  name: string
  venue_name: string
  address: string
  is_connected: boolean
  last_seen_at?: string
  active_sessions_count: number
  avg_daily_visitors: number
  tier_name: string
}

export interface PartnerWithdrawalItem {
  id: string
  withdrawal_number: string
  amount_idr: number
  bank_name: string
  bank_account_number: string
  bank_account_holder: string
  status: 'PENDING' | 'PAID' | 'REJECTED'
  proof_image_url: string
  admin_note: string
  processed_at?: string
  created_at: string
}

export interface PartnerWalletTxItem {
  id: string
  type: string
  amount_idr: number
  balance_after_idr: number
  description: string
  created_at: string
}

export interface PartnerLeadItem {
  id: string
  venue_name: string
  category: string
  city: string
  address: string
  latitude?: number | null
  longitude?: number | null
  daily_traffic_estimate: number
  contact_name: string
  whatsapp: string
  notes: string
  admin_note: string
  status: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'REJECTED'
  converted_partner_id?: string | null
  invite_token?: string
  created_at: string
  updated_at: string
}

export interface ConvertPartnerLeadResult {
  lead: PartnerLeadItem
  partner: AdminPartnerItem
}
