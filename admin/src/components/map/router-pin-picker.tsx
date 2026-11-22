import { CheckCircle2, Link2, Loader2, MapPin, Navigation, Search, X } from 'lucide-react'
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
  const [linkResolved, setLinkResolved] = useState(false)
  const [locatingGps, setLocatingGps] = useState(false)
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
    setLocatingGps(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingGps(false)
        const lat = Number(pos.coords.latitude.toFixed(6))
        const lng = Number(pos.coords.longitude.toFixed(6))
        onChange(lat, lng)
        if (mapRef.current) {
          mapRef.current.setView([lat, lng], 17, { animate: true })
        }
        toast.success('Peta diarahkan ke lokasi GPS Anda saat ini')
      },
      () => {
        setLocatingGps(false)
        toast.error('Izin lokasi ditolak atau gagal mendeteksi GPS')
      },
      { timeout: 10000 }
    )
  }

  const hasManualLink = gmapsInput.trim().length >= 5 && !linkResolved && !resolvingLink

  return (
    <div className="pin-picker-root" style={{ display: 'grid', gap: '0.7rem' }}>
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
        <div className="pin-seg-group" role="tablist" aria-label="Metode pencarian lokasi">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'gmaps'}
            className={`pin-seg-btn ${mode === 'gmaps' ? 'active' : ''}`}
            onClick={() => setMode('gmaps')}
          >
            <Link2 size={13} color={mode === 'gmaps' ? accentColor : '#64748b'} />
            Link Google Maps
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'search'}
            className={`pin-seg-btn ${mode === 'search' ? 'active' : ''}`}
            onClick={() => setMode('search')}
          >
            <Search size={13} color={mode === 'search' ? accentColor : '#64748b'} />
            Cari Nama Jalan
          </button>
        </div>

        <button
          type="button"
          className="btn btn-secondary pin-gps-btn"
          onClick={handleUseMyGPS}
          disabled={locatingGps}
        >
          {locatingGps ? (
            <Loader2 size={13} className="pin-spin" />
          ) : (
            <Navigation size={13} />
          )}
          {locatingGps ? 'Mendeteksi...' : 'Lokasi Saya (GPS)'}
        </button>
      </div>

      {/* Mode 1: Paste Google Maps Share Link (auto-resolves on paste, no redundant primary button) */}
      {mode === 'gmaps' ? (
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          <div className="pin-input-wrap">
            <Link2 size={15} className="pin-input-icon" />
            <input
              type="text"
              className="pin-input"
              value={gmapsInput}
              onChange={(e) => {
                setGmapsInput(e.target.value)
                setLinkResolved(false)
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text').trim()
                if (!pasted) return
                // Prevent native paste from appending onto the controlled value.
                e.preventDefault()
                setGmapsInput(pasted)
                setLinkResolved(false)
                const isMapsLink =
                  pasted.includes('goo.gl') ||
                  pasted.includes('google.com/maps') ||
                  pasted.includes('maps.google') ||
                  /^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(pasted)
                if (isMapsLink) {
                  void resolveGoogleMapsShare(pasted)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (!resolvingLink && !linkResolved) {
                    void resolveGoogleMapsShare()
                  }
                }
              }}
              placeholder="Tempel link Bagikan Google Maps di sini (otomatis terdeteksi)..."
              style={{ paddingRight: resolvingLink ? '7.5rem' : linkResolved ? '4.5rem' : hasManualLink ? '5rem' : '0.85rem' }}
            />
            <div className="pin-input-trailing">
              {resolvingLink && (
                <span className="pin-resolving-tag">
                  <Loader2 size={13} className="pin-spin" />
                  Mencari...
                </span>
              )}
              {linkResolved && !resolvingLink && (
                <>
                  <CheckCircle2 size={16} color={accentColor} aria-label="Lokasi berhasil diambil" />
                  <button
                    type="button"
                    className="pin-clear-btn"
                    title="Ganti tautan"
                    aria-label="Hapus tautan Google Maps"
                    onClick={() => {
                      setGmapsInput('')
                      setLinkResolved(false)
                    }}
                  >
                    <X size={14} />
                  </button>
                </>
              )}
              {hasManualLink && (
                <button
                  type="button"
                  className="pin-inline-btn"
                  style={{ background: accentColor }}
                  onClick={() => void resolveGoogleMapsShare()}
                >
                  Cari
                </button>
              )}
            </div>
          </div>
          <span style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.45 }}>
            Buka lokasi di Google Maps → ketuk <strong>Bagikan</strong> →{' '}
            <strong>Salin Link</strong>, lalu tempel di atas. Titik peta otomatis terisi tanpa
            perlu klik tombol tambahan.
          </span>
        </div>
      ) : (
        /* Mode 2: Street / Place Search */
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <div className="pin-input-wrap" style={{ flex: 1, minWidth: '210px' }}>
              <Search size={15} className="pin-input-icon" />
              <input
                type="text"
                className="pin-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearchPlace()
                  }
                }}
                placeholder="Ketik nama jalan, kecamatan, atau kota lalu tekan Enter..."
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                padding: '0.52rem 0.95rem',
                fontSize: '12.5px',
                background: accentColor,
              }}
              onClick={handleSearchPlace}
              disabled={searching}
            >
              {searching ? <Loader2 size={14} className="pin-spin" /> : null}
              {searching ? 'Mencari...' : 'Cari Alamat'}
            </button>
          </div>
          {results.length > 0 && (
            <div className="pin-search-dropdown" role="listbox">
              {results.map((item, idx) => (
                <button
                  key={`${item.latitude}-${item.longitude}-${idx}`}
                  type="button"
                  role="option"
                  className="pin-search-item"
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
        className="pin-map-frame"
        style={{
          width: '100%',
          height: `${height}px`,
          borderColor: hasValidCoords ? accentColor : '#cbd5e1',
        }}
      />

      {/* Friendly Pin Status Pill (no raw coordinates required) */}
      <div className={`pin-status-pill ${hasValidCoords ? 'is-set' : 'is-empty'}`}>
        {hasValidCoords ? (
          <>
            <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
            <span>
              <strong>Titik lokasi sudah ditandai di peta.</strong> Anda juga dapat menggeser pin
              merah langsung agar tepat di posisi usaha Anda.
            </span>
          </>
        ) : (
          <>
            <MapPin size={15} style={{ flexShrink: 0 }} />
            <span>
              Belum ada titik lokasi dipilih. Tempel link Google Maps, cari nama jalan, atau klik
              langsung pada peta di atas.
            </span>
          </>
        )}
      </div>
    </div>
  )
}
