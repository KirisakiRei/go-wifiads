import { Clock, ExternalLink, Film, Image as ImageIcon, Lock, Monitor, Smartphone } from 'lucide-react'
import { resolveAdMediaUrl } from './ad-media-thumb'

interface AdPortalPreviewProps {
  title?: string
  body?: string
  mediaUrl?: string
  mediaType: 'image' | 'video'
  layoutMode: 'landscape' | 'portrait'
  durationSeconds: number
  targetUrl?: string
  emptyMessage?: string
}

export function AdPortalPreview({
  title,
  body,
  mediaUrl,
  mediaType,
  layoutMode,
  durationSeconds,
  targetUrl,
  emptyMessage = 'Unggah gambar atau video untuk melihat pratinjau tampilan',
}: AdPortalPreviewProps) {
  const src = resolveAdMediaUrl(mediaUrl)
  const hasRealMedia = Boolean(src && src !== '/static/img/ad-placeholder.svg')
  const displayDuration = durationSeconds > 0 ? durationSeconds : 15
  const isPortrait = layoutMode === 'portrait'

  const renderMediaContent = () => {
    if (!src) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.55rem',
            padding: '1.5rem',
            textAlign: 'center',
            color: '#94a3b8',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#60a5fa',
            }}
          >
            {mediaType === 'video' ? <Film size={22} /> : <ImageIcon size={22} />}
          </div>
          <span style={{ fontSize: '12px', lineHeight: 1.45, maxWidth: '210px' }}>{emptyMessage}</span>
        </div>
      )
    }

    if (mediaType === 'video') {
      return (
        <video
          key={src}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      )
    }

    return (
      <img
        key={src}
        src={src}
        alt={title || 'Pratinjau iklan'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
      {/* Device Indicator Pill */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.3rem 0.75rem',
          borderRadius: '999px',
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          fontSize: '11px',
          fontWeight: 700,
          color: '#334155',
        }}
      >
        {isPortrait ? <Smartphone size={13} color="#2563eb" /> : <Monitor size={13} color="#2563eb" />}
        <span>{isPortrait ? 'Mode Smartphone • Portrait (9:16)' : 'Mode Desktop • Landscape (16:9)'}</span>
      </div>

      {isPortrait ? (
        /* ==================== SMARTPHONE 9:16 FRAME ==================== */
        <div
          style={{
            position: 'relative',
            width: '264px',
            maxWidth: '100%',
            padding: '9px',
            borderRadius: '36px',
            background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid #334155',
            boxShadow: '0 20px 42px rgba(15, 23, 42, 0.24), inset 0 1px 1px rgba(255, 255, 255, 0.12)',
          }}
        >
          {/* Screen Viewport (True 9:16) */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '9 / 16',
              borderRadius: '28px',
              background: '#05070c',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Dynamic Island / Speaker Notch */}
            <div
              style={{
                position: 'absolute',
                top: '8px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '72px',
                height: '18px',
                borderRadius: '999px',
                background: '#020617',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                zIndex: 4,
              }}
            />

            {/* Top HUD Overlay */}
            <div
              style={{
                position: 'absolute',
                top: '32px',
                left: '12px',
                right: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 3,
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  background: 'rgba(15, 23, 42, 0.72)',
                  backdropFilter: 'blur(8px)',
                  color: '#e2e8f0',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                }}
              >
                Iklan
              </span>
              <span
                style={{
                  background: 'rgba(15, 23, 42, 0.82)',
                  backdropFilter: 'blur(8px)',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Clock size={10} /> Sisa {displayDuration} dtk
              </span>
            </div>

            {/* Media Stage */}
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {renderMediaContent()}
            </div>

            {/* Bottom Caption & Action Overlay */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: '28px 14px 16px',
                background: 'linear-gradient(to top, rgba(5, 7, 12, 0.96) 0%, rgba(5, 7, 12, 0.78) 62%, transparent 100%)',
                color: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                zIndex: 3,
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.3 }}>
                {title || (hasRealMedia ? 'Judul Iklan Anda' : 'Judul Iklan')}
              </div>
              {body && (
                <div
                  style={{
                    fontSize: '11px',
                    color: '#cbd5e1',
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {body}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                {targetUrl && (
                  <span
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.14)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '6px 8px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    Lihat Promo <ExternalLink size={10} />
                  </span>
                )}
                <span
                  style={{
                    flex: 1.2,
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '6px 10px',
                    borderRadius: '8px',
                    textAlign: 'center',
                  }}
                >
                  Hubungkan Wi-Fi
                </span>
              </div>

              {/* Home Bar */}
              <div
                style={{
                  width: '82px',
                  height: '4px',
                  borderRadius: '999px',
                  background: 'rgba(255, 255, 255, 0.32)',
                  margin: '4px auto 0',
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        /* ==================== DESKTOP 16:9 FRAME ==================== */
        <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Monitor Bezel */}
          <div
            style={{
              width: '100%',
              borderRadius: '14px',
              border: '7px solid #0f172a',
              background: '#0f172a',
              boxShadow: '0 18px 38px rgba(15, 23, 42, 0.2)',
              overflow: 'hidden',
            }}
          >
            {/* Browser Chrome Top Bar */}
            <div
              style={{
                height: '26px',
                background: '#1e293b',
                padding: '0 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
              }}
            >
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
              </div>
              <div
                style={{
                  background: '#0f172a',
                  color: '#94a3b8',
                  fontSize: '10px',
                  padding: '2px 14px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Lock size={9} color="#22c55e" />
                <span>portal.wifi</span>
              </div>
              <div style={{ width: '34px' }} />
            </div>

            {/* Screen Viewport (True 16:9) */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 9',
                background: '#05070c',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Top HUD */}
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '12px',
                  right: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  zIndex: 3,
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    background: 'rgba(15, 23, 42, 0.72)',
                    backdropFilter: 'blur(8px)',
                    color: '#e2e8f0',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                  }}
                >
                  Iklan
                </span>
                <span
                  style={{
                    background: 'rgba(15, 23, 42, 0.82)',
                    backdropFilter: 'blur(8px)',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Clock size={10} /> Sisa {displayDuration} dtk
                </span>
              </div>

              {/* Media Stage */}
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {renderMediaContent()}
              </div>

              {/* Bottom Desktop Overlay Bar */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: '22px 14px 11px',
                  background: 'linear-gradient(to top, rgba(5, 7, 12, 0.95) 0%, rgba(5, 7, 12, 0.68) 62%, transparent 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  zIndex: 3,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      lineHeight: 1.25,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {title || (hasRealMedia ? 'Judul Iklan Anda' : 'Judul Iklan')}
                  </div>
                  {body && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#cbd5e1',
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {body}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  {targetUrl && (
                    <span
                      style={{
                        background: 'rgba(255, 255, 255, 0.14)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '5px 9px',
                        borderRadius: '7px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      Lihat Promo <ExternalLink size={10} />
                    </span>
                  )}
                  <span
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '5px 11px',
                      borderRadius: '7px',
                    }}
                  >
                    Hubungkan Wi-Fi
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Stand Neck & Base */}
          <div
            style={{
              width: '58px',
              height: '14px',
              background: 'linear-gradient(180deg, #334155 0%, #64748b 100%)',
              clipPath: 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)',
            }}
          />
          <div
            style={{
              width: '132px',
              height: '6px',
              borderRadius: '999px',
              background: 'linear-gradient(90deg, #64748b 0%, #94a3b8 50%, #64748b 100%)',
              boxShadow: '0 3px 8px rgba(15, 23, 42, 0.16)',
            }}
          />
        </div>
      )}
    </div>
  )
}
