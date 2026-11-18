import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { EmptyState, LoadingState } from '@/components/feedback/query-state'
import {
  DataTableCard,
  KpiCard,
  KpiGrid,
  Pagination,
  SearchInput,
  StatusPill,
  WavyHeader,
} from '@/components/ui'
import { adminMarketplaceApi } from '@/features/marketplace/marketplace.api'
import type { AdminWithdrawalItem } from '@/features/marketplace/marketplace.types'
import { formatDate, formatRupiah } from '@/lib/formatters'

function formatWdStatus(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Menunggu Transfer'
    case 'PAID':
      return 'Selesai Ditransfer'
    case 'REJECTED':
      return 'Ditolak & Dikembalikan'
    default:
      return status
  }
}

export function AdminWithdrawalsPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [processingWd, setProcessingWd] = useState<AdminWithdrawalItem | null>(null)
  const [proofUrl, setProofUrl] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [uploadingProof, setUploadingProof] = useState(false)
  const [previewProof, setPreviewProof] = useState<string | null>(null)

  const { data: wdRes, isPending } = useQuery({
    queryKey: ['admin-withdrawals', page, statusFilter, search],
    queryFn: () =>
      adminMarketplaceApi.listWithdrawals({
        page,
        per_page: 20,
        status: statusFilter || undefined,
        search: search || undefined,
      }),
  })

  const processMutation = useMutation({
    mutationFn: ({
      id,
      action,
      proof_image_url,
      admin_note,
    }: {
      id: string
      action: 'APPROVE' | 'REJECT'
      proof_image_url?: string
      admin_note?: string
    }) => adminMarketplaceApi.processWithdrawal(id, { action, proof_image_url, admin_note }),
    onSuccess: () => {
      toast.success('Status pencairan dana berhasil diperbarui')
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] })
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] })
      queryClient.invalidateQueries({ queryKey: ['admin-finance'] })
      queryClient.invalidateQueries({ queryKey: ['admin-sidebar-badges'] })
      setProcessingWd(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isPending) return <LoadingState />

  const items = wdRes?.data || []
  const meta = wdRes?.meta
  const pendingItems = items.filter((w) => w.status === 'PENDING')
  const pendingAmount = pendingItems.reduce((acc, w) => acc + w.amount_idr, 0)
  const paidItems = items.filter((w) => w.status === 'PAID')
  const paidAmount = paidItems.reduce((acc, w) => acc + w.amount_idr, 0)

  return (
    <div>
      <WavyHeader title="Pencairan Bagi Hasil Mitra" />

      <div className="stitch-page-stage">
        <KpiGrid columns={4}>
          <KpiCard
            label="Menunggu Transfer"
            value={pendingItems.length}
            icon={Clock}
            iconColor="#f59e0b"
            iconBoxVariant="warning"
            subtext="Pengajuan tarik dana baru"
          />
          <KpiCard
            label="Nominal Antrean"
            value={formatRupiah(pendingAmount)}
            icon={CreditCard}
            subtext="Perlu ditransfer ke mitra"
          />
          <KpiCard
            label="Selesai Ditransfer"
            value={paidItems.length}
            icon={CheckCircle2}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext="Pencairan selesai"
          />
          <KpiCard
            label="Total Dana Cair"
            value={formatRupiah(paidAmount)}
            icon={Wallet}
            iconBoxVariant="secondary"
            subtext="Pada halaman ini"
          />
        </KpiGrid>

        <DataTableCard
          title="Daftar Pengajuan Pencairan Dana Mitra"
          icon={ArrowUpRight}
          toolbarActions={
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <SearchInput
                placeholder="Cari nomor atau pemilik rekening..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                style={{ width: '240px' }}
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
                <option value="PENDING">Menunggu Transfer</option>
                <option value="PAID">Selesai Ditransfer</option>
                <option value="REJECTED">Ditolak</option>
              </select>
            </div>
          }
        >
          {items.length === 0 ? (
            <div style={{ padding: '2rem' }}>
              <EmptyState title="Belum ada pengajuan pencairan dana dari mitra." />
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Nomor Pengajuan</th>
                      <th>Mitra Lokasi</th>
                      <th>Rekening Tujuan</th>
                      <th>Nominal</th>
                      <th>Bukti Transfer</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((w) => (
                      <tr key={w.id}>
                        <td>
                          <code style={{ fontWeight: 700, color: '#1d4ed8' }}>
                            {w.withdrawal_number}
                          </code>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {formatDate(w.created_at)}
                          </div>
                        </td>
                        <td>
                          <strong style={{ display: 'block', color: '#0f172a' }}>
                            {w.venue_name || w.partner_name}
                          </strong>
                          <small style={{ color: '#64748b' }}>
                            {w.partner_name} • {w.partner_email}
                          </small>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <div>
                            <strong>{w.bank_name}</strong> —{' '}
                            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                              {w.bank_account_number}
                            </span>
                          </div>
                          <small style={{ color: '#64748b' }}>a.n. {w.bank_account_holder}</small>
                        </td>
                        <td>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                            {formatRupiah(w.amount_idr)}
                          </strong>
                        </td>
                        <td>
                          {w.proof_image_url ? (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '11px' }}
                              onClick={() => setPreviewProof(w.proof_image_url)}
                            >
                              <Eye size={13} /> Lihat Bukti
                            </button>
                          ) : (
                            <small style={{ color: '#94a3b8' }}>—</small>
                          )}
                        </td>
                        <td>
                          <StatusPill
                            variant={
                              w.status === 'PAID'
                                ? 'active'
                                : w.status === 'PENDING'
                                  ? 'basic'
                                  : 'expired'
                            }
                            dot={w.status === 'PENDING'}
                          >
                            {formatWdStatus(w.status)}
                          </StatusPill>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {w.status === 'PENDING' ? (
                            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{
                                  padding: '0.38rem 0.7rem',
                                  fontSize: '12px',
                                  background: '#16a34a',
                                }}
                                onClick={() => {
                                  setProcessingWd(w)
                                  setProofUrl('')
                                  setAdminNote('Dana bagi hasil telah ditransfer ke rekening mitra.')
                                }}
                              >
                                <Check size={13} /> Konfirmasi Transfer
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger"
                                style={{ padding: '0.38rem 0.65rem', fontSize: '12px' }}
                                onClick={() => {
                                  const reason = window.prompt(
                                    'Alasan penolakan (saldo otomatis dikembalikan ke akun mitra):',
                                    'Nomor rekening tujuan tidak valid.'
                                  )
                                  if (reason !== null) {
                                    processMutation.mutate({
                                      id: w.id,
                                      action: 'REJECT',
                                      admin_note: reason,
                                    })
                                  }
                                }}
                              >
                                Tolak
                              </button>
                            </div>
                          ) : (
                            <small style={{ color: '#64748b' }}>
                              {w.processed_at ? formatDate(w.processed_at) : 'Selesai'}
                            </small>
                          )}
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

      {/* Modal: Approve Withdrawal */}
      {processingWd && (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Konfirmasi Transfer Pencairan</h3>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem' }}
                onClick={() => setProcessingWd(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '0.85rem',
                fontSize: '12px',
                display: 'grid',
                gap: '4px',
              }}
            >
              <div>
                <strong>Mitra:</strong> {processingWd.venue_name} ({processingWd.partner_name})
              </div>
              <div>
                <strong>Tujuan:</strong> {processingWd.bank_name} — {processingWd.bank_account_number}{' '}
                (a.n. {processingWd.bank_account_holder})
              </div>
              <div>
                <strong>Nominal Transfer:</strong>{' '}
                <strong style={{ color: '#1d4ed8', fontSize: '14px' }}>
                  {formatRupiah(processingWd.amount_idr)}
                </strong>
              </div>
            </div>

            <div className="form-field">
              <label>Unggah Bukti Transfer (Opsional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  try {
                    setUploadingProof(true)
                    const res = await adminMarketplaceApi.uploadPayoutProof(f)
                    setProofUrl(res.url)
                    toast.success('Bukti transfer diunggah')
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Gagal mengunggah bukti')
                  } finally {
                    setUploadingProof(false)
                  }
                }}
              />
              {uploadingProof && <small>Mengunggah bukti transfer...</small>}
              {proofUrl && (
                <img
                  src={proofUrl}
                  alt="Bukti"
                  style={{ maxHeight: '120px', borderRadius: '8px', marginTop: '0.4rem' }}
                />
              )}
            </div>

            <div className="form-field">
              <label>Catatan untuk Mitra</label>
              <input value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setProcessingWd(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={processMutation.isPending || uploadingProof}
                onClick={() =>
                  processMutation.mutate({
                    id: processingWd.id,
                    action: 'APPROVE',
                    proof_image_url: proofUrl,
                    admin_note: adminNote,
                  })
                }
              >
                <Check size={15} /> Tandai Selesai Ditransfer
              </button>
            </div>
          </div>
        </div>
      )}

      {previewProof && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setPreviewProof(null)}
        >
          <div
            style={{
              background: '#ffffff',
              padding: '1rem',
              borderRadius: '14px',
              maxWidth: '520px',
              maxHeight: '88vh',
              overflow: 'auto',
            }}
          >
            <img
              src={previewProof}
              alt="Bukti Pencairan"
              style={{ width: '100%', borderRadius: '8px' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
