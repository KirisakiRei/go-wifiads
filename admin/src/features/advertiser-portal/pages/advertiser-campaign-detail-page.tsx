import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  Eye,
  MapPin,
  MousePointerClick,
  Pause,
  Pencil,
  Play,
  Trash2,
  Wallet,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { ErrorState, LoadingState } from '@/components/feedback/query-state'
import {
  AdPortalPreview,
  DataTableCard,
  KpiCard,
  KpiGrid,
  StatusPill,
  WavyHeader,
} from '@/components/ui'
import { advertiserApi } from '@/features/marketplace/marketplace.api'
import { formatDate, formatRupiah } from '@/lib/formatters'

const DAY_LABELS: Record<string, string> = {
  '1': 'Senin',
  '2': 'Selasa',
  '3': 'Rabu',
  '4': 'Kamis',
  '5': 'Jumat',
  '6': 'Sabtu',
  '7': 'Minggu',
}

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

function formatActiveDays(daysRaw: string): string {
  const keys = (daysRaw || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
  if (keys.length === 0 || keys.length === 7) return 'Setiap Hari (Senin – Minggu)'
  return keys.map((k) => DAY_LABELS[k] || k).join(', ')
}

export function AdvertiserCampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: campaign, isPending, error } = useQuery({
    queryKey: ['adv-campaign', id],
    queryFn: () => advertiserApi.getCampaign(id!),
    enabled: Boolean(id),
  })

  const toggleMutation = useMutation({
    mutationFn: (action: 'PAUSE' | 'RESUME') => advertiserApi.toggleCampaignStatus(id!, action),
    onSuccess: () => {
      toast.success('Status iklan berhasil diperbarui')
      queryClient.invalidateQueries({ queryKey: ['adv-campaign', id] })
      queryClient.invalidateQueries({ queryKey: ['adv-campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['adv-overview'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => advertiserApi.deleteCampaign(id!),
    onSuccess: () => {
      toast.success('Iklan berhasil dihapus')
      queryClient.invalidateQueries({ queryKey: ['adv-campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['adv-overview'] })
      navigate('/campaigns')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isPending) return <LoadingState />
  if (error || !campaign) return <ErrorState message="Detail iklan tidak ditemukan." />

  const ctr =
    campaign.impressions_count > 0
      ? ((campaign.clicks_count * 100) / campaign.impressions_count).toFixed(1)
      : '0.0'

  const remainingBudgetText =
    campaign.total_budget_idr > 0
      ? formatRupiah(Math.max(0, campaign.total_budget_idr - campaign.spent_amount_idr))
      : 'Mengikuti saldo dompet'

  return (
    <div>
      <WavyHeader
        title={campaign.title}
        actions={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
            <Link to="/campaigns" className="btn btn-secondary">
              <ArrowLeft size={16} /> Kembali
            </Link>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(`/campaigns/${campaign.id}/edit?step=2`)}
            >
              <MapPin size={16} /> Ubah Lokasi ({campaign.target_routers.length})
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(`/campaigns/${campaign.id}/edit`)}
            >
              <Pencil size={16} /> Edit Iklan
            </button>
          </div>
        }
      />

      <div className="stitch-page-stage">
        {/* Rejection Banner */}
        {campaign.status === 'REJECTED' && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '1rem 1.25rem',
              borderRadius: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13px' }}>
                <strong>Pengajuan iklan ditolak:</strong>{' '}
                {campaign.rejection_reason || 'Materi belum sesuai ketentuan.'}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '0.5rem 0.95rem', fontSize: '12px' }}
              onClick={() => navigate(`/campaigns/${campaign.id}/edit`)}
            >
              <Pencil size={14} /> Perbaiki &amp; Ajukan Ulang
            </button>
          </div>
        )}

        {/* KPI Counters */}
        <KpiGrid columns={4}>
          <KpiCard
            label="Total Tayangan"
            value={campaign.impressions_count.toLocaleString('id-ID')}
            icon={Eye}
            subtext={
              (campaign.completions_count ?? 0) > 0
                ? `Selesai ${campaign.completion_rate_percent ?? 0}% · rata-rata ${campaign.avg_watch_seconds ?? 0} dtk`
                : `Durasi ${campaign.duration_seconds} detik per tayang`
            }
          />
          <KpiCard
            label="Klik Promo"
            value={campaign.clicks_count.toLocaleString('id-ID')}
            icon={MousePointerClick}
            iconBoxVariant="secondary"
            subtext={`Rasio klik ${ctr}%`}
          />
          <KpiCard
            label="Biaya Terpakai"
            value={formatRupiah(campaign.spent_amount_idr)}
            icon={Wallet}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext={`Hari ini: ${formatRupiah(campaign.daily_spent_today_idr)}`}
          />
          <KpiCard
            label="Sisa Anggaran"
            value={remainingBudgetText}
            icon={Calendar}
            subtext={
              campaign.daily_budget_idr > 0
                ? `Batas harian ${formatRupiah(campaign.daily_budget_idr)}`
                : 'Tanpa batas harian'
            }
          />
        </KpiGrid>

        {/* Two-Column Main Stage: Realistic Preview + Campaign Information */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '1.5rem',
            alignItems: 'start',
          }}
        >
          {/* Left: Realistic Portal Preview */}
          <div
            className="stitch-card-container"
            style={{ background: '#ffffff', padding: '1.5rem', display: 'grid', gap: '1.1rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Pratinjau Tampilan Iklan</h3>
              <StatusPill
                variant={
                  campaign.status === 'ACTIVE'
                    ? 'active'
                    : campaign.status === 'PENDING_REVIEW'
                      ? 'basic'
                      : 'expired'
                }
                dot={campaign.status === 'ACTIVE'}
              >
                {labelStatus(campaign.status)}
              </StatusPill>
            </div>

            <AdPortalPreview
              title={campaign.title}
              body={campaign.body}
              mediaUrl={campaign.image_url}
              mediaType={campaign.media_type}
              layoutMode={campaign.layout_mode}
              durationSeconds={campaign.duration_seconds}
              targetUrl={campaign.target_url}
            />

            {/* Status & Lifecycle Controls */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.6rem',
                paddingTop: '1rem',
                borderTop: '1px solid #e2e8f0',
              }}
            >
              {campaign.status === 'ACTIVE' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate('PAUSE')}
                >
                  <Pause size={15} /> Jeda Penayangan
                </button>
              )}

              {campaign.status === 'PAUSED' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate('RESUME')}
                >
                  <Play size={15} /> Lanjutkan Penayangan
                </button>
              )}

              <button
                type="button"
                className="btn btn-danger"
                style={{ marginLeft: 'auto' }}
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm(`Hapus iklan "${campaign.title}" secara permanen?`)) {
                    deleteMutation.mutate()
                  }
                }}
              >
                <Trash2 size={15} /> Hapus Iklan
              </button>
            </div>
          </div>

          {/* Right: Details & Schedule */}
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <div
              className="stitch-card-container"
              style={{ background: '#ffffff', padding: '1.5rem', display: 'grid', gap: '1rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Rincian Materi &amp; Jadwal</h3>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '12px' }}
                  onClick={() => navigate(`/campaigns/${campaign.id}/edit`)}
                >
                  <Pencil size={13} /> Ubah Detail
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: '0.75rem',
                  fontSize: '13px',
                  color: '#334155',
                }}
              >
                <div style={{ paddingBottom: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>Judul &amp; Keterangan</div>
                  <strong style={{ color: '#0f172a', display: 'block', fontSize: '14px' }}>{campaign.title}</strong>
                  <span style={{ color: '#475569' }}>
                    {campaign.body || 'Tidak ada teks keterangan tambahan.'}
                  </span>
                </div>

                {campaign.target_url && (
                  <div style={{ paddingBottom: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>Link Tujuan / Promo</div>
                    <a
                      href={campaign.target_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      {campaign.target_url} <ExternalLink size={13} />
                    </a>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingBottom: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Format &amp; Orientasi</div>
                    <strong>
                      {campaign.media_type === 'video' ? 'Video' : 'Gambar'} •{' '}
                      {campaign.layout_mode === 'portrait' ? 'Portrait (9:16)' : 'Landscape (16:9)'}
                    </strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Durasi Tayang</div>
                    <strong>{campaign.duration_seconds} detik</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingBottom: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> Jam Operasional
                    </div>
                    <strong>
                      {campaign.start_hour === 0 && campaign.end_hour === 24
                        ? 'Sepanjang Hari (24 Jam)'
                        : `${String(campaign.start_hour).padStart(2, '0')}:00 – ${String(campaign.end_hour).padStart(2, '0')}:00 WIB`}
                    </strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Periode Tanggal</div>
                    <strong>
                      {campaign.start_date ? formatDate(campaign.start_date) : 'Langsung tayang'}
                      {campaign.end_date ? ` s/d ${formatDate(campaign.end_date)}` : ' (Tanpa batas akhir)'}
                    </strong>
                  </div>
                </div>

                <div style={{ paddingBottom: '0.7rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Hari Penayangan Aktif</div>
                  <strong>{formatActiveDays(campaign.active_days)}</strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Batas Anggaran Harian</div>
                    <strong>
                      {campaign.daily_budget_idr > 0 ? formatRupiah(campaign.daily_budget_idr) : 'Tidak dibatasi'}
                    </strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Total Anggaran Iklan</div>
                    <strong>
                      {campaign.total_budget_idr > 0 ? formatRupiah(campaign.total_budget_idr) : 'Mengikuti saldo dompet'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Target Router Locations Card */}
            <DataTableCard
              title={`Lokasi Router Target (${campaign.target_routers.length})`}
              icon={MapPin}
              toolbarActions={
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '12px' }}
                  onClick={() => navigate(`/campaigns/${campaign.id}/edit?step=2`)}
                >
                  <MapPin size={13} /> Ubah Lokasi
                </button>
              }
            >
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Nama Lokasi</th>
                      <th>Rank Lokasi</th>
                      <th style={{ textAlign: 'right' }}>Tarif / Tayang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaign.target_routers.map((r) => (
                      <tr key={r.router_id}>
                        <td>
                          <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                            {r.router_name}
                          </strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {r.venue_category || 'Kafe'}
                            {r.location_address ? ` • ${r.location_address}` : ''}
                          </span>
                        </td>
                        <td>
                          <StatusPill variant="basic">
                            {r.tier_name} ({r.multiplier}x)
                          </StatusPill>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#1d4ed8' }}>
                          {formatRupiah(r.unit_price_idr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DataTableCard>
          </div>
        </div>
      </div>
    </div>
  )
}
