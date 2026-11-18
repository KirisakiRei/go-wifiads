import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  Clock,
  ExternalLink,
  Eye,
  Film,
  Image as ImageIcon,
  MapPin,
  Pause,
  Pencil,
  Play,
  PlusCircle,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { EmptyState, LoadingState } from '@/components/feedback/query-state'
import { AdMediaThumb, StatusPill, WavyHeader } from '@/components/ui'
import { advertiserApi } from '@/features/marketplace/marketplace.api'
import { formatRupiah } from '@/lib/formatters'

function labelStatus(status: string): string {
  switch (status) {
    case 'PENDING_REVIEW':
      return 'Menunggu Persetujuan'
    case 'ACTIVE':
      return 'Sedang Tayang'
    case 'PAUSED':
      return 'Dijeda'
    case 'REJECTED':
      return 'Ditolak'
    case 'COMPLETED':
      return 'Selesai'
    default:
      return status
  }
}

export function AdvertiserCampaignsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isPending } = useQuery({
    queryKey: ['adv-campaigns', statusFilter],
    queryFn: () =>
      advertiserApi.listCampaigns({
        page: 1,
        per_page: 50,
        status: statusFilter || undefined,
      }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'PAUSE' | 'RESUME' }) =>
      advertiserApi.toggleCampaignStatus(id, action),
    onSuccess: () => {
      toast.success('Status iklan diperbarui')
      queryClient.invalidateQueries({ queryKey: ['adv-campaigns'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: advertiserApi.deleteCampaign,
    onSuccess: () => {
      toast.success('Iklan berhasil dihapus')
      queryClient.invalidateQueries({ queryKey: ['adv-campaigns'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isPending) return <LoadingState />

  const campaigns = data?.data || []

  return (
    <div>
      <WavyHeader
        title="Iklan Saya"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/campaigns/new')}
          >
            <PlusCircle size={18} />
            Pasang Iklan Baru
          </button>
        }
      />

      <div className="stitch-page-stage">
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '0.85rem 1.1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
            Total {campaigns.length} kampanye iklan
          </span>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '0.55rem 0.85rem' }}
          >
            <option value="">Semua Status</option>
            <option value="PENDING_REVIEW">Menunggu Persetujuan</option>
            <option value="ACTIVE">Sedang Tayang</option>
            <option value="PAUSED">Dijeda</option>
            <option value="REJECTED">Ditolak</option>
            <option value="COMPLETED">Selesai</option>
          </select>
        </div>

        {campaigns.length === 0 ? (
          <EmptyState
            title="Belum ada iklan yang dipasang"
            description="Klik tombol Pasang Iklan Baru untuk mengunggah materi promosi dan memilih titik lokasi di peta."
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/campaigns/new')}
              >
                <PlusCircle size={16} /> Pasang Iklan Pertama
              </button>
            }
          />
        ) : (
          <div className="ad-grid">
            {campaigns.map((c) => {
              const isVideo = c.media_type === 'video'
              return (
                <div key={c.id} className="ad-card">
                  <div
                    className="ad-media-thumb"
                    style={{ position: 'relative', background: '#05070c', cursor: 'pointer' }}
                    onClick={() => navigate(`/campaigns/${c.id}`)}
                    title="Klik untuk membuka detail iklan"
                  >
                    <AdMediaThumb
                      url={c.image_url}
                      mediaType={c.media_type}
                      alt={c.title}
                    />

                    <div className="ad-badge-overlay">
                      <StatusPill
                        variant={isVideo ? 'secondary' : 'basic'}
                        icon={isVideo ? Film : ImageIcon}
                      >
                        {isVideo ? 'Video' : 'Gambar'}
                      </StatusPill>
                      <StatusPill style={{ background: '#0f172a', color: '#ffffff' }}>
                        {c.layout_mode === 'portrait' ? 'Portrait' : 'Landscape'}
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
                      <h3
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: '#0f172a',
                          margin: 0,
                          cursor: 'pointer',
                        }}
                        onClick={() => navigate(`/campaigns/${c.id}`)}
                      >
                        {c.title}
                      </h3>
                      <StatusPill
                        variant={
                          c.status === 'ACTIVE'
                            ? 'active'
                            : c.status === 'PENDING_REVIEW'
                              ? 'basic'
                              : 'expired'
                        }
                        dot={c.status === 'ACTIVE'}
                      >
                        {labelStatus(c.status)}
                      </StatusPill>
                    </div>

                    {c.status === 'REJECTED' && c.rejection_reason && (
                      <div
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          color: '#991b1b',
                          padding: '0.55rem 0.7rem',
                          borderRadius: '8px',
                          fontSize: '12px',
                          display: 'flex',
                          gap: '0.4rem',
                        }}
                      >
                        <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                        <span>{c.rejection_reason}</span>
                      </div>
                    )}

                    {/* Counters Box */}
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
                        <div style={{ color: '#64748b', fontSize: '11px' }}>Tayangan</div>
                        <strong>{c.impressions_count.toLocaleString('id-ID')}</strong>
                      </div>
                      <div>
                        <div style={{ color: '#64748b', fontSize: '11px' }}>Klik Promo</div>
                        <strong>{c.clicks_count.toLocaleString('id-ID')}</strong>
                      </div>
                      <div>
                        <div style={{ color: '#64748b', fontSize: '11px' }}>Terpakai</div>
                        <strong style={{ color: '#065f46' }}>
                          {formatRupiah(c.spent_amount_idr)}
                        </strong>
                      </div>
                    </div>

                    <div style={{ fontSize: '12px', color: '#475569', display: 'grid', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <MapPin size={13} color="#2563eb" />
                        <span>
                          {c.target_routers.length} Lokasi (
                          {c.target_routers
                            .map((r) => r.router_name)
                            .slice(0, 2)
                            .join(', ')}
                          {c.target_routers.length > 2 ? ` +${c.target_routers.length - 2}` : ''})
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={13} color="#64748b" />
                        <span>
                          Jam {String(c.start_hour).padStart(2, '0')}:00 –{' '}
                          {String(c.end_hour).padStart(2, '0')}:00 • {c.duration_seconds} dtk
                        </span>
                      </div>
                      {c.target_url && (
                        <a
                          href={c.target_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#2563eb',
                            fontSize: '11px',
                          }}
                        >
                          Buka Link Promo <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="ad-card-footer" style={{ flexWrap: 'wrap', gap: '0.45rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 0.75rem', fontSize: '12px' }}
                      onClick={() => navigate(`/campaigns/${c.id}`)}
                    >
                      <Eye size={14} /> Detail
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 0.75rem', fontSize: '12px' }}
                      onClick={() => navigate(`/campaigns/${c.id}/edit`)}
                    >
                      <Pencil size={14} /> Edit
                    </button>

                    {c.status === 'ACTIVE' && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.45rem 0.75rem', fontSize: '12px' }}
                        onClick={() => toggleMutation.mutate({ id: c.id, action: 'PAUSE' })}
                      >
                        <Pause size={14} /> Jeda
                      </button>
                    )}

                    {c.status === 'PAUSED' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '0.45rem 0.75rem', fontSize: '12px' }}
                        onClick={() => toggleMutation.mutate({ id: c.id, action: 'RESUME' })}
                      >
                        <Play size={14} /> Lanjutkan
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '0.45rem 0.75rem', fontSize: '12px', marginLeft: 'auto' }}
                      onClick={() => {
                        if (window.confirm(`Hapus iklan "${c.title}"?`)) {
                          deleteMutation.mutate(c.id)
                        }
                      }}
                    >
                      <Trash2 size={14} /> Hapus
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
