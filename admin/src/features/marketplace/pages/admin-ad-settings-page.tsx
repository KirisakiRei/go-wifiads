import { useMutation, useQuery } from '@tanstack/react-query'
import { CreditCard, Layers, Pencil, Plus, Save, Sliders, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { LoadingState } from '@/components/feedback/query-state'
import { DataTableCard, StatusPill, WavyHeader } from '@/components/ui'
import { adminMarketplaceApi } from '@/features/marketplace/marketplace.api'
import type { LocationTier, PaymentMethod } from '@/features/marketplace/marketplace.types'
import { formatRupiah } from '@/lib/formatters'

export function AdminAdSettingsPage() {
  const [baseImgPrice, setBaseImgPrice] = useState<number>(50)
  const [baseVidPrice, setBaseVidPrice] = useState<number>(50)
  const [maxDuration, setMaxDuration] = useState<number>(30)
  const [minTopup, setMinTopup] = useState<number>(50000)
  const [defaultPartnerShare, setDefaultPartnerShare] = useState<number>(20)
  const [minWithdrawal, setMinWithdrawal] = useState<number>(50000)
  const [requireApproval, setRequireApproval] = useState<boolean>(true)

  // Tier Modal
  const [editingTier, setEditingTier] = useState<LocationTier | null>(null)
  const [showTierModal, setShowTierModal] = useState(false)
  const [tierName, setTierName] = useState('')
  const [tierMult, setTierMult] = useState<number>(1.0)
  const [tierMinConnects, setTierMinConnects] = useState<number>(0)
  const [tierMinImpressions, setTierMinImpressions] = useState<number>(0)
  const [tierDesc, setTierDesc] = useState('')
  const [tierOrder, setTierOrder] = useState<number>(1)

  // Payment Method Modal
  const [editingPm, setEditingPm] = useState<PaymentMethod | null>(null)
  const [showPmModal, setShowPmModal] = useState(false)
  const [pmType, setPmType] = useState<'BANK_TRANSFER' | 'QRIS_STATIC'>('BANK_TRANSFER')
  const [pmProvider, setPmProvider] = useState('')
  const [pmAccNum, setPmAccNum] = useState('')
  const [pmAccHolder, setPmAccHolder] = useState('')
  const [pmQrisUrl, setPmQrisUrl] = useState('')
  const [pmInstructions, setPmInstructions] = useState('')
  const [uploadingQris, setUploadingQris] = useState(false)

  const { data: settingsData, isPending: isLoadingSettings } = useQuery({
    queryKey: ['admin-mkt-settings'],
    queryFn: adminMarketplaceApi.getSettings,
  })

  const { data: tiers = [] } = useQuery({
    queryKey: ['admin-location-tiers'],
    queryFn: adminMarketplaceApi.listTiers,
  })

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['admin-payment-methods'],
    queryFn: adminMarketplaceApi.listPaymentMethods,
  })

  useEffect(() => {
    if (settingsData) {
      setBaseImgPrice(settingsData.base_price_image_idr)
      setBaseVidPrice(settingsData.base_price_video_idr)
      setMaxDuration(settingsData.max_ad_duration_seconds)
      setMinTopup(settingsData.min_topup_amount_idr)
      setDefaultPartnerShare(settingsData.default_partner_share_percent ?? 20)
      setMinWithdrawal(settingsData.min_withdrawal_amount_idr ?? 50000)
      setRequireApproval(settingsData.require_ad_approval)
    }
  }, [settingsData])

  const saveSettingsMutation = useMutation({
    mutationFn: () =>
      adminMarketplaceApi.updateSettings({
        base_price_image_idr: Number(baseImgPrice),
        base_price_video_idr: Number(baseVidPrice),
        max_ad_duration_seconds: Number(maxDuration),
        min_topup_amount_idr: Number(minTopup),
        default_partner_share_percent: Number(defaultPartnerShare),
        min_withdrawal_amount_idr: Number(minWithdrawal),
        require_ad_approval: requireApproval,
      }),
    onSuccess: () => {
      toast.success('Pengaturan tarif, bagi hasil, dan aturan berhasil disimpan')
      queryClient.invalidateQueries({ queryKey: ['admin-mkt-settings'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const saveTierMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: tierName.trim(),
        multiplier: Number(tierMult),
        min_daily_connects: Math.max(0, Number(tierMinConnects) || 0),
        min_daily_impressions: Math.max(0, Number(tierMinImpressions) || 0),
        description: tierDesc.trim(),
        sort_order: Number(tierOrder) || 1,
        is_active: true,
      }
      if (editingTier) {
        return adminMarketplaceApi.updateTier(editingTier.id, payload)
      }
      return adminMarketplaceApi.createTier(payload)
    },
    onSuccess: () => {
      toast.success('Parameter rank lokasi berhasil disimpan')
      queryClient.invalidateQueries({ queryKey: ['admin-location-tiers'] })
      setShowTierModal(false)
      setEditingTier(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteTierMutation = useMutation({
    mutationFn: adminMarketplaceApi.deleteTier,
    onSuccess: () => {
      toast.success('Rank lokasi berhasil dihapus')
      queryClient.invalidateQueries({ queryKey: ['admin-location-tiers'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const savePmMutation = useMutation({
    mutationFn: () => {
      const payload = {
        type: pmType,
        provider_name: pmProvider.trim(),
        account_number: pmAccNum.trim(),
        account_holder: pmAccHolder.trim(),
        qris_image_url: pmQrisUrl.trim(),
        instructions: pmInstructions.trim(),
        sort_order: 1,
        is_active: true,
      }
      if (editingPm) {
        return adminMarketplaceApi.updatePaymentMethod(editingPm.id, payload)
      }
      return adminMarketplaceApi.createPaymentMethod(payload)
    },
    onSuccess: () => {
      toast.success('Metode pembayaran berhasil disimpan')
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] })
      setShowPmModal(false)
      setEditingPm(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deletePmMutation = useMutation({
    mutationFn: adminMarketplaceApi.deletePaymentMethod,
    onSuccess: () => {
      toast.success('Metode pembayaran dihapus')
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoadingSettings) return <LoadingState />

  return (
    <div>
      <WavyHeader title="Tarif, Parameter Rank & Rekening" />

      <div className="stitch-page-stage">
        {/* Global Pricing & Partner Share Card */}
        <div className="stitch-card-container" style={{ background: '#ffffff', padding: '1.5rem' }}>
          <div
            style={{
              marginBottom: '1.2rem',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '0.8rem',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Sliders size={18} color="#2563eb" />
              Harga Dasar Tayang &amp; Bagi Hasil Mitra Default
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '12px', color: '#64748b' }}>
              Tarif dasar dikalikan otomatis dengan Multiplier Rank Lokasi, sedangkan porsi mitra dapat diatur khusus per mitra di menu Daftar Mitra.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveSettingsMutation.mutate()
            }}
            style={{ display: 'grid', gap: '1.15rem' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
              }}
            >
              <div className="form-field">
                <label>Harga Dasar Gambar / Tayang (Rp)</label>
                <input
                  type="number"
                  min={1}
                  value={baseImgPrice}
                  onChange={(e) => setBaseImgPrice(Number(e.target.value))}
                  required
                />
              </div>
              <div className="form-field">
                <label>Harga Dasar Video / Tayang (Rp)</label>
                <input
                  type="number"
                  min={1}
                  value={baseVidPrice}
                  onChange={(e) => setBaseVidPrice(Number(e.target.value))}
                  required
                />
              </div>
              <div className="form-field">
                <label>Batas Durasi Maksimal Iklan (Detik)</label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={maxDuration}
                  onChange={(e) => setMaxDuration(Number(e.target.value))}
                  required
                />
              </div>
              <div className="form-field">
                <label>Default Porsi Bagi Hasil Mitra (%)</label>
                <input
                  type="number"
                  min={0}
                  max={95}
                  step="0.5"
                  value={defaultPartnerShare}
                  onChange={(e) => setDefaultPartnerShare(Number(e.target.value))}
                  required
                />
              </div>
              <div className="form-field">
                <label>Minimal Top-Up Pengiklan (Rp)</label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={minTopup}
                  onChange={(e) => setMinTopup(Number(e.target.value))}
                  required
                />
              </div>
              <div className="form-field">
                <label>Minimal Pencairan Dana Mitra (Rp)</label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={minWithdrawal}
                  onChange={(e) => setMinWithdrawal(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
              />
              <span>
                <strong>Wajibkan persetujuan Admin terlebih dahulu</strong> sebelum iklan baru dari pengiklan mulai ditayangkan
              </span>
            </label>

            <div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saveSettingsMutation.isPending}
              >
                <Save size={16} />
                {saveSettingsMutation.isPending ? 'Menyimpan...' : 'Simpan Pengaturan Utama'}
              </button>
            </div>
          </form>
        </div>

        {/* Location Tiers (with Automatic Traffic Thresholds) */}
        <DataTableCard
          title="Parameter Rank Lokasi & Multiplier Otomatis"
          icon={Layers}
          toolbarActions={
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '12px' }}
              onClick={() => {
                setEditingTier(null)
                setTierName('')
                setTierMult(1.2)
                setTierMinConnects(30)
                setTierMinImpressions(25)
                setTierDesc('')
                setTierOrder(tiers.length + 1)
                setShowTierModal(true)
              }}
            >
              <Plus size={14} /> Tambah Rank Lokasi
            </button>
          }
        >
          <div className="table-wrapper">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Nama Rank</th>
                  <th>Multiplier</th>
                  <th>Syarat Otomatis (Rata-rata 7 Hari)</th>
                  <th>Simulasi Tarif</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.name}</strong>
                      {t.description && (
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{t.description}</div>
                      )}
                    </td>
                    <td>
                      <StatusPill variant="basic">{t.multiplier}x</StatusPill>
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {t.min_daily_connects === 0 && t.min_daily_impressions === 0 ? (
                        <span style={{ color: '#64748b' }}>Level dasar (tanpa syarat minimal)</span>
                      ) : (
                        <div>
                          Min. <strong>{t.min_daily_connects}</strong> koneksi/hari &amp;{' '}
                          <strong>{t.min_daily_impressions}</strong> tayangan/hari
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8' }}>
                      {formatRupiah(Math.round(baseImgPrice * t.multiplier))} / tayang
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '12px' }}
                          onClick={() => {
                            setEditingTier(t)
                            setTierName(t.name)
                            setTierMult(t.multiplier)
                            setTierMinConnects(t.min_daily_connects || 0)
                            setTierMinImpressions(t.min_daily_impressions || 0)
                            setTierDesc(t.description)
                            setTierOrder(t.sort_order)
                            setShowTierModal(true)
                          }}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '12px' }}
                          onClick={() => {
                            if (window.confirm(`Hapus rank "${t.name}"?`)) {
                              deleteTierMutation.mutate(t.id)
                            }
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataTableCard>

        {/* Payment Methods */}
        <DataTableCard
          title="Rekening Bank & QRIS Tujuan Top-Up Pengiklan"
          icon={CreditCard}
          toolbarActions={
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '12px' }}
              onClick={() => {
                setEditingPm(null)
                setPmType('BANK_TRANSFER')
                setPmProvider('')
                setPmAccNum('')
                setPmAccHolder('')
                setPmQrisUrl('')
                setPmInstructions('')
                setShowPmModal(true)
              }}
            >
              <Plus size={14} /> Tambah Rekening / QRIS
            </button>
          }
        >
          <div className="table-wrapper">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th>Bank / Metode</th>
                  <th>Nomor &amp; Atas Nama</th>
                  <th>Petunjuk</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paymentMethods.map((pm) => (
                  <tr key={pm.id}>
                    <td>
                      <strong>{pm.provider_name}</strong>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {pm.type === 'QRIS_STATIC' ? 'QRIS' : 'Transfer Bank'}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {pm.type === 'QRIS_STATIC' ? (
                        <span>Gambar QRIS tersedia</span>
                      ) : (
                        <>
                          <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            {pm.account_number}
                          </div>
                          <small style={{ color: '#64748b' }}>a.n. {pm.account_holder}</small>
                        </>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', color: '#475569' }}>
                      {pm.instructions || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '12px' }}
                          onClick={() => {
                            setEditingPm(pm)
                            setPmType(pm.type === 'QRIS_STATIC' ? 'QRIS_STATIC' : 'BANK_TRANSFER')
                            setPmProvider(pm.provider_name)
                            setPmAccNum(pm.account_number)
                            setPmAccHolder(pm.account_holder)
                            setPmQrisUrl(pm.qris_image_url)
                            setPmInstructions(pm.instructions)
                            setShowPmModal(true)
                          }}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '12px' }}
                          onClick={() => {
                            if (window.confirm(`Hapus metode "${pm.provider_name}"?`)) {
                              deletePmMutation.mutate(pm.id)
                            }
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataTableCard>
      </div>

      {/* Modal: Location Tier + Traffic Parameters */}
      {showTierModal && (
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
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveTierMutation.mutate()
            }}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
              display: 'grid',
              gap: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px' }}>
              {editingTier ? 'Edit Parameter Rank Lokasi' : 'Tambah Rank Lokasi'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div className="form-field">
                <label>Nama Rank *</label>
                <input
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  placeholder="Contoh: Premium"
                  required
                />
              </div>
              <div className="form-field">
                <label>Multiplier Harga (contoh: 1, 1.2, 1.5) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="20"
                  value={tierMult}
                  onChange={(e) => setTierMult(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '11px',
                padding: '0.9rem',
                display: 'grid',
                gap: '0.75rem',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                Syarat Kenaikan Rank Otomatis (Rata-rata Harian)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-field">
                  <label>Min. Koneksi Wi-Fi / Hari</label>
                  <input
                    type="number"
                    min={0}
                    value={tierMinConnects}
                    onChange={(e) => setTierMinConnects(Number(e.target.value))}
                  />
                </div>
                <div className="form-field">
                  <label>Min. Tayangan Iklan / Hari</label>
                  <input
                    type="number"
                    min={0}
                    value={tierMinImpressions}
                    onChange={(e) => setTierMinImpressions(Number(e.target.value))}
                  />
                </div>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Isi 0 pada level Standard (1.0x) agar menjadi rank awal lokasi baru.
              </span>
            </div>

            <div className="form-field">
              <label>Keterangan Singkat</label>
              <input
                value={tierDesc}
                onChange={(e) => setTierDesc(e.target.value)}
                placeholder="Contoh: Lokasi kafe ramai dengan pengunjung tinggi"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowTierModal(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saveTierMutation.isPending}
              >
                Simpan Rank
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Payment Method */}
      {showPmModal && (
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
          <form
            onSubmit={(e) => {
              e.preventDefault()
              savePmMutation.mutate()
            }}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
              display: 'grid',
              gap: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px' }}>
              {editingPm ? 'Edit Metode Pembayaran' : 'Tambah Metode Pembayaran'}
            </h3>
            <div className="form-field">
              <label>Jenis Pembayaran</label>
              <select
                value={pmType}
                onChange={(e) => setPmType(e.target.value as 'BANK_TRANSFER' | 'QRIS_STATIC')}
              >
                <option value="BANK_TRANSFER">Transfer Rekening Bank</option>
                <option value="QRIS_STATIC">QRIS Statis</option>
              </select>
            </div>
            <div className="form-field">
              <label>Nama Bank / Penyedia</label>
              <input
                value={pmProvider}
                onChange={(e) => setPmProvider(e.target.value)}
                placeholder="Contoh: Bank BCA / QRIS"
                required
              />
            </div>

            {pmType === 'BANK_TRANSFER' ? (
              <>
                <div className="form-field">
                  <label>Nomor Rekening</label>
                  <input
                    value={pmAccNum}
                    onChange={(e) => setPmAccNum(e.target.value)}
                    placeholder="Contoh: 8290123456"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Atas Nama Rekening</label>
                  <input
                    value={pmAccHolder}
                    onChange={(e) => setPmAccHolder(e.target.value)}
                    placeholder="Contoh: PT AdWave Indonesia"
                    required
                  />
                </div>
              </>
            ) : (
              <div className="form-field">
                <label>Gambar Kode QRIS</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      setUploadingQris(true)
                      const res = await adminMarketplaceApi.uploadQris(file)
                      setPmQrisUrl(res.url)
                      toast.success('Gambar QRIS berhasil diunggah')
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Gagal mengunggah QRIS')
                    } finally {
                      setUploadingQris(false)
                    }
                  }}
                />
                {uploadingQris && <small>Mengunggah gambar QRIS...</small>}
                {pmQrisUrl && (
                  <img
                    src={pmQrisUrl}
                    alt="QRIS"
                    style={{ maxHeight: '140px', borderRadius: '8px', marginTop: '0.5rem' }}
                  />
                )}
              </div>
            )}

            <div className="form-field">
              <label>Petunjuk Pembayaran</label>
              <input
                value={pmInstructions}
                onChange={(e) => setPmInstructions(e.target.value)}
                placeholder="Contoh: Unggah foto bukti transfer setelah pembayaran."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPmModal(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savePmMutation.isPending || uploadingQris}
              >
                Simpan Metode
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
