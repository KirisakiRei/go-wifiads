import { MapPin, Navigation, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import L, { createBaseTileLayer } from './leaflet-setup'

interface RouterPinPickerProps {
  latitude: number | null
  longitude: number | null
  onChange: (lat: number, lng: number) => void
  onAddressFound?: (displayName: string) => void
  height?: number
  showSearchToolbar?: boolean
}

interface PlaceSearchResult {
  display_name: string
  latitude: number
  longitude: number
}

const DEFAULT_CENTER: [number, number] = [-6.2088, 106.8456]

function createPinIcon() {
  return L.divIcon({
    className: 'wifiads-pin-icon',
    html: `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:#ea4335;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(15,23,42,0.35)"><div style="width:10px;height:10px;border-radius:50%;background:#ffffff"></div></div>`,
    iconSize: [32, 38],
    iconAnchor: [16, 38],
  })
}

export function RouterPinPicker({
  latitude,
  longitude,
  onChange,
  onAddressFound,
  height = 290,
  showSearchToolbar = true,
}: RouterPinPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<PlaceSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const hasCoords =
      latitude !== null &&
      longitude !== null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    const initialCenter: [number, number] = hasCoords ? [latitude, longitude] : DEFAULT_CENTER
    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: hasCoords ? 16 : 12,
      scrollWheelZoom: true,
    })

    createBaseTileLayer().addTo(map)

    if (hasCoords) {
      const m = L.marker([latitude, longitude], { icon: createPinIcon(), draggable: true }).addTo(
        map
      )
      m.on('dragend', () => {
        const pos = m.getLatLng()
        onChangeRef.current(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)))
      })
      markerRef.current = m
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = Number(e.latlng.lat.toFixed(6))
      const lng = Number(e.latlng.lng.toFixed(6))
      onChangeRef.current(lat, lng)
    })

    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 150)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const hasCoords =
      latitude !== null &&
      longitude !== null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    if (!hasCoords) {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return
    }
    const target: [number, number] = [latitude, longitude]
    if (!markerRef.current) {
      const m = L.marker(target, { icon: createPinIcon(), draggable: true }).addTo(map)
      m.on('dragend', () => {
        const pos = m.getLatLng()
        onChangeRef.current(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)))
      })
      markerRef.current = m
      map.setView(target, Math.max(map.getZoom(), 15), { animate: true })
    } else {
      markerRef.current.setLatLng(target)
      map.panTo(target, { animate: true })
    }
  }, [latitude, longitude])

  const handleSearchPlace = async () => {
    const q = searchQuery.trim()
    if (q.length < 2) return
    try {
      setSearching(true)
      const list = await apiClient<PlaceSearchResult[]>(
        `/api/v1/map-geocode?q=${encodeURIComponent(q)}`
      )
      setResults(list || [])
      if (!list || list.length === 0) {
        toast.info('Lokasi tidak ditemukan, coba kata kunci jalan atau kota lain')
      }
    } catch {
      toast.error('Gagal mencari lokasi pada peta')
    } finally {
      setSearching(false)
    }
  }

  const handleUseMyGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Browser tidak mendukung deteksi lokasi GPS')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6))
        const lng = Number(pos.coords.longitude.toFixed(6))
        onChange(lat, lng)
        if (mapRef.current) {
          mapRef.current.setView([lat, lng], 17, { animate: true })
        }
        toast.success('Titik peta diarahkan ke lokasi Anda saat ini')
      },
      () => toast.error('Izin lokasi ditolak atau gagal mendeteksi GPS')
    )
  }

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      {showSearchToolbar && (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearchPlace()
                  }
                }}
                placeholder="Cari nama jalan, daerah, atau kota lalu tekan Enter..."
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem 0.5rem 2rem',
                  fontSize: '12px',
                  borderRadius: '9px',
                  border: '1px solid #cbd5e1',
                }}
              />
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.8rem', fontSize: '12px' }}
              onClick={handleSearchPlace}
              disabled={searching}
            >
              {searching ? 'Mencari...' : 'Cari Peta'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.8rem', fontSize: '12px' }}
              onClick={handleUseMyGPS}
            >
              <Navigation size={13} /> Lokasi Saya
            </button>
          </div>

          {results.length > 0 && (
            <div
              style={{
                marginTop: '0.35rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                boxShadow: '0 8px 20px rgba(15,23,42,0.1)',
                overflow: 'hidden',
              }}
            >
              {results.map((item, idx) => (
                <button
                  key={`${item.latitude}-${item.longitude}-${idx}`}
                  type="button"
                  onClick={() => {
                    const lat = Number(item.latitude.toFixed(6))
                    const lng = Number(item.longitude.toFixed(6))
                    onChange(lat, lng)
                    if (onAddressFound) {
                      onAddressFound(item.display_name)
                    }
                    if (mapRef.current) {
                      mapRef.current.setView([lat, lng], 17, { animate: true })
                    }
                    setResults([])
                  }}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    border: 'none',
                    borderBottom: idx < results.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: '#ffffff',
                    textAlign: 'left',
                    fontSize: '12px',
                    color: '#0f172a',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <MapPin size={14} color="#ea4335" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.display_name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: `${height}px`,
          borderRadius: '12px',
          border: '1px solid #cbd5e1',
          overflow: 'hidden',
          zIndex: 1,
        }}
      />
    </div>
  )
}
