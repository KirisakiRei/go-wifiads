import { Image as ImageIcon, Play } from 'lucide-react'
import { useRef, useState } from 'react'

export function resolveAdMediaUrl(raw?: string): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  const r2Idx = trimmed.indexOf('.r2.dev/ads/')
  if (r2Idx !== -1) {
    const key = trimmed.slice(r2Idx + '.r2.dev/'.length).replace(/^\/+/, '')
    return `/uploads/${key}`
  }
  return trimmed
}

interface AdMediaThumbProps {
  url?: string
  mediaType: 'image' | 'video'
  alt: string
  playOnHover?: boolean
  showPlayBadge?: boolean
  objectFit?: 'contain' | 'cover'
}

export function AdMediaThumb({
  url,
  mediaType,
  alt,
  playOnHover = true,
  showPlayBadge = true,
  objectFit = 'contain',
}: AdMediaThumbProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasError, setHasError] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const src = resolveAdMediaUrl(url)

  if (!src || hasError) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
          background: '#0f172a',
          color: '#64748b',
          fontSize: '12px',
        }}
      >
        <ImageIcon size={24} />
      </div>
    )
  }

  if (mediaType === 'video') {
    const seekPreviewFrame = (el: HTMLVideoElement) => {
      try {
        if (el.paused && el.currentTime < 0.1) {
          const target = Math.min(0.8, Math.max(0.15, (el.duration || 2) * 0.12))
          el.currentTime = target
        }
      } catch {
        /* ignore seek errors before metadata ready */
      }
    }

    return (
      <div
        style={{ position: 'relative', width: '100%', height: '100%', background: '#05070c' }}
        onMouseEnter={() => {
          if (!playOnHover || !videoRef.current) return
          videoRef.current
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => {})
        }}
        onMouseLeave={() => {
          if (!playOnHover || !videoRef.current) return
          videoRef.current.pause()
          setIsPlaying(false)
          seekPreviewFrame(videoRef.current)
        }}
      >
        <video
          key={src}
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => seekPreviewFrame(e.currentTarget)}
          onLoadedData={(e) => seekPreviewFrame(e.currentTarget)}
          onError={() => setHasError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit,
            display: 'block',
          }}
        />

        {showPlayBadge && !isPlaying && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(5, 7, 12, 0.24)',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.92)',
                color: '#1d4ed8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 18px rgba(0, 0, 0, 0.38)',
              }}
            >
              <Play size={18} fill="#1d4ed8" style={{ marginLeft: '2px' }} />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <img
      key={src}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setHasError(true)}
      style={{
        width: '100%',
        height: '100%',
        objectFit,
        display: 'block',
      }}
    />
  )
}
