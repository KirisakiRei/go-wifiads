import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  CloudUpload,
  Copy,
  CreditCard,
  Receipt,
  Upload,
  Wallet,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { EmptyState, LoadingState } from '@/components/feedback/query-state'
import { DataTableCard, StatusPill, WavyHeader } from '@/components/ui'
import {
  advertiserAuthQueryKey,
  useCurrentAdvertiser,
} from '@/features/advertiser-portal/hooks/use-current-advertiser'
import { advertiserApi } from '@/features/marketplace/marketplace.api'
import { formatDate, formatRupiah } from '@/lib/formatters'

const QUICK_AMOUNTS = [50000, 100000, 250000, 500000, 1000000]

function labelTopupStatus(status: string): string {
  switch (status) {
    case 'PENDING_PROOF':
      return 'Menunggu Bukti'
    case 'WAITING_VERIFICATION':
      return 'Sedang Diverifikasi'
    case 'PAID':
      return 'Lunas'
    case 'REJECTED':
      return 'Ditolak'
    default:
      return status
  }
}

export function AdvertiserWalletPage() {
  const { data: advertiser } = useCurrentAdvertiser()
  const { data: configData, isPending: isLoadingConfig } = useQuery({
    queryKey: ['adv-config'],
    queryFn: advertiserApi.getConfig,
  })
  const { data: topupsRes, isPending: isLoadingTopups } = useQuery({
    queryKey: ['adv-topups'],
    queryFn: () => advertiserApi.listTopups({ page: 1, per_page: 25 }),
  })
  const { data: txRes, isPending: isLoadingTx } = useQuery({
    queryKey: ['adv-wallet-tx'],
    queryFn: () => advertiserApi.listWalletTransactions({ page: 1, per_page: 30 }),
  })

  const [amount, setAmount] = useState<number>(100000)
  const [selectedPmId, setSelectedPmId] = useState<string>('')
  const [senderName, setSenderName] = useState<string>('')
  const [proofUrl, setProofUrl] = useState<string>('')
  const [uploadingProof, setUploadingProof] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)

  const paymentMethods = configData?.payment_methods || []
  const minTopup = configData?.setting.min_topup_amount_idr || 50000

  useEffect(() => {
    if (paymentMethods.length > 0 && !selectedPmId) {
      setSelectedPmId(paymentMethods[0].id)
    }
  }, [paymentMethods, selectedPmId])

  const selectedMethod = paymentMethods.find((p) => p.id === selectedPmId)

  const createTopupMutation = useMutation({
    mutationFn: () =>
      advertiserApi.createTopup({
        amount_idr: Number(amount),
        payment_method_id: selectedPmId,
        sender_name: senderName.trim(),
        proof_image_url: proofUrl,
      }),
    onSuccess: () => {
      toast.success('Permintaan Top-Up berhasil dikirim untuk diverifikasi Admin')
      setProofUrl('')
      queryClient.invalidateQueries({ queryKey: ['adv-topups'] })
      queryClient.invalidateQueries({ queryKey: advertiserAuthQueryKey })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoadingConfig || isLoadingTopups || isLoadingTx) return <LoadingState />

  const topups = topupsRes?.data || []
  const transactions = txRes?.data || []

  const handleUploadProof = async (file: File) => {
    try {
      setUploadingProof(true)
      setUploadPercent(0)
      const res = await advertiserApi.uploadTopupProof(file, (p) => setUploadPercent(p.percent))
      setUploadPercent(100)
      setProofUrl(res.url)
      toast.success('Foto bukti pembayaran berhasil diunggah')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunggah bukti bayar')
    } finally {
      setUploadingProof(false)
    }
  }

  return (
    <div>
      <WavyHeader title="Saldo & Top-Up" />

      <div className="stitch-page-stage">
        {/* Top Two-Column: Balance + Topup Form */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          {/* Balance Card & Payment Instructions */}
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                color: '#ffffff',
                borderRadius: '18px',
                padding: '1.75rem',
                boxShadow: '0 10px 24px rgba(37, 99, 235, 0.22)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px', opacity: 0.9 }}>
                <Wallet size={18} /> Saldo Iklan Aktif
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '0.5rem', letterSpacing: '-0.02em' }}>
                {formatRupiah(advertiser?.wallet_balance_idr || 0)}
              </div>
              <p style={{ margin: '0.6rem 0 0', fontSize: '12px', opacity: 0.85, lineHeight: 1.5 }}>
                Saldo hanya dipotong ketika pengunjung Wi-Fi menyelesaikan penayangan iklan Anda.
              </p>
            </div>

            {selectedMethod && (
              <div className="stitch-card-container" style={{ background: '#ffffff', padding: '1.35rem', display: 'grid', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CreditCard size={18} color="#2563eb" />
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                    Tujuan Pembayaran: {selectedMethod.provider_name}
                  </strong>
                </div>

                {selectedMethod.type === 'QRIS_STATIC' && selectedMethod.qris_image_url ? (
                  <div style={{ textAlign: 'center', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <img
                      src={selectedMethod.qris_image_url}
                      alt="QRIS"
                      style={{ maxWidth: '220px', width: '100%', borderRadius: '8px' }}
                    />
                  </div>
                ) : (
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Nomor Rekening</div>
                      <strong style={{ fontSize: '18px', fontFamily: 'monospace', color: '#0f172a' }}>
                        {selectedMethod.account_number}
                      </strong>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                        a.n. {selectedMethod.account_holder}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '12px' }}
                      onClick={() => {
                        navigator.clipboard.writeText(selectedMethod.account_number)
                        toast.success('Nomor rekening disalin')
                      }}
                    >
                      <Copy size={14} /> Salin
                    </button>
                  </div>
                )}

                {selectedMethod.instructions && (
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
                    {selectedMethod.instructions}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Create Top-Up Form */}
          <div className="stitch-card-container" style={{ background: '#ffffff', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '16px', fontWeight: 700 }}>Isi Ulang Saldo (Top-Up)</h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '12px', color: '#64748b' }}>
              Minimal pengisian saldo adalah {formatRupiah(minTopup)}.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!proofUrl) {
                  toast.error('Unggah foto bukti transfer terlebih dahulu')
                  return
                }
                createTopupMutation.mutate()
              }}
              style={{ display: 'grid', gap: '1.1rem' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '0.45rem' }}>
                  Pilih Nominal Cepat
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                  {QUICK_AMOUNTS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={`preset-btn ${amount === val ? 'active' : ''}`}
                      onClick={() => setAmount(val)}
                    >
                      {formatRupiah(val)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label>Nominal Top-Up (Rp)</label>
                <input
                  type="number"
                  min={minTopup}
                  step={1000}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-field">
                <label>Metode Pembayaran</label>
                <select value={selectedPmId} onChange={(e) => setSelectedPmId(e.target.value)} required>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.provider_name} {pm.account_number ? `— ${pm.account_number}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Nama Pengirim Rekening / Dompet Digital</label>
                <input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  required
                />
              </div>

              <div className="form-field">
                <label>Foto Bukti Pembayaran *</label>
                <div
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '12px',
                    padding: '1rem',
                    textAlign: 'center',
                    background: '#f8fafc',
                    cursor: 'pointer',
                  }}
                  onClick={() => document.getElementById('topup-proof-input')?.click()}
                >
                  <input
                    id="topup-proof-input"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleUploadProof(f)
                    }}
                  />
                  {uploadingProof ? (
                    <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <CloudUpload size={16} /> Mengunggah bukti ({uploadPercent}%)...
                    </span>
                  ) : proofUrl ? (
                    <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} /> Bukti berhasil diunggah (klik untuk ganti)
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Upload size={16} /> Klik untuk memilih foto bukti transfer
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={createTopupMutation.isPending || uploadingProof}
                style={{ padding: '0.8rem', fontWeight: 700 }}
              >
                {createTopupMutation.isPending ? 'Mengirim...' : `Kirim Konfirmasi Top-Up ${formatRupiah(amount)}`}
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Tables: Top-Up History & Wallet Ledger */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          <DataTableCard title="Riwayat Top-Up" icon={Receipt}>
            {topups.length === 0 ? (
              <div style={{ padding: '1.5rem' }}>
                <EmptyState title="Belum ada riwayat Top-Up." />
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Tagihan</th>
                      <th>Nominal</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topups.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <code style={{ fontWeight: 700, color: '#1d4ed8', fontSize: '12px' }}>{t.invoice_number}</code>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {t.payment_provider_name} • {formatDate(t.created_at)}
                          </div>
                          {t.admin_note && <div style={{ fontSize: '11px', color: '#dc2626' }}>{t.admin_note}</div>}
                        </td>
                        <td>
                          <strong>{formatRupiah(t.amount_idr)}</strong>
                        </td>
                        <td>
                          <StatusPill
                            variant={t.status === 'PAID' ? 'active' : t.status === 'WAITING_VERIFICATION' ? 'basic' : 'expired'}
                            dot={t.status === 'WAITING_VERIFICATION'}
                          >
                            {labelTopupStatus(t.status)}
                          </StatusPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataTableCard>

          <DataTableCard title="Mutasi Saldo" icon={Wallet}>
            {transactions.length === 0 ? (
              <div style={{ padding: '1.5rem' }}>
                <EmptyState title="Belum ada mutasi saldo." />
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Keterangan</th>
                      <th>Nominal</th>
                      <th>Sisa Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const isCredit = tx.amount_idr > 0
                      return (
                        <tr key={tx.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              {isCredit ? (
                                <ArrowDownLeft size={15} color="#16a34a" />
                              ) : (
                                <ArrowUpRight size={15} color="#dc2626" />
                              )}
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{tx.description}</div>
                                <small style={{ fontSize: '11px', color: '#64748b' }}>{formatDate(tx.created_at)}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: isCredit ? '#16a34a' : '#dc2626', fontSize: '13px' }}>
                              {isCredit ? `+${formatRupiah(tx.amount_idr)}` : formatRupiah(tx.amount_idr)}
                            </strong>
                          </td>
                          <td style={{ fontSize: '12px', fontWeight: 600 }}>
                            {formatRupiah(tx.balance_after_idr)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </DataTableCard>
        </div>
      </div>
    </div>
  )
}
