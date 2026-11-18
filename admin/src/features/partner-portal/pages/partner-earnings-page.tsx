import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Eye,
  Send,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { EmptyState, LoadingState } from '@/components/feedback/query-state'
import {
  DataTableCard,
  KpiCard,
  KpiGrid,
  Pagination,
  StatusPill,
  WavyHeader,
} from '@/components/ui'
import { partnerApi } from '@/features/marketplace/marketplace.api'
import {
  partnerAuthQueryKey,
  useCurrentPartner,
} from '@/features/partner-portal/hooks/use-current-partner'
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

export function PartnerEarningsPage() {
  const navigate = useNavigate()
  const { data: partner } = useCurrentPartner()
  const [wdPage, setWdPage] = useState(1)
  const [txPage, setTxPage] = useState(1)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState<number>(50000)
  const [previewProof, setPreviewProof] = useState<string | null>(null)

  const { data: wdRes, isPending: isLoadingWd } = useQuery({
    queryKey: ['partner-withdrawals', wdPage],
    queryFn: () => partnerApi.listWithdrawals({ page: wdPage, per_page: 10 }),
  })

  const { data: txRes, isPending: isLoadingTx } = useQuery({
    queryKey: ['partner-transactions', txPage],
    queryFn: () => partnerApi.listTransactions({ page: txPage, per_page: 15 }),
  })

  const withdrawMutation = useMutation({
    mutationFn: () => partnerApi.createWithdrawal(Number(withdrawAmount)),
    onSuccess: () => {
      toast.success('Pengajuan pencairan dana berhasil dikirim!')
      queryClient.invalidateQueries({ queryKey: partnerAuthQueryKey })
      queryClient.invalidateQueries({ queryKey: ['partner-withdrawals'] })
      queryClient.invalidateQueries({ queryKey: ['partner-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['partner-overview'] })
      setShowWithdrawModal(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoadingWd || isLoadingTx) return <LoadingState />

  const withdrawals = wdRes?.data || []
  const wdMeta = wdRes?.meta
  const transactions = txRes?.data || []
  const txMeta = txRes?.meta
  const minWd = partner?.min_withdrawal_amount_idr || 50000
  const hasBank = Boolean(partner?.bank_name && partner?.bank_account_number)

  return (
    <div>
      <WavyHeader
        title="Pendapatan & Pencairan Dana"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            style={{ background: '#059669' }}
            onClick={() => {
              if (!hasBank) {
                toast.info('Silakan lengkapi rekening bank pencairan di menu Profil terlebih dahulu')
                navigate('/profile')
                return
              }
              setWithdrawAmount(Math.max(minWd, partner?.wallet_balance_idr || minWd))
              setShowWithdrawModal(true)
            }}
          >
            <ArrowUpRight size={17} /> Ajukan Pencairan Dana
          </button>
        }
      />

      <div className="stitch-page-stage">
        <KpiGrid columns={3}>
          <KpiCard
            label="Saldo Siap Dicairkan"
            value={formatRupiah(partner?.wallet_balance_idr || 0)}
            icon={Wallet}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext={`Minimal penarikan ${formatRupiah(minWd)}`}
          />
          <KpiCard
            label="Total Pendapatan Lokasi"
            value={formatRupiah(partner?.total_earned_idr || 0)}
            icon={TrendingUp}
            subtext="Akumulasi sejak bergabung"
          />
          <KpiCard
            label="Rekening Tujuan Pencairan"
            value={hasBank ? partner!.bank_name : 'Belum Diatur'}
            icon={CreditCard}
            iconBoxVariant="secondary"
            subtext={
              hasBank
                ? `${partner!.bank_account_number} a.n. ${partner!.bank_account_holder}`
                : 'Atur di halaman Profil'
            }
          />
        </KpiGrid>

        {/* Withdrawals Table */}
        <DataTableCard title="Riwayat Pengajuan Pencairan Dana" icon={ArrowUpRight}>
          {withdrawals.length === 0 ? (
            <div style={{ padding: '1.75rem' }}>
              <EmptyState title="Belum ada riwayat penarikan dana." />
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Nomor Pengajuan</th>
                      <th>Rekening Tujuan</th>
                      <th>Nominal</th>
                      <th>Bukti Transfer</th>
                      <th style={{ textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w) => (
                      <tr key={w.id}>
                        <td>
                          <code style={{ fontWeight: 700, color: '#059669' }}>
                            {w.withdrawal_number}
                          </code>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {formatDate(w.created_at)}
                          </div>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <strong>{w.bank_name}</strong> — {w.bank_account_number}
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            a.n. {w.bank_account_holder}
                          </div>
                        </td>
                        <td>
                          <strong>{formatRupiah(w.amount_idr)}</strong>
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
                        <td style={{ textAlign: 'right' }}>
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
                          {w.admin_note && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              {w.admin_note}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {wdMeta && wdMeta.total_pages > 1 && (
                <Pagination meta={wdMeta} onPageChange={setWdPage} />
              )}
            </>
          )}
        </DataTableCard>

        {/* Wallet Ledger */}
        <DataTableCard title="Rincian Pendapatan & Mutasi Saldo" icon={Wallet}>
          {transactions.length === 0 ? (
            <div style={{ padding: '1.75rem' }}>
              <EmptyState title="Belum ada mutasi pendapatan." />
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Keterangan</th>
                      <th>Nominal</th>
                      <th style={{ textAlign: 'right' }}>Saldo Akhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const isCredit = tx.amount_idr >= 0
                      return (
                        <tr key={tx.id}>
                          <td style={{ fontSize: '12px', color: '#64748b' }}>
                            {formatDate(tx.created_at)}
                          </td>
                          <td style={{ fontSize: '12px' }}>{tx.description}</td>
                          <td>
                            <strong
                              style={{
                                color: isCredit ? '#059669' : '#dc2626',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              {isCredit ? (
                                <ArrowDownLeft size={13} />
                              ) : (
                                <ArrowUpRight size={13} />
                              )}
                              {isCredit ? '+' : ''}
                              {formatRupiah(tx.amount_idr)}
                            </strong>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {formatRupiah(tx.balance_after_idr)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {txMeta && txMeta.total_pages > 1 && (
                <Pagination meta={txMeta} onPageChange={setTxPage} />
              )}
            </>
          )}
        </DataTableCard>
      </div>

      {/* Modal: Request Withdrawal */}
      {showWithdrawModal && (
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
          <form
            onSubmit={(e) => {
              e.preventDefault()
              withdrawMutation.mutate()
            }}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '1.5rem',
              display: 'grid',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Ajukan Pencairan Dana</h3>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem' }}
                onClick={() => setShowWithdrawModal(false)}
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
              }}
            >
              <div>
                Saldo tersedia: <strong>{formatRupiah(partner?.wallet_balance_idr || 0)}</strong>
              </div>
              <div style={{ color: '#64748b', marginTop: '3px' }}>
                Tujuan: {partner?.bank_name} — {partner?.bank_account_number} (a.n.{' '}
                {partner?.bank_account_holder})
              </div>
            </div>

            <div className="form-field">
              <label>Nominal Pencairan (Min. {formatRupiah(minWd)})</label>
              <input
                type="number"
                min={minWd}
                max={partner?.wallet_balance_idr || minWd}
                step={5000}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowWithdrawModal(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ background: '#059669' }}
                disabled={
                  withdrawMutation.isPending ||
                  (partner?.wallet_balance_idr || 0) < minWd
                }
              >
                <Send size={15} />
                {withdrawMutation.isPending ? 'Mengirim...' : 'Kirim Pengajuan'}
              </button>
            </div>
          </form>
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
              alt="Bukti Transfer"
              style={{ width: '100%', borderRadius: '8px' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
