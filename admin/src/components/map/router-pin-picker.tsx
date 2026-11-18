import { CheckCircle2, Link2, MapPin, Navigation, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { apiClient, jsonBody } from '@/lib/api-client'
import L, { createBaseTileLayer } from './leaflet-setup'

interface RouterPinPickerProps {
  latitude: number | null
  longitude: number | null
  onChange: (lat: number, lng: number) => void
  onAddressFound?: (displayName: string) => void
  onPlaceNameFound?: (placeName: string) => void
  height?: number
  accentColor?: string
}

interface PlaceSearchResult {
  display_name: string
  latitude: number
  longitude: number
}

interface ResolvedMapLink {
  latitude: number
  longitude: number
  place_name?: string
  display_name?: string
}

const DEFAULT_CENTER: [number, number] = [-2.5489, 118.0149]

function createPinIcon(pinColor = '#ea4335') {
  return L.divIcon({
    className: 'wifiads-pin-icon',
    html: `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:${pinColor};transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(15,23,42,0.35)"><div style="width:10px;height:10px;border-radius:50%;background:#ffffff"></div></div>`,
    iconSize: [32, 38],
    iconAnchor: [16, 38],
  })
}

export function RouterPinPicker({
  latitude,
  longitude,
  onChange,
  onAddressFound,
  onPlaceNameFound,
  height = 280,
  accentColor = '#059669',
}: RouterPinPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const [mode, setMode] = useState<'gmaps' | 'search'>('gmaps')
  const [gmapsInput, setGmapsInput] = useState('')
  const [resolvingLink, setResolvingLink] = useState(false)
  // True once the pasted link produced a pin: the button would only resend it.
  const [linkResolved, setLinkResolved] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<PlaceSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const hasValidCoords =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const initialCenter: [number, number] = hasValidCoords
      ? [latitude!, longitude!]
      : DEFAULT_CENTER
    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: hasValidCoords ? 17 : 5,
      scrollWheelZoom: true,
    })

    createBaseTileLayer().addTo(map)

    if (hasValidCoords) {
      const m = L.marker([latitude!, longitude!], {
        icon: createPinIcon(),
        draggable: true,
      }).addTo(map)
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
    const timer = setTimeout(() => map.invalidateSize(), 150)

    return () => {
      clearTimeout(timer)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!hasValidCoords) {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return
    }
    const target: [number, number] = [latitude!, longitude!]
    if (!markerRef.current) {
      const m = L.marker(target, { icon: createPinIcon(), draggable: true }).addTo(map)
      m.on('dragend', () => {
        const pos = m.getLatLng()
        onChangeRef.current(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)))
      })
      markerRef.current = m
      map.setView(target, Math.max(map.getZoom(), 16), { animate: true })
    } else {
      markerRef.current.setLatLng(target)
      map.panTo(target, { animate: true })
    }
  }, [latitude, longitude, hasValidCoords])

  const resolveGoogleMapsShare = async (rawValue?: string) => {
    const input = (rawValue ?? gmapsInput).trim()
    if (input.length < 5) {
      toast.info('Tempel tautan Bagikan (Share) dari Google Maps terlebih dahulu')
      return
    }
    try {
      setResolvingLink(true)
      const res = await apiClient<ResolvedMapLink>('/api/v1/map-resolve-link', {
        method: 'POST',
        ...jsonBody({ input }),
      })
      setLinkResolved(true)
      const lat = Number(res.latitude.toFixed(6))
      const lng = Number(res.longitude.toFixed(6))
      onChange(lat, lng)
      if (res.display_name && onAddressFound) {
        onAddressFound(res.display_name)
      }
      if (res.place_name && onPlaceNameFound) {
        onPlaceNameFound(res.place_name)
      }
      if (mapRef.current) {
        mapRef.current.setView([lat, lng], 17, { animate: true })
      }
      toast.success('Titik lokasi dari Google Maps berhasil ditemukan!')
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Tautan tidak dikenali, silakan coba cari melalui nama jalan'
      )
    } finally {
      setResolvingLink(false)
    }
  }

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
        toast.success('Peta diarahkan ke lokasi GPS Anda saat ini')
      },
      () => toast.error('Izin lokasi ditolak atau gagal mendeteksi GPS')
    )
  }

  return (
    <div style={{ display: 'grid', gap: '0.65rem' }}>
      {/* Method Switcher */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            background: '#e2e8f0',
            padding: '3px',
            borderRadius: '10px',
            gap: '3px',
          }}
        >
          <button
            type="button"
            onClick={() => setMode('gmaps')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '0.38rem 0.75rem',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'gmaps' ? '#ffffff' : 'transparent',
              color: mode === 'gmaps' ? '#0f172a' : '#475569',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: mode === 'gmaps' ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
            }}
          >
            <Link2 size={13} color={mode === 'gmaps' ? accentColor : '#64748b'} />
            Link Google Maps
          </button>

          <button
            type="button"
            onClick={() => setMode('search')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '0.38rem 0.75rem',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'search' ? '#ffffff' : 'transparent',
              color: mode === 'search' ? '#0f172a' : '#475569',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: mode === 'search' ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
            }}
          >
            <Search size={13} color={mode === 'search' ? accentColor : '#64748b'} />
            Cari Nama Jalan
          </button>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.75rem', fontSize: '12px' }}
          onClick={handleUseMyGPS}
        >
          <Navigation size={13} /> Lokasi Saya (GPS)
        </button>
      </div>

      {/* Mode 1: Paste Google Maps Share Link */}
      {mode === 'gmaps' ? (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '210px' }}>
              <Link2
                size={14}
                style={{
                  position: 'absolute',
                  left: '11px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                }}
              />
              <input
                type="text"
                value={gmapsInput}
                onChange={(e) => {
                  setGmapsInput(e.target.value)
                  setLinkResolved(false)
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text')
                  if (
                    pasted &&
                    (pasted.includes('goo.gl') || pasted.includes('google.com/maps') || pasted.includes('maps.google'))
                  ) {
                    setGmapsInput(pasted)
                    setLinkResolved(false)
                    setTimeout(() => resolveGoogleMapsShare(pasted), 60)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    resolveGoogleMapsShare()
                  }
                }}
                placeholder="Tempel link Share Google Maps (misal: https://maps.app.goo.gl/...)"
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem 0.55rem 2.1rem',
                  fontSize: '12.5px',
                  borderRadius: '9px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                }}
              />
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{
                padding: '0.5rem 0.95rem',
                fontSize: '12px',
                background: accentColor,
              }}
              onClick={() => resolveGoogleMapsShare()}
              disabled={resolvingLink || linkResolved}
            >
              {linkResolved
                ? 'Lokasi Sudah Diambil'
                : resolvingLink
                  ? 'Mengambil Titik...'
                  : 'Ambil Lokasi'}
            </button>
          </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
            Tempel link <strong>Bagikan (Share)</strong> dari Google Maps — titik lokasi langsung
            diambil otomatis. Untuk lokasi lain: buka tempat usaha di Google Maps →{' '}
            <strong>Bagikan</strong> → <strong>Salin Link</strong>, lalu tempel di kolom atas.
          </span>
        </div>
      ) : (
        /* Mode 2: Street / Place Search */
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '210px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '11px',
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
                placeholder="Ketik nama jalan, kecamatan, atau kota lalu tekan Enter..."
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem 0.55rem 2.1rem',
                  fontSize: '12.5px',
                  borderRadius: '9px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                }}
              />
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{
                padding: '0.5rem 0.95rem',
                fontSize: '12px',
                background: accentColor,
              }}
              onClick={handleSearchPlace}
              disabled={searching}
            >
              {searching ? 'Mencari...' : 'Cari Alamat'}
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

      {/* Interactive Map */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: `${height}px`,
          borderRadius: '12px',
          border: hasValidCoords ? `1.5px solid ${accentColor}` : '1px solid #cbd5e1',
          overflow: 'hidden',
          zIndex: 1,
        }}
      />

      {/* Friendly Pin Status Pill (no raw coordinates required) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.55rem 0.8rem',
          borderRadius: '10px',
          background: hasValidCoords ? '#ecfdf5' : '#fffbeb',
          border: `1px solid ${hasValidCoords ? '#a7f3d0' : '#fde68a'}`,
          color: hasValidCoords ? '#065f46' : '#92400e',
          fontSize: '12px',
        }}
      >
        {hasValidCoords ? (
          <>
            <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
            <span>
              <strong>Titik lokasi sudah ditandai di peta.</strong> Anda juga dapat menggeser pin
              merah secara langsung agar tepat berada di posisi usaha Anda.
            </span>
          </>
        ) : (
          <>
            <MapPin size={15} style={{ flexShrink: 0 }} />
            <span>
              Belum ada titik lokasi yang dipilih. Tempel link Google Maps, cari jalan, atau klik
              langsung pada peta di atas.
            </span>
          </>
        )}
      </div>
    </div>
  )
}
