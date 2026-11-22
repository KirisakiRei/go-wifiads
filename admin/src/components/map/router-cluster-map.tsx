import { Crosshair, Loader2, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { formatRupiah } from '@/lib/formatters'
import L, { createBaseTileLayer } from './leaflet-setup'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

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

interface PlaceSearchResult {
  display_name: string
  latitude: number
  longitude: number
}

interface RouterClusterMapProps {
  routers: MapRouterPoint[]
  selectedIds: string[]
  mediaType: 'image' | 'video'
  onToggleSelect: (routerId: string) => void
  focusRouterId?: string | null
  focusSeq?: number
  height?: number
}

const FALLBACK_CITY_CENTER: [number, number] = [3.5952, 98.6722]

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function createVenuePinIcon(
  selected: boolean,
  isConnected: boolean,
  showLabel: boolean,
  venueName: string,
  labelPrice: string
) {
  const pinColor = selected ? '#16a34a' : '#ea4335'
  const statusColor = isConnected ? '#10b981' : '#ef4444'
  const labelBorder = selected ? '#16a34a' : '#cbd5e1'
  const labelBg = selected ? '#f0fdf4' : '#ffffff'
  const priceColor = selected ? '#15803d' : '#1d4ed8'
  const badgePrefix = selected ? '✓ ' : ''

  const labelHtml = showLabel
    ? `
        <div style="background:${labelBg};border:1.5px solid ${labelBorder};border-radius:10px;padding:3px 9px;box-shadow:0 4px 12px rgba(15,23,42,0.16);white-space:nowrap;line-height:1.2;">
          <div style="font-size:12px;font-weight:800;color:#0f172a;max-width:165px;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:5px;">
            <span style="width:7px;height:7px;border-radius:50%;background:${statusColor};flex-shrink:0;"></span>
            <span style="overflow:hidden;text-overflow:ellipsis;">${badgePrefix}${escapeHtml(venueName)}</span>
          </div>
          <div style="font-size:10px;font-weight:700;color:${priceColor};">${escapeHtml(labelPrice)} / tayang</div>
        </div>
      `
    : ''

  return L.divIcon({
    className: 'wifiads-gmap-poi',
    html: `
      <div style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none;">
        <div style="position:relative;width:28px;height:28px;flex-shrink:0;">
          <div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:${pinColor};transform:rotate(-45deg);border:2.5px solid #ffffff;box-shadow:0 4px 12px rgba(15,23,42,0.35);display:flex;align-items:center;justify-content:center;">
            <div style="width:9px;height:9px;border-radius:50%;background:#ffffff;"></div>
          </div>
          <span style="position:absolute;right:-2px;top:-2px;width:10px;height:10px;border-radius:50%;background:${statusColor};border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.25);"></span>
        </div>
        ${labelHtml}
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
  focusRouterId,
  focusSeq = 0,
  height = 430,
}: RouterClusterMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const markersByIdRef = useRef<Map<string, L.Marker>>(new Map())
  const lastGeoSignatureRef = useRef<string>('')
  const onToggleRef = useRef(onToggleSelect)
  onToggleRef.current = onToggleSelect

  const [zoomLevel, setZoomLevel] = useState<number>(13)
  const [areaQuery, setAreaQuery] = useState('')
  const [searchingArea, setSearchingArea] = useState(false)
  const [areaResults, setAreaResults] = useState<PlaceSearchResult[]>([])

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

  const onlineCount = useMemo(
    () => validRouters.filter((r) => r.is_connected).length,
    [validRouters]
  )

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

  const handleSearchArea = async () => {
    const q = areaQuery.trim()
    if (q.length < 2) return
    setSearchingArea(true)
    try {
      const res = await apiClient<PlaceSearchResult[]>(
        `/api/v1/map-geocode?q=${encodeURIComponent(q)}`
      )
      setAreaResults(res || [])
      if (res && res.length === 1 && mapRef.current) {
        mapRef.current.flyTo([res[0].latitude, res[0].longitude], 15, { duration: 0.65 })
        setAreaResults([])
      }
    } catch {
      setAreaResults([])
    } finally {
      setSearchingArea(false)
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
    setZoomLevel(initialZoom)

    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount()
        const size = count > 20 ? 48 : count > 10 ? 42 : 36
        return L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#1d4ed8;color:#ffffff;font-weight:800;font-size:${size >= 48 ? 14 : 13}px;display:flex;align-items:center;justify-content:center;border:3px solid #ffffff;box-shadow:0 4px 14px rgba(29,78,216,0.42)">${count}</div>`,
          className: 'wifiads-cluster-icon',
          iconSize: L.point(size, size),
        })
      },
    })
    map.addLayer(clusterGroup)
    mapRef.current = map
    clusterRef.current = clusterGroup

    const onZoomEnd = () => {
      setZoomLevel(map.getZoom())
    }
    map.on('zoomend', onZoomEnd)

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
      map.off('zoomend', onZoomEnd)
      domEl.removeEventListener('click', handlePopupClick)
      map.remove()
      mapRef.current = null
      clusterRef.current = null
      markersByIdRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const cluster = clusterRef.current
    if (!map || !cluster) return

    cluster.clearLayers()
    markersByIdRef.current.clear()
    const coords: [number, number][] = []
    const showDenseLabels = zoomLevel >= 14

    validRouters.forEach((r) => {
      const lat = r.latitude!
      const lng = r.longitude!
      coords.push([lat, lng])

      const isSelected = selectedIds.includes(r.id)
      const unitPrice = mediaType === 'video' ? r.price_video_idr : r.price_image_idr
      const priceText = formatRupiah(unitPrice)
      const statusDot = r.is_connected ? '#10b981' : '#ef4444'
      const statusText = r.is_connected ? 'Online' : 'Offline'
      const statusBg = r.is_connected ? '#ecfdf5' : '#fef2f2'
      const statusFg = r.is_connected ? '#047857' : '#b91c1c'

      const marker = L.marker([lat, lng], {
        icon: createVenuePinIcon(
          isSelected,
          r.is_connected,
          showDenseLabels || isSelected,
          r.name,
          priceText
        ),
      })

      const tooltipHtml = `
        <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:170px;line-height:1.35;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <strong style="font-size:12.5px;color:#0f172a;">${escapeHtml(r.name)}</strong>
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;color:${statusFg};">
              <span style="width:7px;height:7px;border-radius:50%;background:${statusDot};"></span>${statusText}
            </span>
          </div>
          <div style="font-size:11px;color:#475569;margin-top:2px;">
            ${r.avg_daily_visitors} koneksi/hari · <strong style="color:#1d4ed8;">${escapeHtml(priceText)}</strong>
          </div>
        </div>
      `
      marker.bindTooltip(tooltipHtml, {
        direction: 'top',
        offset: [0, -28],
        opacity: 0.98,
      })

      const popupHtml = `
        <div style="min-width:230px;font-family:'Plus Jakarta Sans',sans-serif;padding:2px 0;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;">
            <strong style="font-size:14px;color:#0f172a;">${escapeHtml(r.name)}</strong>
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:${statusBg};color:${statusFg};">
              <span style="width:6px;height:6px;border-radius:50%;background:${statusDot};"></span>${statusText}
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:#eff6ff;color:#1d4ed8;">${escapeHtml(r.venue_category || 'Kafe')}</span>
            <span style="font-size:11px;color:#64748b;">${r.active_sessions_count} sesi aktif</span>
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
      markersByIdRef.current.set(r.id, marker)
    })

    const geoSignature = validRouters.map((r) => `${r.id}:${r.latitude}:${r.longitude}`).join('|')
    if (coords.length > 0 && geoSignature !== lastGeoSignatureRef.current) {
      lastGeoSignatureRef.current = geoSignature
      if (coords.length === 1) {
        map.setView(coords[0], 15)
      } else {
        map.fitBounds(L.latLngBounds(coords), { padding: [55, 55], maxZoom: 15 })
      }
    }
  }, [validRouters, selectedIds, mediaType, zoomLevel])

  // Sync external focus request (e.g. clicking focus button on right panel) -> flyTo & open popup.
  useEffect(() => {
    if (!focusRouterId || focusSeq === 0) return
    const map = mapRef.current
    const cluster = clusterRef.current
    const marker = markersByIdRef.current.get(focusRouterId)
    if (!map || !cluster || !marker) return

    cluster.zoomToShowLayer(marker, () => {
      const pos = marker.getLatLng()
      map.flyTo(pos, Math.max(map.getZoom(), 16), { duration: 0.45 })
      marker.openPopup()
    })
  }, [focusRouterId, focusSeq])

  return (
    <div style={{ display: 'grid', gap: '0.6rem', width: '100%' }}>
      {/* Area / Address Geocode Search Bar */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: '0.45rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '11px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={areaQuery}
              onChange={(e) => setAreaQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSearchArea()
                }
              }}
              placeholder="Cari area / jalan di peta (contoh: Setiabudi Medan, USU)..."
              style={{
                width: '100%',
                padding: '0.48rem 2rem 0.48rem 2rem',
                fontSize: '12.5px',
                borderRadius: '9px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
              }}
            />
            {areaQuery && (
              <button
                type="button"
                aria-label="Hapus pencarian area"
                onClick={() => {
                  setAreaQuery('')
                  setAreaResults([])
                }}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '12px', whiteSpace: 'nowrap' }}
            disabled={searchingArea || areaQuery.trim().length < 2}
            onClick={handleSearchArea}
          >
            {searchingArea ? <Loader2 size={14} className="spin" /> : 'Cari Area'}
          </button>
        </div>

        {areaResults.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              zIndex: 500,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              boxShadow: '0 10px 24px rgba(15,23,42,0.14)',
              maxHeight: '190px',
              overflowY: 'auto',
            }}
          >
            {areaResults.map((item, idx) => (
              <button
                key={`${item.latitude}-${item.longitude}-${idx}`}
                type="button"
                onClick={() => {
                  mapRef.current?.flyTo([item.latitude, item.longitude], 15, { duration: 0.55 })
                  setAreaResults([])
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.55rem 0.8rem',
                  border: 'none',
                  borderBottom: idx < areaResults.length - 1 ? '1px solid #f1f5f9' : 'none',
                  background: '#ffffff',
                  fontSize: '12px',
                  color: '#0f172a',
                  cursor: 'pointer',
                }}
              >
                {item.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map Canvas + Floating Controls */}
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

        {/* Floating Top-Left Live Stats Badge */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '52px',
            zIndex: 400,
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid #e2e8f0',
            borderRadius: '999px',
            padding: '5px 11px',
            fontSize: '11.5px',
            fontWeight: 700,
            color: '#0f172a',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(15,23,42,0.1)',
          }}
        >
          <span>{validRouters.length} Titik Peta</span>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#047857' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#10b981',
              }}
            />
            {onlineCount} Online
          </span>
        </div>

        {/* Floating Focus Partner Area Button */}
        <button
          type="button"
          onClick={focusPartnerArea}
          title="Fokus ke semua titik mitra"
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 400,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '9px',
            padding: '6px 10px',
            fontSize: '11.5px',
            fontWeight: 700,
            color: '#0f172a',
            boxShadow: '0 2px 8px rgba(15,23,42,0.12)',
            cursor: 'pointer',
          }}
        >
          <Crosshair size={14} color="#1d4ed8" /> Fokus Mitra
        </button>
      </div>
    </div>
  )
}
