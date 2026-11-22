import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Radio } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatRupiah } from '@/lib/formatters'
import type { PublicLocationItem } from '../public.api'

interface Props {
  locations: PublicLocationItem[]
}

export function PublicLocationsMap({ locations }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map())

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

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return
    const map = L.map(mapElRef.current, {
      center: [3.5952, 98.6722],
      zoom: 12,
      scrollWheelZoom: false,
    })
    L.tileLayer('/map-tiles/{z}/{x}/{y}', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current.clear()

    const bounds: [number, number][] = []
    filtered.forEach((loc) => {
      if (loc.latitude == null || loc.longitude == null) return
      const latlng: [number, number] = [loc.latitude, loc.longitude]
      bounds.push(latlng)
      const isSel = loc.id === selectedId
      const marker = L.circleMarker(latlng, {
        radius: isSel ? 10 : 7,
        fillColor: isSel ? '#0037b0' : '#00668a',
        color: '#ffffff',
        weight: 2.5,
        fillOpacity: 0.92,
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:inherit;min-width:160px">
            <strong>${loc.venue_name}</strong><br/>
            <span style="font-size:12px;color:#475569">${loc.venue_category} · ${loc.tier_name}</span><br/>
            <span style="font-size:12px;color:#0037b0;font-weight:600">Est. ${loc.estimated_daily_views}/hari · Mulai ${formatRupiah(loc.image_price_idr)}/tayang</span>
          </div>`
        )
      marker.on('click', () => setSelectedId(loc.id))
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
    const marker = markersRef.current.get(loc.id)
    if (map && loc.latitude != null && loc.longitude != null) {
      map.flyTo([loc.latitude, loc.longitude], 15, { duration: 0.45 })
      marker?.openPopup()
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
        <div ref={mapElRef} className="pub-map-canvas" />

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
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#0b1c30' }}>
                      {loc.venue_name}
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
