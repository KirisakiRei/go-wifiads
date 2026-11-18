import { env } from '@/config/env'
import { ApiError, apiClient, apiRequest, jsonBody } from '@/lib/api-client'
import type {
  AdminFinanceSummary,
  AdminPartnerItem,
  AdminSidebarBadges,
  AdminWithdrawalItem,
  AdvertiserAnalytics,
  AdvertiserAuthResult,
  AdvertiserOverview,
  AdvertiserProfile,
  CampaignItem,
  CreateCampaignPayload,
  LocationTier,
  MarketplaceRouterItem,
  PartnerAdItem,
  PartnerAuthResult,
  PartnerOverview,
  PartnerProfile,
  PartnerRouterItem,
  PartnerWalletTxItem,
  PartnerWithdrawalItem,
  PaymentMethod,
  PlatformAdSetting,
  TopupInvoiceItem,
  WalletTransactionItem,
} from './marketplace.types'

export interface UploadProgressInfo {
  loaded: number
  total: number
  percent: number
}

export function uploadMultipartWithProgress(
  endpointPath: string,
  file: File,
  onProgress?: (info: UploadProgressInfo) => void
): Promise<{ url: string; key: string; media_type: 'image' | 'video'; size: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${env.apiBaseUrl}${endpointPath}`, true)
    xhr.withCredentials = true
    xhr.setRequestHeader('Accept', 'application/json')

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        const percent = Math.min(99, Math.round((ev.loaded / ev.total) * 100))
        onProgress({ loaded: ev.loaded, total: ev.total, percent })
      }
    }

    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText || '{}')
        if (xhr.status >= 200 && xhr.status < 300 && payload.success) {
          resolve(payload.data)
        } else {
          reject(new ApiError(payload.message || `Gagal mengunggah (${xhr.status})`, xhr.status))
        }
      } catch {
        reject(new ApiError('Respons server tidak valid saat unggah berkas', xhr.status))
      }
    }

    xhr.onerror = () => reject(new ApiError('Koneksi jaringan terputus saat mengunggah berkas', 0))

    const fd = new FormData()
    fd.append('file', file)
    xhr.send(fd)
  })
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') {
      sp.set(k, String(v))
    }
  })
  const q = sp.toString()
  return q ? `?${q}` : ''
}

// ==================== ADMIN MARKETPLACE, PARTNER & FINANCE API ====================

export const adminMarketplaceApi = {
  getBadges: () => apiClient<AdminSidebarBadges>('/api/v1/admin/marketplace/badges'),
  getFinanceSummary: (range: 'today' | '7d' | '30d' = '30d') =>
    apiClient<AdminFinanceSummary>(`/api/v1/admin/marketplace/finance${buildQuery({ range })}`),
  listGlobalTransactions: (
    params: { page?: number; per_page?: number; type?: string; advertiser_id?: string } = {}
  ) =>
    apiRequest<WalletTransactionItem[]>(
      `/api/v1/admin/marketplace/wallet-transactions${buildQuery(params)}`
    ),

  getSettings: () => apiClient<PlatformAdSetting>('/api/v1/admin/marketplace/settings'),
  updateSettings: (data: Omit<PlatformAdSetting, 'updated_at'>) =>
    apiClient<PlatformAdSetting>('/api/v1/admin/marketplace/settings', {
      method: 'PUT',
      ...jsonBody(data),
    }),

  listTiers: () => apiClient<LocationTier[]>('/api/v1/admin/marketplace/tiers'),
  createTier: (data: {
    name: string
    multiplier: number
    min_daily_connects: number
    min_daily_impressions: number
    description: string
    sort_order: number
    is_active: boolean
  }) =>
    apiClient<LocationTier>('/api/v1/admin/marketplace/tiers', {
      method: 'POST',
      ...jsonBody(data),
    }),
  updateTier: (
    id: string,
    data: {
      name: string
      multiplier: number
      min_daily_connects: number
      min_daily_impressions: number
      description: string
      sort_order: number
      is_active: boolean
    }
  ) =>
    apiClient<LocationTier>(`/api/v1/admin/marketplace/tiers/${id}`, {
      method: 'PUT',
      ...jsonBody(data),
    }),
  deleteTier: (id: string) =>
    apiClient<void>(`/api/v1/admin/marketplace/tiers/${id}`, { method: 'DELETE' }),

  listPaymentMethods: () => apiClient<PaymentMethod[]>('/api/v1/admin/marketplace/payment-methods'),
  createPaymentMethod: (data: Omit<PaymentMethod, 'id' | 'created_at'>) =>
    apiClient<PaymentMethod>('/api/v1/admin/marketplace/payment-methods', {
      method: 'POST',
      ...jsonBody(data),
    }),
  updatePaymentMethod: (id: string, data: Omit<PaymentMethod, 'id' | 'created_at'>) =>
    apiClient<PaymentMethod>(`/api/v1/admin/marketplace/payment-methods/${id}`, {
      method: 'PUT',
      ...jsonBody(data),
    }),
  deletePaymentMethod: (id: string) =>
    apiClient<void>(`/api/v1/admin/marketplace/payment-methods/${id}`, { method: 'DELETE' }),
  uploadQris: (file: File, onProgress?: (info: UploadProgressInfo) => void) =>
    uploadMultipartWithProgress(
      '/api/v1/admin/marketplace/payment-methods/upload-qris',
      file,
      onProgress
    ),

  listAdvertisers: (params: { page?: number; per_page?: number; search?: string } = {}) =>
    apiRequest<AdvertiserProfile[]>(`/api/v1/admin/marketplace/advertisers${buildQuery(params)}`),
  toggleAdvertiserStatus: (advertiserId: string, is_active: boolean) =>
    apiClient<AdvertiserProfile>(`/api/v1/admin/marketplace/advertisers/${advertiserId}/status`, {
      method: 'PUT',
      ...jsonBody({ is_active }),
    }),
  adjustBalance: (advertiserId: string, data: { amount_idr: number; description: string }) =>
    apiClient<AdvertiserProfile>(
      `/api/v1/admin/marketplace/advertisers/${advertiserId}/adjust-balance`,
      {
        method: 'POST',
        ...jsonBody(data),
      }
    ),

  listCampaigns: (
    params: {
      page?: number
      per_page?: number
      status?: string
      search?: string
      advertiser_id?: string
    } = {}
  ) => apiRequest<CampaignItem[]>(`/api/v1/admin/marketplace/campaigns${buildQuery(params)}`),
  moderateCampaign: (
    campaignId: string,
    data: { action: 'APPROVE' | 'REJECT' | 'PAUSE'; rejection_reason?: string }
  ) =>
    apiClient<CampaignItem>(`/api/v1/admin/marketplace/campaigns/${campaignId}/moderate`, {
      method: 'PUT',
      ...jsonBody(data),
    }),

  listTopups: (
    params: {
      page?: number
      per_page?: number
      status?: string
      search?: string
      advertiser_id?: string
    } = {}
  ) => apiRequest<TopupInvoiceItem[]>(`/api/v1/admin/marketplace/topups${buildQuery(params)}`),
  verifyTopup: (invoiceId: string, data: { action: 'APPROVE' | 'REJECT'; admin_note?: string }) =>
    apiClient<TopupInvoiceItem>(`/api/v1/admin/marketplace/topups/${invoiceId}/verify`, {
      method: 'PUT',
      ...jsonBody(data),
    }),

  // Admin Partner & Withdrawals
  listPartners: (params: { page?: number; per_page?: number; search?: string } = {}) =>
    apiRequest<AdminPartnerItem[]>(`/api/v1/admin/partners${buildQuery(params)}`),
  createPartner: (data: {
    name: string
    venue_name: string
    venue_category: string
    email: string
    phone: string
    password: string
    address: string
    latitude?: number | null
    longitude?: number | null
    revenue_share_percent?: number
    bank_name: string
    bank_account_number: string
    bank_account_holder: string
    is_active: boolean
  }) =>
    apiClient<AdminPartnerItem>('/api/v1/admin/partners', {
      method: 'POST',
      ...jsonBody(data),
    }),
  updatePartner: (
    id: string,
    data: {
      name: string
      venue_name: string
      venue_category: string
      email: string
      phone: string
      address: string
      latitude?: number | null
      longitude?: number | null
      revenue_share_percent: number
      bank_name: string
      bank_account_number: string
      bank_account_holder: string
      is_active: boolean
    }
  ) =>
    apiClient<AdminPartnerItem>(`/api/v1/admin/partners/${id}`, {
      method: 'PUT',
      ...jsonBody(data),
    }),
  changePartnerPassword: (id: string, password: string) =>
    apiClient<void>(`/api/v1/admin/partners/${id}/password`, {
      method: 'PUT',
      ...jsonBody({ password }),
    }),
  deletePartner: (id: string) =>
    apiClient<void>(`/api/v1/admin/partners/${id}`, { method: 'DELETE' }),

  listWithdrawals: (
    params: { page?: number; per_page?: number; status?: string; search?: string; partner_id?: string } = {}
  ) => apiRequest<AdminWithdrawalItem[]>(`/api/v1/admin/partners/withdrawals${buildQuery(params)}`),
  processWithdrawal: (
    id: string,
    data: { action: 'APPROVE' | 'REJECT'; proof_image_url?: string; admin_note?: string }
  ) =>
    apiClient<AdminWithdrawalItem>(`/api/v1/admin/partners/withdrawals/${id}/process`, {
      method: 'PUT',
      ...jsonBody(data),
    }),
  uploadPayoutProof: (file: File, onProgress?: (info: UploadProgressInfo) => void) =>
    uploadMultipartWithProgress('/api/v1/admin/partners/withdrawals/upload-proof', file, onProgress),
}

// ==================== ADVERTISER CLIENT API ====================

export const advertiserApi = {
  register: (data: {
    name: string
    company_name: string
    email: string
    phone: string
    password: string
  }) =>
    apiClient<AdvertiserAuthResult>('/api/v1/advertiser/auth/register', {
      method: 'POST',
      ...jsonBody(data),
    }),
  login: (data: { email: string; password: string }) =>
    apiClient<AdvertiserAuthResult>('/api/v1/advertiser/auth/login', {
      method: 'POST',
      ...jsonBody(data),
    }),
  logout: () => apiClient<void>('/api/v1/advertiser/auth/logout', { method: 'POST' }),
  me: () => apiClient<AdvertiserProfile>('/api/v1/advertiser/auth/me'),
  updateProfile: (data: { name: string; company_name: string; phone: string }) =>
    apiClient<AdvertiserProfile>('/api/v1/advertiser/auth/profile', {
      method: 'PUT',
      ...jsonBody(data),
    }),
  changePassword: (data: { current_password: string; new_password: string }) =>
    apiClient<void>('/api/v1/advertiser/auth/password', {
      method: 'PUT',
      ...jsonBody(data),
    }),

  getConfig: () =>
    apiClient<{
      setting: PlatformAdSetting
      location_tiers: LocationTier[]
      payment_methods: PaymentMethod[]
    }>('/api/v1/advertiser/config'),
  listMapRouters: () => apiClient<MarketplaceRouterItem[]>('/api/v1/advertiser/routers/map'),
  getOverview: () => apiClient<AdvertiserOverview>('/api/v1/advertiser/overview'),
  getAnalytics: (params: { range?: string; campaign_id?: string; router_id?: string } = {}) =>
    apiClient<AdvertiserAnalytics>(`/api/v1/advertiser/analytics${buildQuery(params)}`),

  uploadMedia: (file: File, onProgress?: (info: UploadProgressInfo) => void) =>
    uploadMultipartWithProgress('/api/v1/advertiser/media/upload', file, onProgress),
  listCampaigns: (
    params: { page?: number; per_page?: number; status?: string; search?: string } = {}
  ) => apiRequest<CampaignItem[]>(`/api/v1/advertiser/campaigns${buildQuery(params)}`),
  createCampaign: (data: CreateCampaignPayload) =>
    apiClient<CampaignItem>('/api/v1/advertiser/campaigns', {
      method: 'POST',
      ...jsonBody(data),
    }),
  updateCampaign: (id: string, data: CreateCampaignPayload) =>
    apiClient<CampaignItem>(`/api/v1/advertiser/campaigns/${id}`, {
      method: 'PUT',
      ...jsonBody(data),
    }),
  getCampaign: (id: string) => apiClient<CampaignItem>(`/api/v1/advertiser/campaigns/${id}`),
  toggleCampaignStatus: (id: string, action: 'PAUSE' | 'RESUME') =>
    apiClient<CampaignItem>(`/api/v1/advertiser/campaigns/${id}/status`, {
      method: 'PUT',
      ...jsonBody({ action }),
    }),
  deleteCampaign: (id: string) =>
    apiClient<void>(`/api/v1/advertiser/campaigns/${id}`, { method: 'DELETE' }),

  uploadTopupProof: (file: File, onProgress?: (info: UploadProgressInfo) => void) =>
    uploadMultipartWithProgress('/api/v1/advertiser/topups/upload-proof', file, onProgress),
  listTopups: (params: { page?: number; per_page?: number; status?: string } = {}) =>
    apiRequest<TopupInvoiceItem[]>(`/api/v1/advertiser/topups${buildQuery(params)}`),
  createTopup: (data: {
    amount_idr: number
    payment_method_id: string
    sender_name?: string
    proof_image_url?: string
  }) =>
    apiClient<TopupInvoiceItem>('/api/v1/advertiser/topups', {
      method: 'POST',
      ...jsonBody(data),
    }),
  submitTopupProof: (invoiceId: string, data: { sender_name: string; proof_image_url: string }) =>
    apiClient<TopupInvoiceItem>(`/api/v1/advertiser/topups/${invoiceId}/proof`, {
      method: 'PUT',
      ...jsonBody(data),
    }),
  listWalletTransactions: (params: { page?: number; per_page?: number; type?: string } = {}) =>
    apiRequest<WalletTransactionItem[]>(
      `/api/v1/advertiser/wallet/transactions${buildQuery(params)}`
    ),
}

// ==================== PARTNER PORTAL API ====================

export const partnerApi = {
  login: (data: { email: string; password: string }) =>
    apiClient<PartnerAuthResult>('/api/v1/partner/auth/login', {
      method: 'POST',
      ...jsonBody(data),
    }),
  logout: () => apiClient<void>('/api/v1/partner/auth/logout', { method: 'POST' }),
  me: () => apiClient<PartnerProfile>('/api/v1/partner/auth/me'),
  updateProfile: (data: {
    name: string
    venue_name: string
    venue_category: string
    phone: string
    address: string
    latitude: number
    longitude: number
    bank_name: string
    bank_account_number: string
    bank_account_holder: string
  }) =>
    apiClient<PartnerProfile>('/api/v1/partner/auth/profile', {
      method: 'PUT',
      ...jsonBody(data),
    }),
  changePassword: (data: { current_password: string; new_password: string }) =>
    apiClient<void>('/api/v1/partner/auth/password', {
      method: 'PUT',
      ...jsonBody(data),
    }),

  getOverview: () => apiClient<PartnerOverview>('/api/v1/partner/overview'),
  listAds: () => apiClient<PartnerAdItem[]>('/api/v1/partner/ads'),
  listRouters: () => apiClient<PartnerRouterItem[]>('/api/v1/partner/routers'),
  createWithdrawal: (amount_idr: number) =>
    apiClient<PartnerWithdrawalItem>('/api/v1/partner/withdrawals', {
      method: 'POST',
      ...jsonBody({ amount_idr }),
    }),
  listWithdrawals: (params: { page?: number; per_page?: number; status?: string } = {}) =>
    apiRequest<PartnerWithdrawalItem[]>(`/api/v1/partner/withdrawals${buildQuery(params)}`),
  listTransactions: (params: { page?: number; per_page?: number } = {}) =>
    apiRequest<PartnerWalletTxItem[]>(`/api/v1/partner/wallet/transactions${buildQuery(params)}`),
}
