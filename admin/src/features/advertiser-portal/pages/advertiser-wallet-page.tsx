import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  CloudUpload,
  Copy,
  CreditCard,
  Eye,
  PlusCircle,
  QrCode,
  Receipt,
  Sparkles,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { EmptyState, LoadingState } from '@/components/feedback/query-state'
import {
  DataTableCard,
  KpiCard,
  Pagination,
  StatusPill,
  WavyHeader,
} from '@/components/ui'
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
    case 'EXPIRED':
      return 'Kedaluwarsa'
    default:
      return status
  }
}

function labelMethodType(type: string): string {
  switch (type) {
    case 'QRIS_STATIC':
      return 'QRIS'
    case 'BANK_TRANSFER':
      return 'Transfer Bank'
    default:
      return 'Pembayaran'
  }
}

export function AdvertiserWalletPage() {
  const { data: advertiser } = useCurrentAdvertiser()
  const [activeTab, setActiveTab] = useState<'topups' | 'ledger'>('topups')
  const [topupPage, setTopupPage] = useState(1)
  const [txPage, setTxPage] = useState(1)

  const { data: configData, isPending: isLoadingConfig } = useQuery({
    queryKey: ['adv-config'],
    queryFn: advertiserApi.getConfig,
  })
  const { data: overviewData } = useQuery({
    queryKey: ['adv-overview'],
    queryFn: advertiserApi.getOverview,
  })
  const { data: topupsRes, isPending: isLoadingTopups } = useQuery({
    queryKey: ['adv-topups', topupPage],
    queryFn: () => advertiserApi.listTopups({ page: topupPage, per_page: 10 }),
  })
  const { data: txRes, isPending: isLoadingTx } = useQuery({
    queryKey: ['adv-wallet-tx', txPage],
    queryFn: () => advertiserApi.listWalletTransactions({ page: txPage, per_page: 10 }),
  })

  const [amount, setAmount] = useState<number>(100000)
  const [selectedPmId, setSelectedPmId] = useState<string>('')
  const [senderName, setSenderName] = useState<string>('')
  const [proofUrl, setProofUrl] = useState<string>('')
  const [uploadingProof, setUploadingProof] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [copiedKey, setCopiedKey] = useState<'account' | 'amount' | null>(null)
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null)

  const paymentMethods = configData?.payment_methods || []
  const minTopup = configData?.setting.min_topup_amount_idr || 50000
  const baseImagePrice = configData?.setting.base_price_image_idr || 50
  const baseVideoPrice = configData?.setting.base_price_video_idr || 50

  useEffect(() => {
    if (paymentMethods.length > 0 && !selectedPmId) {
      setSelectedPmId(paymentMethods[0].id)
    }
  }, [paymentMethods, selectedPmId])

  useEffect(() => {
    if (!previewImage) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewImage(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewImage])

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
      setUploadPercent(0)
      setActiveTab('topups')
      setTopupPage(1)
      queryClient.invalidateQueries({ queryKey: ['adv-topups'] })
      queryClient.invalidateQueries({ queryKey: advertiserAuthQueryKey })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoadingConfig || isLoadingTopups || isLoadingTx) return <LoadingState />

  const topups = topupsRes?.data || []
  const topupsMeta = topupsRes?.meta
  const transactions = txRes?.data || []
  const txMeta = txRes?.meta

  const walletBalance = advertiser?.wallet_balance_idr || 0
  const totalSpent = overviewData?.total_spent_idr || 0
  const pendingTopups = topups.filter((t) => t.status === 'WAITING_VERIFICATION')
  const pendingAmountTotal = pendingTopups.reduce((sum, t) => sum + t.amount_idr, 0)
  const estTopupViews = baseVideoPrice > 0 ? Math.floor((Number(amount) || 0) / baseVideoPrice) : 0
  const estBalanceViews = baseVideoPrice > 0 ? Math.floor(walletBalance / baseVideoPrice) : 0
  const isAmountValid = Number(amount) >= minTopup

  const copyText = async (text: string, key: 'account' | 'amount', msg: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      toast.success(msg)
      window.setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr))
      }, 1800)
    } catch {
      toast.error('Tidak dapat menyalin otomatis, silakan salin manual')
    }
  }

  const handleUploadProof = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('File bukti transfer harus berupa gambar (JPG, PNG, WebP)')
      return
    }
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
      <WavyHeader
        title="Saldo & Top-Up"
        actions={
          <Link to="/campaigns/new" className="btn btn-primary adv-wallet-btn">
            <PlusCircle size={16} /> Pasang Iklan
          </Link>
        }
      />

      <div className="stitch-page-stage adv-wallet-stage">
        {/* Top Row: Featured Balance Hero + Summary Cards */}
        <div className="adv-wallet-hero-grid">
          <div className="adv-wallet-balance-card">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '12.5px', fontWeight: 600, opacity: 0.9 }}>
                  <Wallet size={16} /> Saldo Iklan Aktif
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    background: 'rgba(255, 255, 255, 0.16)',
                    color: '#ffffff',
                  }}
                >
                  Pay-Per-View
                </span>
              </div>

              <div className="adv-wallet-balance-amount">{formatRupiah(walletBalance)}</div>
              <p style={{ margin: '0.45rem 0 0', fontSize: '12.5px', opacity: 0.86, lineHeight: 1.5, maxWidth: '520px' }}>
                Saldo hanya dipotong saat pengunjung Wi-Fi menyelesaikan penayangan iklan Anda.
              </p>
            </div>

            <div className="adv-wallet-balance-meta">
              <div>
                <div style={{ opacity: 0.72, fontSize: '11px' }}>Estimasi Sisa Tayangan</div>
                <strong style={{ fontSize: '14px' }}>~{estBalanceViews.toLocaleString('id-ID')} tayangan</strong>
              </div>
              <div>
                <div style={{ opacity: 0.72, fontSize: '11px' }}>Total Saldo Terpakai</div>
                <strong style={{ fontSize: '14px' }}>{formatRupiah(totalSpent)}</strong>
              </div>
              {overviewData && (
                <div>
                  <div style={{ opacity: 0.72, fontSize: '11px' }}>Iklan Aktif</div>
                  <strong style={{ fontSize: '14px' }}>{overviewData.active_campaigns_count} kampanye</strong>
                </div>
              )}
            </div>
          </div>

          <div className="adv-wallet-summary-stack">
            <KpiCard
              label="Menunggu Verifikasi Admin"
              value={pendingTopups.length > 0 ? formatRupiah(pendingAmountTotal) : 'Tidak Ada'}
              icon={Clock}
              iconBoxVariant={pendingTopups.length > 0 ? 'warning' : 'success'}
              subtext={
                pendingTopups.length > 0
                  ? `${pendingTopups.length} pengajuan top-up sedang dicek`
                  : 'Semua pengajuan top-up sudah diproses'
              }
            />
            <KpiCard
              label="Tarif Dasar Tayangan"
              value={
                baseImagePrice === baseVideoPrice
                  ? formatRupiah(baseImagePrice)
                  : `${formatRupiah(baseImagePrice)} – ${formatRupiah(baseVideoPrice)}`
              }
              icon={Sparkles}
              iconBoxVariant="secondary"
              subtext={`Gambar ${formatRupiah(baseImagePrice)} • Video ${formatRupiah(baseVideoPrice)} / tayang`}
            />
          </div>
        </div>

        {/* Middle Row: Guided Top-Up Form + Sticky Payment Destination */}
        <div className="adv-wallet-workspace">
          {/* Left: Top-Up Submission Form */}
          <div className="stitch-card-container" style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0b1c30' }}>Isi Ulang Saldo (Top-Up)</h2>
              <p style={{ marginTop: '0.2rem', fontSize: '12.5px', color: '#64748b' }}>
                Transfer ke rekening tujuan di samping, lalu unggah bukti bayar agar saldo segera masuk.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!isAmountValid) {
                  toast.error(`Minimal pengisian saldo adalah ${formatRupiah(minTopup)}`)
                  return
                }
                if (!selectedPmId) {
                  toast.error('Pilih metode pembayaran terlebih dahulu')
                  return
                }
                if (!proofUrl) {
                  toast.error('Unggah foto bukti transfer terlebih dahulu')
                  return
                }
                createTopupMutation.mutate()
              }}
              style={{ display: 'grid', gap: '1.25rem' }}
            >
              {/* Step 1: Nominal */}
              <div>
                <div className="adv-wallet-step-label">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span className="adv-wallet-step-badge">1</span>
                    Pilih atau Ketik Nominal Top-Up
                  </span>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#1d4ed8' }}>
                    ± {estTopupViews.toLocaleString('id-ID')} tayangan dasar
                  </span>
                </div>

                <div className="adv-wallet-preset-grid" style={{ marginBottom: '0.65rem' }}>
                  {QUICK_AMOUNTS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={`adv-wallet-preset ${amount === val ? 'active' : ''}`}
                      onClick={() => setAmount(val)}
                    >
                      {formatRupiah(val)}
                    </button>
                  ))}
                </div>

                <div className="adv-wallet-money-wrap">
                  <span className="adv-wallet-money-prefix">Rp</span>
                  <input
                    type="number"
                    min={minTopup}
                    step={1000}
                    className="adv-wallet-money-input"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required
                  />
                </div>
                {!isAmountValid && (
                  <p style={{ marginTop: '0.35rem', fontSize: '11.5px', fontWeight: 600, color: '#dc2626' }}>
                    Nominal minimal top-up adalah {formatRupiah(minTopup)}.
                  </p>
                )}
              </div>

              {/* Step 2: Payment Method */}
              <div>
                <div className="adv-wallet-step-label">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span className="adv-wallet-step-badge">2</span>
                    Metode Pembayaran
                  </span>
                  <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#64748b' }}>
                    {paymentMethods.length} metode tersedia
                  </span>
                </div>

                {paymentMethods.length === 0 ? (
                  <div
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '10px',
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      fontSize: '12.5px',
                      color: '#92400e',
                    }}
                  >
                    Belum ada metode pembayaran aktif. Silakan hubungi administrator.
                  </div>
                ) : (
                  <div className="adv-wallet-method-list">
                    {paymentMethods.map((pm) => {
                      const active = pm.id === selectedPmId
                      return (
                        <button
                          key={pm.id}
                          type="button"
                          className={`adv-wallet-method-card ${active ? 'active' : ''}`}
                          onClick={() => setSelectedPmId(pm.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.4rem' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0b1c30' }}>
                              {pm.provider_name}
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '0.14rem 0.45rem',
                                borderRadius: '999px',
                                background: active ? '#dbeafe' : '#f1f5f9',
                                color: active ? '#1d4ed8' : '#475569',
                              }}
                            >
                              {labelMethodType(pm.type)}
                            </span>
                          </div>
                          <span style={{ fontSize: '11.5px', color: '#64748b', fontFamily: pm.account_number ? 'monospace' : 'inherit' }}>
                            {pm.account_number || (pm.type === 'QRIS_STATIC' ? 'Scan Kode QRIS' : 'Lihat panduan')}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Step 3: Sender & Proof */}
              <div style={{ display: 'grid', gap: '0.9rem' }}>
                <div className="adv-wallet-step-label" style={{ marginBottom: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span className="adv-wallet-step-badge">3</span>
                    Konfirmasi Pengirim &amp; Bukti Transfer
                  </span>
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
                  <input
                    id="topup-proof-input"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleUploadProof(f)
                      e.target.value = ''
                    }}
                  />

                  <div
                    className={`adv-wallet-dropzone ${isDraggingFile ? 'dragging' : ''} ${proofUrl ? 'has-file' : ''}`}
                    onClick={() => {
                      if (!proofUrl && !uploadingProof) {
                        document.getElementById('topup-proof-input')?.click()
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDraggingFile(true)
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsDraggingFile(false)
                      const f = e.dataTransfer.files?.[0]
                      if (f) handleUploadProof(f)
                    }}
                  >
                    {uploadingProof ? (
                      <div style={{ textAlign: 'center', padding: '0.35rem 0' }}>
                        <span style={{ fontSize: '12.5px', color: '#1d4ed8', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <CloudUpload size={17} /> Mengunggah bukti ({uploadPercent}%)...
                        </span>
                        <div className="adv-wallet-progress-track">
                          <div
                            className="adv-wallet-progress-fill"
                            style={{ transform: `scaleX(${Math.max(0.08, uploadPercent / 100)})` }}
                          />
                        </div>
                      </div>
                    ) : proofUrl ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.85rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                          <img
                            src={proofUrl}
                            alt="Preview bukti transfer"
                            onClick={() => setPreviewImage({ url: proofUrl, title: 'Preview Bukti Pembayaran' })}
                            style={{
                              width: '54px',
                              height: '54px',
                              objectFit: 'cover',
                              borderRadius: '9px',
                              border: '1px solid #bbf7d0',
                              cursor: 'zoom-in',
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#065f46', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <CheckCircle2 size={15} /> Bukti transfer siap dikirim
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#047857', marginTop: '2px' }}>
                              Klik gambar untuk memperbesar preview
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary adv-wallet-btn"
                            style={{ padding: '0.38rem 0.7rem', fontSize: '11.5px' }}
                            onClick={() => document.getElementById('topup-proof-input')?.click()}
                          >
                            Ganti Foto
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost adv-wallet-btn"
                            style={{ padding: '0.38rem 0.55rem', color: '#dc2626' }}
                            title="Hapus foto bukti"
                            onClick={() => setProofUrl('')}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '0.45rem 0' }}>
                        <div style={{ fontSize: '12.5px', color: '#334155', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Upload size={16} color="#1d4ed8" /> Klik atau seret foto bukti transfer ke sini
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '0.25rem' }}>
                          Format JPG, PNG, atau WebP • Pastikan nominal &amp; waktu transfer terbaca jelas
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary adv-wallet-btn"
                disabled={createTopupMutation.isPending || uploadingProof || !isAmountValid || paymentMethods.length === 0}
                style={{ padding: '0.82rem 1.25rem', fontSize: '13.5px', fontWeight: 700 }}
              >
                {createTopupMutation.isPending
                  ? 'Mengirim Konfirmasi...'
                  : `Kirim Konfirmasi Top-Up ${formatRupiah(Number(amount) || 0)}`}
              </button>
            </form>
          </div>

          {/* Right: Sticky Payment Destination Guide */}
          <div className="stitch-card-container adv-wallet-guide-card" style={{ padding: '1.4rem', display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {selectedMethod?.type === 'QRIS_STATIC' ? (
                  <QrCode size={18} color="#1d4ed8" />
                ) : (
                  <CreditCard size={18} color="#1d4ed8" />
                )}
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0b1c30' }}>
                  Tujuan Pembayaran
                </h3>
              </div>
              {selectedMethod && (
                <span className="live-badge">{selectedMethod.provider_name}</span>
              )}
            </div>

            {!selectedMethod ? (
              <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                Pilih metode pembayaran di formulir untuk melihat rekening atau QRIS tujuan.
              </p>
            ) : (
              <>
                {/* Exact Nominal Box */}
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '12px',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e40af' }}>Nominal Transfer</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0b1c30', letterSpacing: '-0.02em' }}>
                      {formatRupiah(Number(amount) || 0)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary adv-wallet-btn"
                    style={{ padding: '0.38rem 0.7rem', fontSize: '11.5px', background: '#ffffff' }}
                    onClick={() => copyText(String(Number(amount) || 0), 'amount', 'Nominal transfer disalin')}
                  >
                    <span className="adv-wallet-copy-label">
                      {copiedKey === 'amount' ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                      {copiedKey === 'amount' ? 'Tersalin' : 'Salin'}
                    </span>
                  </button>
                </div>

                {selectedMethod.type === 'QRIS_STATIC' && selectedMethod.qris_image_url ? (
                  <div
                    style={{
                      textAlign: 'center',
                      background: '#f8fafc',
                      padding: '1rem',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <img
                      src={selectedMethod.qris_image_url}
                      alt={`QRIS ${selectedMethod.provider_name}`}
                      onClick={() =>
                        setPreviewImage({
                          url: selectedMethod.qris_image_url,
                          title: `QRIS ${selectedMethod.provider_name}`,
                        })
                      }
                      style={{
                        maxWidth: '210px',
                        width: '100%',
                        borderRadius: '10px',
                        cursor: 'zoom-in',
                        border: '1px solid #e2e8f0',
                      }}
                    />
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '0.5rem' }}>
                      Scan melalui M-Banking / E-Wallet • Klik gambar untuk memperbesar
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '1rem',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Nomor Rekening / Tujuan</div>
                      <div
                        style={{
                          fontSize: '18px',
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          color: '#0b1c30',
                          wordBreak: 'break-all',
                          marginTop: '2px',
                        }}
                      >
                        {selectedMethod.account_number || '-'}
                      </div>
                      {selectedMethod.account_holder && (
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>
                          a.n. <strong>{selectedMethod.account_holder}</strong>
                        </div>
                      )}
                    </div>
                    {selectedMethod.account_number && (
                      <button
                        type="button"
                        className="btn btn-secondary adv-wallet-btn"
                        style={{ padding: '0.42rem 0.78rem', fontSize: '12px', flexShrink: 0, background: '#ffffff' }}
                        onClick={() =>
                          copyText(selectedMethod.account_number, 'account', 'Nomor rekening disalin')
                        }
                      >
                        <span className="adv-wallet-copy-label">
                          {copiedKey === 'account' ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                          {copiedKey === 'account' ? 'Tersalin' : 'Salin'}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {selectedMethod.instructions && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#475569',
                      lineHeight: 1.55,
                      background: '#f8fafc',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '10px',
                      border: '1px solid #f1f5f9',
                    }}
                  >
                    {selectedMethod.instructions}
                  </div>
                )}

                <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.5, borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                  • Saldo akan bertambah otomatis setelah Admin memverifikasi mutasi masuk.
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom Row: Full-Width Tabbed Financial Activity (No Cramped Side-by-Side Scroll) */}
        <DataTableCard
          title={activeTab === 'topups' ? 'Riwayat Pengajuan Top-Up' : 'Mutasi Saldo Dompet'}
          subtitle={
            activeTab === 'topups'
              ? 'Daftar tagihan top-up dan status verifikasi admin'
              : 'Catatan kredit top-up dan pemotongan per tayangan iklan'
          }
          icon={activeTab === 'topups' ? Receipt : Wallet}
          toolbarActions={
            <div className="adv-wallet-seg-group" role="tablist" aria-label="Aktivitas Keuangan">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'topups'}
                className={`adv-wallet-seg-btn ${activeTab === 'topups' ? 'active' : ''}`}
                onClick={() => setActiveTab('topups')}
              >
                <Receipt size={14} />
                Riwayat Top-Up
                {pendingTopups.length > 0 && (
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '0.08rem 0.42rem',
                      borderRadius: '999px',
                      background: '#fef3c7',
                      color: '#92400e',
                    }}
                  >
                    {pendingTopups.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'ledger'}
                className={`adv-wallet-seg-btn ${activeTab === 'ledger' ? 'active' : ''}`}
                onClick={() => setActiveTab('ledger')}
              >
                <Wallet size={14} />
                Mutasi Saldo
              </button>
            </div>
          }
          footer={
            activeTab === 'topups' ? (
              topupsMeta && topupsMeta.total_pages > 1 ? (
                <div style={{ width: '100%' }}>
                  <Pagination meta={topupsMeta} onPageChange={setTopupPage} />
                </div>
              ) : undefined
            ) : txMeta && txMeta.total_pages > 1 ? (
              <div style={{ width: '100%' }}>
                <Pagination meta={txMeta} onPageChange={setTxPage} />
              </div>
            ) : undefined
          }
        >
          {activeTab === 'topups' ? (
            topups.length === 0 ? (
              <div style={{ padding: '2rem' }}>
                <EmptyState
                  title="Belum ada riwayat Top-Up."
                  description="Ajukan isi ulang saldo melalui formulir di atas untuk mulai beriklan."
                />
              </div>
            ) : (
              <table className="stitch-table">
                <thead>
                  <tr>
                    <th>Nomor Tagihan</th>
                    <th>Metode &amp; Pengirim</th>
                    <th>Tanggal</th>
                    <th style={{ textAlign: 'right' }}>Nominal</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Bukti</th>
                  </tr>
                </thead>
                <tbody>
                  {topups.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <code style={{ fontWeight: 700, color: '#1d4ed8', fontSize: '12px' }}>
                          {t.invoice_number}
                        </code>
                        {t.admin_note && (
                          <div style={{ fontSize: '11.5px', color: '#dc2626', marginTop: '2px' }}>
                            Catatan: {t.admin_note}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0b1c30', fontSize: '12.5px' }}>
                          {t.payment_provider_name}
                        </div>
                        {t.sender_name && <small>Pengirim: {t.sender_name}</small>}
                      </td>
                      <td>
                        <small>{formatDate(t.created_at)}</small>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>{formatRupiah(t.amount_idr)}</strong>
                      </td>
                      <td>
                        <StatusPill
                          variant={
                            t.status === 'PAID'
                              ? 'active'
                              : t.status === 'WAITING_VERIFICATION'
                                ? 'warning'
                                : t.status === 'PENDING_PROOF'
                                  ? 'premium'
                                  : 'expired'
                          }
                          dot={t.status === 'WAITING_VERIFICATION'}
                        >
                          {labelTopupStatus(t.status)}
                        </StatusPill>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {t.proof_image_url ? (
                          <button
                            type="button"
                            className="btn btn-secondary adv-wallet-btn"
                            style={{ padding: '0.32rem 0.65rem', fontSize: '11.5px' }}
                            onClick={() =>
                              setPreviewImage({
                                url: t.proof_image_url,
                                title: `Bukti Transfer — ${t.invoice_number}`,
                              })
                            }
                          >
                            <Eye size={13} /> Lihat
                          </button>
                        ) : (
                          <small>—</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : transactions.length === 0 ? (
            <div style={{ padding: '2rem' }}>
              <EmptyState
                title="Belum ada mutasi saldo."
                description="Setiap top-up yang disetujui dan biaya tayangan iklan akan tercatat di sini."
              />
            </div>
          ) : (
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Aktivitas</th>
                  <th>Tanggal</th>
                  <th style={{ textAlign: 'right' }}>Nominal</th>
                  <th style={{ textAlign: 'right' }}>Sisa Saldo</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isCredit = tx.amount_idr > 0
                  return (
                    <tr key={tx.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '8px',
                              background: isCredit ? '#ecfdf5' : '#fef2f2',
                              color: isCredit ? '#16a34a' : '#dc2626',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {isCredit ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0b1c30' }}>
                            {tx.description}
                          </span>
                        </div>
                      </td>
                      <td>
                        <small>{formatDate(tx.created_at)}</small>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong style={{ color: isCredit ? '#16a34a' : '#dc2626', fontSize: '13px' }}>
                          {isCredit ? `+${formatRupiah(tx.amount_idr)}` : formatRupiah(tx.amount_idr)}
                        </strong>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '12.5px', fontWeight: 600 }}>
                        {formatRupiah(tx.balance_after_idr)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </DataTableCard>
      </div>

      {/* Centered Image Lightbox Modal (Proof / QRIS Zoom) */}
      {previewImage && (
        <div
          className="adv-wallet-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={previewImage.title}
          onClick={() => setPreviewImage(null)}
        >
          <div className="adv-wallet-modal-card" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                marginBottom: '0.75rem',
              }}
            >
              <strong style={{ fontSize: '14px', color: '#0b1c30' }}>{previewImage.title}</strong>
              <button
                type="button"
                className="btn btn-ghost adv-wallet-btn"
                style={{ padding: '0.35rem', borderRadius: '8px' }}
                aria-label="Tutup preview"
                onClick={() => setPreviewImage(null)}
              >
                <X size={18} />
              </button>
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.title}
              style={{
                width: '100%',
                maxHeight: '72vh',
                objectFit: 'contain',
                borderRadius: '10px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
