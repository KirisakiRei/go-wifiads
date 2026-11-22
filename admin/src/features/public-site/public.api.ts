import { apiClient, jsonBody } from '@/lib/api-client'

export interface PublicPricingInfo {
  base_price_image_idr: number
  base_price_video_idr: number
  max_ad_duration_seconds: number
  min_topup_amount_idr: number
  default_partner_share_percent: number
  min_withdrawal_amount_idr: number
}

export interface PublicLocationTier {
  id: string
  name: string
  multiplier: number
  min_daily_connects: number
  min_daily_impressions: number
  description: string
}

export interface PublicLocationItem {
  id: string
  venue_name: string
  venue_category: string
  address: string
  latitude?: number | null
  longitude?: number | null
  tier_name: string
  multiplier: number
  estimated_daily_views: number
  image_price_idr: number
  video_price_idr: number
  is_connected: boolean
}

export interface PublicLandingData {
  brand_name: string
  pricing: PublicPricingInfo
  tiers: PublicLocationTier[]
  stats: {
    total_public_locations: number
    total_categories: number
    total_active_routers: number
  }
  locations: PublicLocationItem[]
}

export interface SubmitPartnerLeadPayload {
  venue_name: string
  category: string
  city: string
  address?: string
  latitude?: number
  longitude?: number
  daily_traffic_estimate: number
  contact_name: string
  whatsapp: string
  notes?: string
}

export const publicSiteApi = {
  getLandingData: () => apiClient<PublicLandingData>('/api/v1/public/landing-data'),
  submitPartnerLead: (data: SubmitPartnerLeadPayload) =>
    apiClient<{ id: string; venue_name: string; status: string }>('/api/v1/public/partner-leads', {
      method: 'POST',
      ...jsonBody(data),
    }),
}
