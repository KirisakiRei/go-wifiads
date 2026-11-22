import { MapPin, Radio } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import L, { createBaseTileLayer } from '@/components/map/leaflet-setup'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { formatRupiah } from '@/lib/formatters'
import type { PublicLocationItem } from '../public.api'

interface Props {
  locations: PublicLocationItem[]
}

const MEDAN_CENTER: [number, number] = [3.5952, 98.6722]

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function createPublicPinIcon(selected: boolean, isOnline: boolean) {
  const pinColor = selected ? '#0037b0' : '#00668a'
  const dotColor = isOnline ? '#10b981' : '#ef4444'
  return L.divIcon({
    className: 'wifiads-public-pin',
    html: `
      <div style="position:relative;width:26px;height:26px;">
        <div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:${pinColor};transform:rotate(-45deg);border:2.5px solid #ffffff;box-shadow:0 3px 10px rgba(11,28,48,0.28);display:flex;align-items:center;justify-content:center;">
          <div style="width:8px;height:8px;border-radius:50%;background:#ffffff;"></div>
        </div>
        <span style="position:absolute;right:-2px;top:-2px;width:9px;height:9px;border-radius:50%;background:${dotColor};border:2px solid #ffffff;"></span>
      </div>
    `,
    iconSize: [26, 32],
    iconAnchor: [13, 32],
    popupAnchor: [0, -30],
  })
}

export function PublicLocationsMap({ locations }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())

  const categories = useMemo(() => {
    const set = new Set<string>()
    locations.forEach((l) => {
      if (l.venue_category) set.add(l.venue_category)
    })
    return Array.from(set).sort()
  }, [locations])

  const filtered = useMemo(() => {
    if (selectedCategory === 'ALL') return locations
    return locations.filter((l) => l.venue_category === selectedCategory)
  }, [locations, selectedCategory])

  const onlineCount = useMemo(
    () => filtered.filter((l) => l.is_connected).length,
    [filtered]
  )

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return
    const map = L.map(mapElRef.current, {
      center: MEDAN_CENTER,
      zoom: 12,
      scrollWheelZoom: false,
    })
    createBaseTileLayer().addTo(map)

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (c) => {
        const count = c.getChildCount()
        const size = count > 20 ? 48 : count > 10 ? 42 : 36
        return L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#0037b0;color:#ffffff;font-weight:800;font-size:${size >= 48 ? 14 : 13}px;display:flex;align-items:center;justify-content:center;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(0,55,176,0.36)">${count}</div>`,
          className: 'wifiads-public-cluster',
          iconSize: L.point(size, size),
        })
      },
    })
    map.addLayer(cluster)
    mapRef.current = map
    clusterRef.current = cluster

    return () => {
      map.remove()
      mapRef.current = null
      clusterRef.current = null
      markersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const cluster = clusterRef.current
    if (!map || !cluster) return

    cluster.clearLayers()
    markersRef.current.clear()

    const bounds: [number, number][] = []
    filtered.forEach((loc) => {
      if (loc.latitude == null || loc.longitude == null) return
      const latlng: [number, number] = [loc.latitude, loc.longitude]
      bounds.push(latlng)
      const isSel = loc.id === selectedId
      const statusDot = loc.is_connected ? '#10b981' : '#ef4444'
      const statusText = loc.is_connected ? 'Online' : 'Offline'
      const statusFg = loc.is_connected ? '#047857' : '#b91c1c'

      const marker = L.marker(latlng, {
        icon: createPublicPinIcon(isSel, loc.is_connected),
      })

      marker.bindTooltip(
        `<div style="font-family:inherit;min-width:165px;line-height:1.35;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <strong style="font-size:12.5px;color:#0b1c30;">${escapeHtml(loc.venue_name)}</strong>
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;color:${statusFg};">
              <span style="width:7px;height:7px;border-radius:50%;background:${statusDot};"></span>${statusText}
            </span>
          </div>
          <div style="font-size:11px;color:#475569;margin-top:2px;">
            Est. ${loc.estimated_daily_views.toLocaleString('id-ID')} tayangan/hari · ${formatRupiah(loc.image_price_idr)}
          </div>
        </div>`,
        { direction: 'top', offset: [0, -26], opacity: 0.98 }
      )

      marker.bindPopup(
        `<div style="font-family:inherit;min-width:190px;line-height:1.4;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <strong>${escapeHtml(loc.venue_name)}</strong>
            <span style="font-size:10.5px;font-weight:700;color:${statusFg};">${statusText}</span>
          </div>
          <div style="font-size:12px;color:#475569;margin-top:2px;">${escapeHtml(loc.venue_category)} · ${escapeHtml(loc.tier_name)}</div>
          ${loc.address ? `<div style="font-size:11.5px;color:#64748b;margin-top:3px;">${escapeHtml(loc.address)}</div>` : ''}
          <div style="font-size:12px;color:#0037b0;font-weight:700;margin-top:6px;">
            Est. ${loc.estimated_daily_views.toLocaleString('id-ID')}/hari · Mulai ${formatRupiah(loc.image_price_idr)}/tayang
          </div>
        </div>`
      )

      marker.on('click', () => setSelectedId(loc.id))
      cluster.addLayer(marker)
      markersRef.current.set(loc.id, marker)
    })

    if (bounds.length === 1) {
      map.setView(bounds[0], 14)
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 })
    }
  }, [filtered, selectedId])

  const handleSelectLocation = (loc: PublicLocationItem) => {
    setSelectedId(loc.id)
    const map = mapRef.current
    const cluster = clusterRef.current
    const marker = markersRef.current.get(loc.id)
    if (map && cluster && marker && loc.latitude != null && loc.longitude != null) {
      cluster.zoomToShowLayer(marker, () => {
        map.flyTo([loc.latitude!, loc.longitude!], 15, { duration: 0.45 })
        marker.openPopup()
      })
    }
  }

  return (
    <div>
      {categories.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            className={`pub-step-pill${selectedCategory === 'ALL' ? ' active' : ''}`}
            onClick={() => setSelectedCategory('ALL')}
          >
            Semua Lokasi ({locations.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`pub-step-pill${selectedCategory === cat ? ' active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="pub-map-layout">
        <div style={{ position: 'relative' }}>
          <div ref={mapElRef} className="pub-map-canvas" />
          {/* Floating Top-Left Active Partner Count Badge */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '52px',
              zIndex: 400,
              background: 'rgba(255, 255, 255, 0.96)',
              border: '1px solid #e2e8f0',
              borderRadius: '999px',
              padding: '6px 13px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#0b1c30',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(11, 28, 48, 0.1)',
            }}
          >
            <span>{filtered.length} Titik Mitra Aktif</span>
            {onlineCount > 0 && (
              <>
                <span style={{ color: '#cbd5e1' }}>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#047857' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
                  {onlineCount} Online
                </span>
              </>
            )}
          </div>
        </div>

        <div className="pub-loc-list">
          {filtered.length === 0 ? (
            <div className="pub-card" style={{ textAlign: 'center', color: '#64748b' }}>
              <Radio size={24} style={{ marginBottom: '8px', color: '#94a3b8' }} />
              <div style={{ fontWeight: 600, color: '#0b1c30' }}>
                Jaringan Lokasi Terus Bertambah
              </div>
              <p style={{ fontSize: '13px', marginTop: '4px' }}>
                Daftarkan lokasi usaha Anda untuk tampil di peta jaringan Wi-Fi publik kami.
              </p>
            </div>
          ) : (
            filtered.map((loc) => (
              <button
                key={loc.id}
                type="button"
                className={`pub-loc-item${selectedId === loc.id ? ' selected' : ''}`}
                onClick={() => handleSelectLocation(loc)}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '14px',
                        color: '#0b1c30',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span
                        title={loc.is_connected ? 'Online' : 'Offline'}
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: loc.is_connected ? '#10b981' : '#ef4444',
                          flexShrink: 0,
                        }}
                      />
                      <span>{loc.venue_name}</span>
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '2px',
                      }}
                    >
                      <MapPin size={12} />
                      <span>{loc.address || loc.venue_category}</span>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#0037b0',
                      background: '#e8efff',
                      padding: '3px 8px',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {loc.tier_name}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '10px',
                    paddingTop: '8px',
                    borderTop: '1px solid #f1f5f9',
                    fontSize: '12px',
                    color: '#475569',
                  }}
                >
                  <span>Est. {loc.estimated_daily_views.toLocaleString('id-ID')} tayangan/hari</span>
                  <strong style={{ color: '#059669' }}>
                    {formatRupiah(loc.image_price_idr)}/tayang
                  </strong>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
