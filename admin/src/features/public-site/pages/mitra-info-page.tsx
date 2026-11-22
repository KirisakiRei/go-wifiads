import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Calculator, CheckCircle2, Store, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatRupiah } from '@/lib/formatters'
import { publicSiteApi } from '../public.api'

export function MitraInfoPage() {
  const { data } = useQuery({
    queryKey: ['public-landing-data'],
    queryFn: publicSiteApi.getLandingData,
    staleTime: 60_000,
  })

  const defaultShare = data?.pricing.default_partner_share_percent ?? 20
  const baseRate = Math.max(
    data?.pricing.base_price_video_idr ?? 50,
    data?.pricing.base_price_image_idr ?? 50
  )
  const minWithdrawal = data?.pricing.min_withdrawal_amount_idr ?? 50000
  const tiers = data?.tiers ?? []

  const [dailyVisitors, setDailyVisitors] = useState(150)
  const [fillRatePct, setFillRatePct] = useState(80)
  const [multiplier, setMultiplier] = useState(1.0)
  const [customSharePct, setCustomSharePct] = useState<number | null>(null)

  const sharePct = customSharePct ?? defaultShare
  const billableViewsPerDay = Math.round((dailyVisitors * fillRatePct) / 100)
  const effectiveRate = Math.round(baseRate * multiplier)
  const partnerPerView = (effectiveRate * sharePct) / 100
  const dailyRevenue = Math.round(billableViewsPerDay * partnerPerView)
  const monthlyRevenue = dailyRevenue * 30
  const yearlyRevenue = dailyRevenue * 365

  return (
    <div>
      <section className="pub-hero" style={{ padding: '52px 0 44px' }}>
        <div className="pub-container">
          <span className="pub-eyebrow">
            <Store size={14} /> Program Kemitraan Lokasi
          </span>
          <h1 className="pub-h1" style={{ maxWidth: '720px' }}>
            Jadikan Wi-Fi Kafe & Lokasi Usaha Anda Aset Penghasil Pendapatan Pasif.
          </h1>
          <p className="pub-lead">
            Tanpa biaya langganan platform. Cukup gunakan router MikroTik di lokasi Anda, terima
            bagi hasil otomatis dari setiap tayangan iklan pengiklan lokal, dan cairkan langsung ke
            rekening bank.
          </p>
        </div>
      </section>

      <section className="pub-section">
        <div className="pub-container">
          <div style={{ marginBottom: '24px' }}>
            <span className="pub-eyebrow">
              <Calculator size={14} /> ROI Calculator Mitra
            </span>
            <h2 className="pub-h2">Hitung Estimasi Bagi Hasil Lokasi Anda</h2>
            <p style={{ color: 'var(--pub-muted)', fontSize: '14.5px' }}>
              Menggunakan tarif dasar live platform ({formatRupiah(baseRate)}/tayang) dan porsi bagi
              hasil standar {defaultShare}%.
            </p>
          </div>

          <div className="pub-calc-grid">
            <div className="pub-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label htmlFor="roi-visitors" style={{ fontWeight: 600, fontSize: '13.5px' }}>
                    Estimasi Pengunjung Wi-Fi / Hari
                  </label>
                  <strong style={{ color: 'var(--pub-primary)' }}>
                    {dailyVisitors.toLocaleString('id-ID')} perangkat
                  </strong>
                </div>
                <input
                  id="roi-visitors"
                  type="range"
                  className="pub-range"
                  min={20}
                  max={1500}
                  step={10}
                  value={dailyVisitors}
                  onChange={(e) => setDailyVisitors(Number(e.target.value))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b' }}>
                  <span>20/hari (Kedai Kecil)</span>
                  <span>1.500/hari (Foodcourt/Area Ramai)</span>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label htmlFor="roi-fill" style={{ fontWeight: 600, fontSize: '13.5px' }}>
                    Asumsi Keterisian Slot Iklan Berbayar
                  </label>
                  <strong style={{ color: 'var(--pub-primary)' }}>{fillRatePct}%</strong>
                </div>
                <input
                  id="roi-fill"
                  type="range"
                  className="pub-range"
                  min={20}
                  max={100}
                  step={5}
                  value={fillRatePct}
                  onChange={(e) => setFillRatePct(Number(e.target.value))}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label htmlFor="roi-share" style={{ fontWeight: 600, fontSize: '13.5px' }}>
                    Porsi Bagi Hasil Mitra (%)
                  </label>
                  <strong style={{ color: 'var(--pub-primary)' }}>{sharePct}%</strong>
                </div>
                <input
                  id="roi-share"
                  type="range"
                  className="pub-range"
                  min={10}
                  max={60}
                  step={5}
                  value={sharePct}
                  onChange={(e) => setCustomSharePct(Number(e.target.value))}
                />
              </div>

              {tiers.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', marginBottom: '8px' }}>
                    Tingkatan Lokasi (Multiplier Tarif)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {tiers.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`pub-step-pill${multiplier === t.multiplier ? ' active' : ''}`}
                        onClick={() => setMultiplier(t.multiplier)}
                      >
                        {t.name} ({t.multiplier}x)
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pub-calc-result">
              <div style={{ fontSize: '12.5px', color: '#bfdbfe', fontWeight: 600 }}>
                ESTIMASI PENDAPATAN BULANAN MITRA
              </div>
              <div style={{ fontSize: 'clamp(28px, 3.6vw, 38px)', fontWeight: 800, marginTop: '6px' }}>
                {formatRupiah(monthlyRevenue)}
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#bfdbfe' }}> / bulan</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginTop: '20px',
                  paddingTop: '18px',
                  borderTop: '1px solid rgba(255,255,255,0.16)',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: '#bfdbfe' }}>Estimasi Harian</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                    {formatRupiah(dailyRevenue)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#bfdbfe' }}>Estimasi Tahunan</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                    {formatRupiah(yearlyRevenue)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#bfdbfe' }}>Tayangan Berbayar/Hari</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '2px' }}>
                    {billableViewsPerDay.toLocaleString('id-ID')} tayangan
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#bfdbfe' }}>Minimal Pencairan</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '2px' }}>
                    {formatRupiah(minWithdrawal)}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Link
                  to="/daftar-mitra"
                  className="pub-btn pub-btn-lg"
                  style={{ background: '#ffffff', color: '#0037b0', width: '100%' }}
                >
                  Ajukan Lokasi Saya Sekarang <ArrowRight size={17} />
                </Link>
                <div style={{ fontSize: '11.5px', color: '#cbd5e1', textAlign: 'center' }}>
                  *Simulasi bersifat estimasi berdasarkan trafik & keterisian kampanye iklan.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pub-section pub-section-alt">
        <div className="pub-container pub-grid-3">
          <div className="pub-card">
            <CheckCircle2 size={22} style={{ color: '#059669', marginBottom: '10px' }} />
            <h3 style={{ fontSize: '16px', marginBottom: '6px' }}>Setup MikroTik Cepat</h3>
            <p style={{ color: 'var(--pub-muted)', fontSize: '14px' }}>
              Tersedia file script `.rsc` serta halaman portal siap pakai — tim kami bantu sampai
              online.
            </p>
          </div>
          <div className="pub-card">
            <Wallet size={22} style={{ color: '#0037b0', marginBottom: '10px' }} />
            <h3 style={{ fontSize: '16px', marginBottom: '6px' }}>Dashboard Transparan</h3>
            <p style={{ color: 'var(--pub-muted)', fontSize: '14px' }}>
              Pantau setiap tayangan iklan, klik, peringkat tier lokasi, serta riwayat dompet
              melalui Portal Mitra.
            </p>
          </div>
          <div className="pub-card">
            <Store size={22} style={{ color: '#00668a', marginBottom: '10px' }} />
            <h3 style={{ fontSize: '16px', marginBottom: '6px' }}>Branding Lokasi Tetap Rapi</h3>
            <p style={{ color: 'var(--pub-muted)', fontSize: '14px' }}>
              Pengunjung mendapat pengalaman Wi-Fi modern dengan akses cepat dan opsi redeem voucher
              VIP untuk tamu khusus.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
