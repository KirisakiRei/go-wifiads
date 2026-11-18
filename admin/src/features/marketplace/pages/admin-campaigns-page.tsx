import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Check,
  Clock,
  ExternalLink,
  Eye,
  Megaphone,
  Pause,
  TrendingUp,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { EmptyState, LoadingState } from '@/components/feedback/query-state'
import {
  AdMediaThumb,
  AdPortalPreview,
  DataTableCard,
  KpiCard,
  KpiGrid,
  Pagination,
  SearchInput,
  StatusPill,
  WavyHeader,
} from '@/components/ui'
import { adminMarketplaceApi } from '@/features/marketplace/marketplace.api'
import type { CampaignItem } from '@/features/marketplace/marketplace.types'
import { formatRupiah } from '@/lib/formatters'

function formatCampaignStatus(status: string): string {
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

export function AdminCampaignsPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [previewCampaign, setPreviewCampaign] = useState<CampaignItem | null>(null)
  const [rejectingCampaign, setRejectingCampaign] = useState<CampaignItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data: campaignsRes, isPending } = useQuery({
    queryKey: ['admin-mkt-campaigns', page, statusFilter, search],
    queryFn: () =>
      adminMarketplaceApi.listCampaigns({
        page,
        per_page: 20,
        status: statusFilter || undefined,
        search: search || undefined,
      }),
  })

  const moderateMutation = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string
      action: 'APPROVE' | 'REJECT' | 'PAUSE'
      reason?: string
    }) => adminMarketplaceApi.moderateCampaign(id, { action, rejection_reason: reason }),
    onSuccess: () => {
      toast.success('Status iklan klien berhasil diperbarui')
      queryClient.invalidateQueries({ queryKey: ['admin-mkt-campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['admin-sidebar-badges'] })
      setRejectingCampaign(null)
      setRejectReason('')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isPending) return <LoadingState />

  const campaigns = campaignsRes?.data || []
  const meta = campaignsRes?.meta
  const pendingCount = campaigns.filter((c) => c.status === 'PENDING_REVIEW').length
  const activeCount = campaigns.filter((c) => c.status === 'ACTIVE').length
  const totalImpressions = campaigns.reduce((acc, c) => acc + c.impressions_count, 0)
  const totalSpent = campaigns.reduce((acc, c) => acc + c.spent_amount_idr, 0)

  return (
    <div>
      <WavyHeader title="Iklan Klien" />

      <div className="stitch-page-stage">
        <KpiGrid columns={4}>
          <KpiCard
            label="Menunggu Persetujuan"
            value={pendingCount}
            icon={Clock}
            iconColor="#f59e0b"
            iconBoxVariant="warning"
            subtext="Perlu ditinjau Admin"
          />
          <KpiCard
            label="Sedang Tayang"
            value={activeCount}
            icon={Megaphone}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext="Aktif di jaringan Wi-Fi"
          />
          <KpiCard
            label="Total Tayangan"
            value={totalImpressions.toLocaleString('id-ID')}
            icon={Eye}
            iconBoxVariant="secondary"
            subtext="Tayangan iklan berbayar"
          />
          <KpiCard
            label="Belanja Terealisasi"
            value={formatRupiah(totalSpent)}
            icon={TrendingUp}
            subtext="Akumulasi saldo terpotong"
          />
        </KpiGrid>

        <DataTableCard
          title="Moderasi & Pemantauan Iklan Klien"
          icon={Megaphone}
          toolbarActions={
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <SearchInput
                placeholder="Cari judul iklan..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                style={{ width: '220px' }}
              />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
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
          }
        >
          {campaigns.length === 0 ? (
            <div style={{ padding: '2rem' }}>
              <EmptyState title="Belum ada kampanye iklan klien yang sesuai filter." />
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Materi &amp; Pengiklan</th>
                      <th>Lokasi Mitra Target</th>
                      <th>Jadwal &amp; Durasi</th>
                      <th>Performa &amp; Biaya</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <button
                              type="button"
                              onClick={() => setPreviewCampaign(c)}
                              style={{
                                width: '60px',
                                height: '44px',
                                padding: 0,
                                borderRadius: '8px',
                                background: '#05070c',
                                border: '1px solid #cbd5e1',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                              title="Pratinjau Materi"
                            >
                              <AdMediaThumb
                                url={c.image_url}
                                mediaType={c.media_type}
                                alt={c.title}
                                playOnHover={false}
                                showPlayBadge={false}
                                objectFit="cover"
                              />
                            </button>
                            <div>
                              <strong
                                style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}
                              >
                                {c.title}
                              </strong>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>
                                {c.advertiser_company || c.advertiser_name || 'Pengiklan'}
                              </span>
                              {c.target_url && (
                                <a
                                  href={c.target_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '11px',
                                    color: '#2563eb',
                                    marginLeft: '8px',
                                  }}
                                >
                                  Link Promo <ExternalLink size={11} />
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '4px',
                              maxWidth: '250px',
                            }}
                          >
                            {c.target_routers.slice(0, 3).map((r) => (
                              <span
                                key={r.router_id}
                                style={{
                                  fontSize: '11px',
                                  background: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  padding: '2px 7px',
                                }}
                              >
                                {r.router_name} ({formatRupiah(r.unit_price_idr)})
                              </span>
                            ))}
                            {c.target_routers.length > 3 && (
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                +{c.target_routers.length - 3} lainnya
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontSize: '12px', color: '#334155' }}>
                          <div>
                            {String(c.start_hour).padStart(2, '0')}:00 –{' '}
                            {String(c.end_hour).padStart(2, '0')}:00
                          </div>
                          <small style={{ color: '#64748b' }}>
                            {c.duration_seconds} dtk •{' '}
                            {c.layout_mode === 'portrait' ? 'Portrait' : 'Landscape'}
                          </small>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <div>
                            <strong>{c.impressions_count}</strong> tayang •{' '}
                            <strong>{c.clicks_count}</strong> klik
                          </div>
                          <small style={{ color: '#065f46', fontWeight: 700 }}>
                            Terpakai: {formatRupiah(c.spent_amount_idr)}
                          </small>
                        </td>
                        <td>
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
                            {formatCampaignStatus(c.status)}
                          </StatusPill>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.38rem 0.65rem', fontSize: '12px' }}
                              onClick={() => setPreviewCampaign(c)}
                            >
                              <Eye size={13} /> Pratinjau
                            </button>
                            {c.status !== 'ACTIVE' && (
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{
                                  padding: '0.38rem 0.7rem',
                                  fontSize: '12px',
                                  background: '#16a34a',
                                }}
                                onClick={() =>
                                  moderateMutation.mutate({ id: c.id, action: 'APPROVE' })
                                }
                              >
                                <Check size={13} /> Setujui
                              </button>
                            )}
                            {c.status === 'ACTIVE' && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '0.38rem 0.7rem', fontSize: '12px' }}
                                onClick={() =>
                                  moderateMutation.mutate({ id: c.id, action: 'PAUSE' })
                                }
                              >
                                <Pause size={13} /> Jeda
                              </button>
                            )}
                            {c.status !== 'REJECTED' && (
                              <button
                                type="button"
                                className="btn btn-danger"
                                style={{ padding: '0.38rem 0.7rem', fontSize: '12px' }}
                                onClick={() => {
                                  setRejectingCampaign(c)
                                  setRejectReason(c.rejection_reason || '')
                                }}
                              >
                                Tolak
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {meta && meta.total_pages > 1 && <Pagination meta={meta} onPageChange={setPage} />}
            </>
          )}
        </DataTableCard>
      </div>

      {/* Modal: Realistic Preview */}
      {previewCampaign && (
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
            if (e.target === e.currentTarget) setPreviewCampaign(null)
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
              <h3 style={{ margin: 0, fontSize: '15px' }}>
                Pratinjau Iklan: {previewCampaign.title}
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem' }}
                onClick={() => setPreviewCampaign(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '1.35rem', display: 'grid', gap: '1rem' }}>
              <AdPortalPreview
                title={previewCampaign.title}
                body={previewCampaign.body}
                mediaUrl={previewCampaign.image_url}
                mediaType={previewCampaign.media_type}
                layoutMode={previewCampaign.layout_mode}
                durationSeconds={previewCampaign.duration_seconds}
                targetUrl={previewCampaign.target_url}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reject Campaign */}
      {rejectingCampaign && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              padding: '1.5rem',
              display: 'grid',
              gap: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px' }}>Tolak Iklan: {rejectingCampaign.title}</h3>
            <div className="form-field">
              <label>Alasan Penolakan untuk Pengiklan</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Resolusi gambar buram atau konten belum sesuai dengan lokasi kafe."
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRejectingCampaign(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() =>
                  moderateMutation.mutate({
                    id: rejectingCampaign.id,
                    action: 'REJECT',
                    reason: rejectReason,
                  })
                }
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
