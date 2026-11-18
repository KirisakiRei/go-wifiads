import { Crosshair } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import L, { createBaseTileLayer } from './leaflet-setup'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { formatRupiah } from '@/lib/formatters'

export interface MapRouterPoint {
  id: string
  name: string
  location_address: string
  venue_category: string
  latitude?: number
  longitude?: number
  tier_name: string
  multiplier: number
  price_image_idr: number
  price_video_idr: number
  avg_daily_visitors: number
  active_sessions_count: number
  is_connected: boolean
}

interface RouterClusterMapProps {
  routers: MapRouterPoint[]
  selectedIds: string[]
  mediaType: 'image' | 'video'
  onToggleSelect: (routerId: string) => void
  height?: number
}

const FALLBACK_CITY_CENTER: [number, number] = [-6.2088, 106.8456]

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Google-Maps-style POI Pin + Floating Venue Name Label
function createVenuePinIcon(selected: boolean, venueName: string, labelPrice: string) {
  const pinColor = selected ? '#16a34a' : '#ea4335'
  const labelBorder = selected ? '#16a34a' : '#cbd5e1'
  const labelBg = selected ? '#f0fdf4' : '#ffffff'
  const priceColor = selected ? '#15803d' : '#1d4ed8'
  const badgePrefix = selected ? '✓ ' : ''

  return L.divIcon({
    className: 'wifiads-gmap-poi',
    html: `
      <div style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none;">
        <div style="position:relative;width:28px;height:28px;flex-shrink:0;">
          <div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:${pinColor};transform:rotate(-45deg);border:2.5px solid #ffffff;box-shadow:0 4px 12px rgba(15,23,42,0.35);display:flex;align-items:center;justify-content:center;">
            <div style="width:9px;height:9px;border-radius:50%;background:#ffffff;"></div>
          </div>
        </div>
        <div style="background:${labelBg};border:1.5px solid ${labelBorder};border-radius:10px;padding:3px 9px;box-shadow:0 4px 12px rgba(15,23,42,0.16);white-space:nowrap;line-height:1.2;">
          <div style="font-size:12px;font-weight:800;color:#0f172a;max-width:170px;overflow:hidden;text-overflow:ellipsis;">${badgePrefix}${escapeHtml(venueName)}</div>
          <div style="font-size:10px;font-weight:700;color:${priceColor};">${escapeHtml(labelPrice)} / tayang</div>
        </div>
      </div>
    `,
    iconSize: [28, 34],
    iconAnchor: [14, 34],
    popupAnchor: [0, -32],
  })
}

export function RouterClusterMap({
  routers,
  selectedIds,
  mediaType,
  onToggleSelect,
  height = 430,
}: RouterClusterMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const lastGeoSignatureRef = useRef<string>('')
  const onToggleRef = useRef(onToggleSelect)
  onToggleRef.current = onToggleSelect

  const validRouters = useMemo(
    () =>
      routers.filter(
        (r) =>
          typeof r.latitude === 'number' &&
          typeof r.longitude === 'number' &&
          Number.isFinite(r.latitude) &&
          Number.isFinite(r.longitude)
      ),
    [routers]
  )
  const validRoutersRef = useRef(validRouters)
  validRoutersRef.current = validRouters

  const focusPartnerArea = () => {
    const map = mapRef.current
    if (!map) return
    if (validRouters.length === 1) {
      map.setView([validRouters[0].latitude!, validRouters[0].longitude!], 15, { animate: true })
    } else if (validRouters.length > 1) {
      const bounds = L.latLngBounds(
        validRouters.map((r) => [r.latitude!, r.longitude!] as [number, number])
      )
      map.fitBounds(bounds, { padding: [55, 55], maxZoom: 15, animate: true })
    } else {
      map.setView(FALLBACK_CITY_CENTER, 12, { animate: true })
    }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const initialCenter: [number, number] =
      validRouters.length > 0
        ? [validRouters[0].latitude!, validRouters[0].longitude!]
        : FALLBACK_CITY_CENTER
    const initialZoom = validRouters.length === 1 ? 15 : 13

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      scrollWheelZoom: true,
    })

    createBaseTileLayer().addTo(map)

    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 42,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount()
        return L.divIcon({
          html: `<div style="width:40px;height:40px;border-radius:50%;background:#1d4ed8;color:#ffffff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;border:3px solid #ffffff;box-shadow:0 4px 14px rgba(29,78,216,0.42)">${count}</div>`,
          className: 'wifiads-cluster-icon',
          iconSize: L.point(40, 40),
        })
      },
    })

    map.addLayer(clusterGroup)
    mapRef.current = map
    clusterRef.current = clusterGroup

    const handlePopupClick = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null
      const btn = target?.closest('[data-toggle-router-id]') as HTMLElement | null
      if (btn) {
        ev.preventDefault()
        ev.stopPropagation()
        const rid = btn.getAttribute('data-toggle-router-id')
        if (rid) {
          onToggleRef.current(rid)
        }
      }
    }
    const domEl = containerRef.current
    domEl.addEventListener('click', handlePopupClick)

    const resizeTimer = setTimeout(() => {
      map.invalidateSize()
      const currentValid = validRoutersRef.current
      if (currentValid.length === 1) {
        map.setView([currentValid[0].latitude!, currentValid[0].longitude!], 15)
      } else if (currentValid.length > 1) {
        const bounds = L.latLngBounds(
          currentValid.map((r) => [r.latitude!, r.longitude!] as [number, number])
        )
        map.fitBounds(bounds, { padding: [55, 55], maxZoom: 15 })
      }
    }, 120)

    return () => {
      clearTimeout(resizeTimer)
      domEl.removeEventListener('click', handlePopupClick)
      map.remove()
      mapRef.current = null
      clusterRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const cluster = clusterRef.current
    if (!map || !cluster) return

    cluster.clearLayers()
    const coords: [number, number][] = []

    validRouters.forEach((r) => {
      const lat = r.latitude!
      const lng = r.longitude!
      coords.push([lat, lng])

      const isSelected = selectedIds.includes(r.id)
      const unitPrice = mediaType === 'video' ? r.price_video_idr : r.price_image_idr
      const priceText = formatRupiah(unitPrice)

      const marker = L.marker([lat, lng], {
        icon: createVenuePinIcon(isSelected, r.name, priceText),
      })

      const popupHtml = `
        <div style="min-width:225px;font-family:'Plus Jakarta Sans',sans-serif;padding:2px 0;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
            <strong style="font-size:14px;color:#0f172a;">${escapeHtml(r.name)}</strong>
            <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:#eff6ff;color:#1d4ed8;">${escapeHtml(r.venue_category || 'Kafe')}</span>
          </div>
          ${
            r.location_address
              ? `<div style="font-size:11px;color:#64748b;margin-bottom:8px;line-height:1.35;">${escapeHtml(r.location_address)}</div>`
              : ''
          }
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:7px 9px;font-size:11px;display:grid;gap:4px;margin-bottom:9px;">
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#64748b;">Rank Lokasi</span>
              <strong style="color:#0f172a;">${escapeHtml(r.tier_name)} (${r.multiplier}x)</strong>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#64748b;">Rata-rata Koneksi</span>
              <strong style="color:#0f172a;">${r.avg_daily_visitors} / hari</strong>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#64748b;">Tarif Tayang</span>
              <strong style="color:#1d4ed8;">${escapeHtml(priceText)} / tayang</strong>
            </div>
          </div>
          <button
            type="button"
            data-toggle-router-id="${escapeHtml(r.id)}"
            style="width:100%;padding:8px 10px;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;background:${
              isSelected ? '#dcfce7' : '#2563eb'
            };color:${isSelected ? '#166534' : '#ffffff'};"
          >
            ${isSelected ? '✓ Lokasi Dipilih (Klik untuk Batal)' : 'Pilih Lokasi Mitra Ini'}
          </button>
        </div>
      `
      marker.bindPopup(popupHtml, { closeButton: true })
      cluster.addLayer(marker)
    })

    // Auto-zoom to partner area whenever the set of router coordinates loads or changes
    const geoSignature = validRouters.map((r) => `${r.id}:${r.latitude}:${r.longitude}`).join('|')
    if (coords.length > 0 && geoSignature !== lastGeoSignatureRef.current) {
      lastGeoSignatureRef.current = geoSignature
      if (coords.length === 1) {
        map.setView(coords[0], 15)
      } else {
        map.fitBounds(L.latLngBounds(coords), { padding: [55, 55], maxZoom: 15 })
      }
    }
  }, [validRouters, selectedIds, mediaType])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: `${height}px`,
          borderRadius: '14px',
          border: '1px solid #cbd5e1',
          overflow: 'hidden',
          zIndex: 1,
        }}
      />

      {validRouters.length > 0 && (
        <button
          type="button"
          onClick={focusPartnerArea}
          title="Arahkan peta ke area mitra"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 400,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 11px',
            borderRadius: '9px',
            border: '1px solid #cbd5e1',
            background: 'rgba(255, 255, 255, 0.96)',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.12)',
            color: '#0f172a',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Crosshair size={13} color="#2563eb" />
          Fokus Area Mitra
        </button>
      )}
    </div>
  )
}
