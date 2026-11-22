import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BarChart3, Clock, MapPin, Megaphone, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { formatRupiah } from '@/lib/formatters'
import { publicSiteApi } from '../public.api'

export function IklanInfoPage() {
  const { data } = useQuery({
    queryKey: ['public-landing-data'],
    queryFn: publicSiteApi.getLandingData,
    staleTime: 60_000,
  })

  const imgBase = data?.pricing.base_price_image_idr ?? 50
  const vidBase = data?.pricing.base_price_video_idr ?? 50
  const minTopup = data?.pricing.min_topup_amount_idr ?? 50000
  const maxDur = data?.pricing.max_ad_duration_seconds ?? 30
  const tiers = data?.tiers ?? []

  const [budget, setBudget] = useState(500000)
  const [mediaType, setMediaType] = useState<'image' | 'video'>('video')
  const [multiplier, setMultiplier] = useState(1.0)
  const [campaignDays, setCampaignDays] = useState(14)

  const unitPrice = Math.max(1, Math.round((mediaType === 'video' ? vidBase : imgBase) * multiplier))
  const totalImpressions = Math.floor(budget / unitPrice)
  const dailyImpressions = Math.max(1, Math.round(totalImpressions / Math.max(1, campaignDays)))
  const effectiveCPM = unitPrice * 1000

  return (
    <div>
      <section className="pub-hero" style={{ padding: '52px 0 44px' }}>
        <div className="pub-container">
          <span className="pub-eyebrow">
            <Megaphone size={14} /> Solusi Pengiklan & Brand Lokal
          </span>
          <h1 className="pub-h1" style={{ maxWidth: '720px' }}>
            Jangkau Audiens Nyata di Lokasi Pilihan dengan 100% Perhatian Layar Penuh.
          </h1>
          <p className="pub-lead">
            Pilih lokasi kafe, restoran, dan ruang publik di peta, tentukan jam tayang, unggah
            gambar atau video hingga {maxDur} detik, dan bayar hanya untuk tayangan terverifikasi.
          </p>
        </div>
      </section>

      <section className="pub-section">
        <div className="pub-container">
          <div style={{ marginBottom: '24px' }}>
            <span className="pub-eyebrow">
              <Sparkles size={14} /> Kalkulator Estimasi Tayangan
            </span>
            <h2 className="pub-h2">Simulasikan Jangkauan Budget Iklan Anda</h2>
            <p style={{ color: 'var(--pub-muted)', fontSize: '14.5px' }}>
              Tarif dasar live: Gambar {formatRupiah(imgBase)}/tayang · Video {formatRupiah(vidBase)}
              /tayang · Minimal top-up {formatRupiah(minTopup)}.
            </p>
          </div>

          <div className="pub-calc-grid">
            <div className="pub-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13.5px', marginBottom: '8px' }}>
                  Format Materi Iklan
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`pub-step-pill${mediaType === 'image' ? ' active' : ''}`}
                    onClick={() => setMediaType('image')}
                  >
                    Poster / Gambar ({formatRupiah(imgBase)})
                  </button>
                  <button
                    type="button"
                    className={`pub-step-pill${mediaType === 'video' ? ' active' : ''}`}
                    onClick={() => setMediaType('video')}
                  >
                    Video MP4 ({formatRupiah(vidBase)})
                  </button>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label htmlFor="adv-budget" style={{ fontWeight: 600, fontSize: '13.5px' }}>
                    Budget Kampanye
                  </label>
                  <strong style={{ color: 'var(--pub-primary)' }}>{formatRupiah(budget)}</strong>
                </div>
                <input
                  id="adv-budget"
                  type="range"
                  className="pub-range"
                  min={minTopup}
                  max={10000000}
                  step={50000}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b' }}>
                  <span>{formatRupiah(minTopup)}</span>
                  <span>{formatRupiah(10000000)}</span>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label htmlFor="adv-days" style={{ fontWeight: 600, fontSize: '13.5px' }}>
                    Durasi Kampanye
                  </label>
                  <strong style={{ color: 'var(--pub-primary)' }}>{campaignDays} hari</strong>
                </div>
                <input
                  id="adv-days"
                  type="range"
                  className="pub-range"
                  min={1}
                  max={60}
                  step={1}
                  value={campaignDays}
                  onChange={(e) => setCampaignDays(Number(e.target.value))}
                />
              </div>

              {tiers.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', marginBottom: '8px' }}>
                    Target Tier Lokasi
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
                ESTIMASI TOTAL TAYANGAN TERVERIFIKASI
              </div>
              <div style={{ fontSize: 'clamp(30px, 3.8vw, 40px)', fontWeight: 800, marginTop: '6px' }}>
                {totalImpressions.toLocaleString('id-ID')}
                <span style={{ fontSize: '15px', fontWeight: 500, color: '#bfdbfe' }}> tayangan</span>
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
                  <div style={{ fontSize: '12px', color: '#bfdbfe' }}>Biaya per Tayang</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                    {formatRupiah(unitPrice)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#bfdbfe' }}>CPM Efektif (per 1.000)</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                    {formatRupiah(effectiveCPM)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#bfdbfe' }}>Rata-rata Tayangan/Hari</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '2px' }}>
                    ~{dailyImpressions.toLocaleString('id-ID')} / hari
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#bfdbfe' }}>Lokasi Tersedia</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '2px' }}>
                    {data?.stats.total_public_locations ?? 0} titik aktif
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '24px' }}>
                <a
                  href="/advertiser/login"
                  className="pub-btn pub-btn-lg"
                  style={{ background: '#ffffff', color: '#0037b0', width: '100%' }}
                >
                  Daftar & Mulai Beriklan <ArrowRight size={17} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pub-section pub-section-alt">
        <div className="pub-container pub-grid-3">
          <div className="pub-card">
            <MapPin size={22} style={{ color: '#0037b0', marginBottom: '10px' }} />
            <h3 style={{ fontSize: '16px', marginBottom: '6px' }}>Hyper-Local Targeting</h3>
            <p style={{ color: 'var(--pub-muted)', fontSize: '14px' }}>
              Pilih langsung titik kafe atau venue di peta yang paling dekat dengan target pasar
              bisnis Anda.
            </p>
          </div>
          <div className="pub-card">
            <Clock size={22} style={{ color: '#00668a', marginBottom: '10px' }} />
            <h3 style={{ fontSize: '16px', marginBottom: '6px' }}>Jadwal Jam & Batas Harian</h3>
            <p style={{ color: 'var(--pub-muted)', fontSize: '14px' }}>
              Atur jam tayang (mis. jam makan siang atau malam) serta limit pengeluaran harian agar
              saldo tetap terkendali.
            </p>
          </div>
          <div className="pub-card">
            <BarChart3 size={22} style={{ color: '#059669', marginBottom: '10px' }} />
            <h3 style={{ fontSize: '16px', marginBottom: '6px' }}>Laporan Analitik Lengkap</h3>
            <p style={{ color: 'var(--pub-muted)', fontSize: '14px' }}>
              Pantau tayangan, klik CTA, tingkat tonton selesai video, serta detail transaksi dompet
              secara real-time.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
