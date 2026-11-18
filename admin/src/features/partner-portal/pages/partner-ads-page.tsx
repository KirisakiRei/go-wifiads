import { useQuery } from '@tanstack/react-query'
import { Clock, Eye, Film, Image as ImageIcon, X } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, LoadingState } from '@/components/feedback/query-state'
import { AdMediaThumb, AdPortalPreview, StatusPill, WavyHeader } from '@/components/ui'
import { partnerApi } from '@/features/marketplace/marketplace.api'
import type { PartnerAdItem } from '@/features/marketplace/marketplace.types'
import { formatRupiah } from '@/lib/formatters'

function formatAdStatus(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'Sedang Tayang'
    case 'PAUSED':
      return 'Dijeda'
    case 'COMPLETED':
      return 'Selesai'
    default:
      return status
  }
}

export function PartnerAdsPage() {
  const [previewAd, setPreviewAd] = useState<PartnerAdItem | null>(null)

  const { data: ads = [], isPending } = useQuery({
    queryKey: ['partner-ads'],
    queryFn: partnerApi.listAds,
  })

  if (isPending) return <LoadingState />

  return (
    <div>
      <WavyHeader title="Iklan di Lokasi Saya" />

      <div className="stitch-page-stage">
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '0.9rem 1.15rem',
            fontSize: '13px',
            color: '#475569',
          }}
        >
          Daftar materi iklan dari pengiklan yang ditayangkan melalui jaringan Wi-Fi di lokasi Anda.
        </div>

        {ads.length === 0 ? (
          <EmptyState
            title="Belum ada kampanye iklan berbayar di lokasi Anda"
            description="Saat belum ada kampanye berbayar yang aktif di jam tertentu, sistem menayangkan materi standar secara otomatis."
          />
        ) : (
          <div className="ad-grid">
            {ads.map((ad) => {
              const isVideo = ad.media_type === 'video'
              return (
                <div key={ad.id} className="ad-card">
                  <div
                    className="ad-media-thumb"
                    style={{ position: 'relative', background: '#05070c', cursor: 'pointer' }}
                    onClick={() => setPreviewAd(ad)}
                    title="Klik untuk melihat pratinjau layar"
                  >
                    <AdMediaThumb url={ad.image_url} mediaType={ad.media_type} alt={ad.title} />

                    <div className="ad-badge-overlay">
                      <StatusPill
                        variant={isVideo ? 'secondary' : 'basic'}
                        icon={isVideo ? Film : ImageIcon}
                      >
                        {isVideo ? 'Video' : 'Gambar'}
                      </StatusPill>
                    </div>
                  </div>

                  <div className="ad-card-body" style={{ display: 'grid', gap: '0.65rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                      }}
                    >
                      <div>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                          {ad.title}
                        </h3>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {ad.advertiser_name}
                        </span>
                      </div>
                      <StatusPill
                        variant={ad.status === 'ACTIVE' ? 'active' : 'expired'}
                        dot={ad.status === 'ACTIVE'}
                      >
                        {formatAdStatus(ad.status)}
                      </StatusPill>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.5rem',
                        background: '#f8fafc',
                        padding: '0.65rem',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Tayang di Lokasi</div>
                        <strong>{ad.impressions_at_venue.toLocaleString('id-ID')}</strong>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Klik Promo</div>
                        <strong>{ad.clicks_at_venue.toLocaleString('id-ID')}</strong>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Pendapatan</div>
                        <strong style={{ color: '#065f46' }}>{formatRupiah(ad.earned_idr)}</strong>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '12px',
                        color: '#64748b',
                      }}
                    >
                      <Clock size={13} />
                      <span>
                        Jam {String(ad.start_hour).padStart(2, '0')}:00 –{' '}
                        {String(ad.end_hour).padStart(2, '0')}:00 • {ad.duration_seconds} dtk
                      </span>
                    </div>
                  </div>

                  <div className="ad-card-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '100%', padding: '0.5rem' }}
                      onClick={() => setPreviewAd(ad)}
                    >
                      <Eye size={15} /> Lihat Pratinjau Tampilan
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Read-Only Preview Modal */}
      {previewAd && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewAd(null)
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '620px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <div className="table-toolbar" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px' }}>{previewAd.title}</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Oleh {previewAd.advertiser_name}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem' }}
                onClick={() => setPreviewAd(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '1.35rem' }}>
              <AdPortalPreview
                title={previewAd.title}
                body={previewAd.body}
                mediaUrl={previewAd.image_url}
                mediaType={previewAd.media_type}
                layoutMode={previewAd.layout_mode}
                durationSeconds={previewAd.duration_seconds}
                targetUrl={previewAd.target_url}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
