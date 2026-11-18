import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, CheckCircle2, Clock, CreditCard, Eye, Wallet } from 'lucide-react'
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
import { formatDate, formatRupiah } from '@/lib/formatters'

function formatTopupStatus(status: string): string {
  switch (status) {
    case 'PENDING_PROOF':
      return 'Belum Unggah Bukti'
    case 'WAITING_VERIFICATION':
      return 'Menunggu Konfirmasi'
    case 'PAID':
      return 'Lunas'
    case 'REJECTED':
      return 'Ditolak'
    default:
      return status
  }
}

export function AdminTopupsPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null)

  const { data: topupsRes, isPending } = useQuery({
    queryKey: ['admin-mkt-topups', page, statusFilter, search],
    queryFn: () =>
      adminMarketplaceApi.listTopups({
        page,
        per_page: 20,
        status: statusFilter || undefined,
        search: search || undefined,
      }),
  })

  const verifyTopupMutation = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'APPROVE' | 'REJECT'; note?: string }) =>
      adminMarketplaceApi.verifyTopup(id, { action, admin_note: note }),
    onSuccess: () => {
      toast.success('Status Top-Up berhasil diperbarui')
      queryClient.invalidateQueries({ queryKey: ['admin-mkt-topups'] })
      queryClient.invalidateQueries({ queryKey: ['admin-mkt-advertisers'] })
      queryClient.invalidateQueries({ queryKey: ['admin-finance'] })
      queryClient.invalidateQueries({ queryKey: ['admin-sidebar-badges'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isPending) return <LoadingState />

  const topups = topupsRes?.data || []
  const meta = topupsRes?.meta
  const waitingList = topups.filter((t) => t.status === 'WAITING_VERIFICATION')
  const waitingAmount = waitingList.reduce((acc, t) => acc + t.amount_idr, 0)
  const paidList = topups.filter((t) => t.status === 'PAID')
  const paidAmount = paidList.reduce((acc, t) => acc + t.amount_idr, 0)

  return (
    <div>
      <WavyHeader title="Top-Up Pengiklan" />

      <div className="stitch-page-stage">
        <KpiGrid columns={4}>
          <KpiCard
            label="Menunggu Konfirmasi"
            value={waitingList.length}
            icon={Clock}
            iconColor="#f59e0b"
            iconBoxVariant="warning"
            subtext="Bukti transfer masuk"
          />
          <KpiCard
            label="Nominal Menunggu"
            value={formatRupiah(waitingAmount)}
            icon={CreditCard}
            subtext="Perlu dicek mutasi rekening"
          />
          <KpiCard
            label="Tagihan Lunas"
            value={paidList.length}
            icon={CheckCircle2}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext="Saldo sudah ditambahkan"
          />
          <KpiCard
            label="Total Top-Up Masuk"
            value={formatRupiah(paidAmount)}
            icon={Wallet}
            iconBoxVariant="secondary"
            subtext="Pada daftar halaman ini"
          />
        </KpiGrid>

        <DataTableCard
          title="Verifikasi Pembayaran Top-Up"
          icon={Wallet}
          toolbarActions={
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <SearchInput
                placeholder="Cari nomor tagihan / pengirim..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                style={{ width: '230px' }}
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
                <option value="WAITING_VERIFICATION">Menunggu Konfirmasi</option>
                <option value="PENDING_PROOF">Belum Unggah Bukti</option>
                <option value="PAID">Lunas</option>
                <option value="REJECTED">Ditolak</option>
              </select>
            </div>
          }
        >
          {topups.length === 0 ? (
            <div style={{ padding: '2rem' }}>
              <EmptyState title="Belum ada tagihan Top-Up yang sesuai pencarian." />
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Nomor Tagihan</th>
                      <th>Pengiklan</th>
                      <th>Tujuan &amp; Pengirim</th>
                      <th>Nominal</th>
                      <th>Bukti Bayar</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topups.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <code style={{ fontWeight: 700, color: '#1d4ed8' }}>
                            {t.invoice_number}
                          </code>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {formatDate(t.created_at)}
                          </div>
                        </td>
                        <td>
                          <strong style={{ fontSize: '13px', display: 'block' }}>
                            {t.advertiser_name || '—'}
                          </strong>
                          <small style={{ color: '#64748b' }}>
                            {t.advertiser_company || t.advertiser_email}
                          </small>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <div>
                            <strong>{t.payment_provider_name}</strong>
                          </div>
                          {t.sender_name && (
                            <small style={{ color: '#64748b' }}>Pengirim: {t.sender_name}</small>
                          )}
                        </td>
                        <td>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                            {formatRupiah(t.amount_idr)}
                          </strong>
                        </td>
                        <td>
                          {t.proof_image_url ? (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '11px' }}
                              onClick={() => setPreviewProofUrl(t.proof_image_url)}
                            >
                              <Eye size={13} /> Lihat Bukti
                            </button>
                          ) : (
                            <small style={{ color: '#94a3b8' }}>Belum diunggah</small>
                          )}
                        </td>
                        <td>
                          <StatusPill
                            variant={
                              t.status === 'PAID'
                                ? 'active'
                                : t.status === 'WAITING_VERIFICATION'
                                  ? 'basic'
                                  : 'expired'
                            }
                            dot={t.status === 'WAITING_VERIFICATION'}
                          >
                            {formatTopupStatus(t.status)}
                          </StatusPill>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {t.status !== 'PAID' ? (
                            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{
                                  padding: '0.38rem 0.7rem',
                                  fontSize: '12px',
                                  background: '#16a34a',
                                }}
                                onClick={() =>
                                  verifyTopupMutation.mutate({ id: t.id, action: 'APPROVE' })
                                }
                              >
                                <Check size={13} /> Terima &amp; Tambah Saldo
                              </button>
                              {t.status !== 'REJECTED' && (
                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  style={{ padding: '0.38rem 0.65rem', fontSize: '12px' }}
                                  onClick={() => {
                                    const reason = window.prompt(
                                      'Catatan penolakan bukti transfer:',
                                      'Nominal atau bukti transfer belum sesuai.'
                                    )
                                    if (reason !== null) {
                                      verifyTopupMutation.mutate({
                                        id: t.id,
                                        action: 'REJECT',
                                        note: reason,
                                      })
                                    }
                                  }}
                                >
                                  Tolak
                                </button>
                              )}
                            </div>
                          ) : (
                            <small style={{ color: '#16a34a', fontWeight: 700 }}>Selesai</small>
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

      {previewProofUrl && (
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
          onClick={() => setPreviewProofUrl(null)}
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
              src={previewProofUrl}
              alt="Bukti Pembayaran"
              style={{ width: '100%', borderRadius: '8px' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
