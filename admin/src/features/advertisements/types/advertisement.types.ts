export interface Advertisement {
  id: string
  title: string
  body: string
  image_url: string
  media_type: 'image' | 'video'
  layout_mode: 'landscape' | 'portrait'
  duration_seconds: number
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateAdvertisementPayload {
  title: string
  body?: string
  image_url?: string
  media_type?: 'image' | 'video'
  layout_mode: 'landscape' | 'portrait'
  duration_seconds?: number
  sort_order?: number
  is_active?: boolean
}

export interface UpdateAdvertisementPayload {
  title: string
  body?: string
  image_url?: string
  media_type?: 'image' | 'video'
  layout_mode?: 'landscape' | 'portrait'
  duration_seconds?: number
  sort_order?: number
  is_active?: boolean
}

export interface MediaMetadata {
  width: number
  height: number
  duration?: number
  orientation: 'landscape' | 'portrait'
  type: 'image' | 'video'
}
