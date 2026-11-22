import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  ChevronDown,
  Megaphone,
  Router,
  ShieldCheck,
  Store,
  TrendingUp,
  Wifi,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatRupiah } from '@/lib/formatters'
import { CaptivePhonePreview } from '../components/captive-phone-preview'
import { PublicLocationsMap } from '../components/public-locations-map'
import { publicSiteApi } from '../public.api'

const FAQS = [
  {
    q: 'Apakah pengunjung harus mengunduh aplikasi untuk memakai Wi-Fi?',
    a: 'Tidak. Saat HP terhubung ke Wi-Fi lokasi mitra, halaman Captive Portal otomatis terbuka ringan di browser bawaan Android maupun iOS (CNA).',
  },
  {
    q: 'Router apa yang didukung untuk menjadi Mitra Lokasi?',
    a: 'Semua router MikroTik dengan fitur Hotspot + RADIUS (RouterOS v6/v7). Tim kami menyediakan script setup otomatis (.rsc) agar pemasangan hanya butuh beberapa menit.',
  },
  {
    q: 'Bagaimana transparansi hitungan tayangan iklan & bagi hasil?',
    a: 'Setiap tayangan iklan diverifikasi durasinya oleh server sebelum voucher internet diterbitkan. Saldo pengiklan terpotong dan bagi hasil mitra langsung tercatat atomik secara real-time di dashboard masing-masing.',
  },
  {
    q: 'Berapa minimal saldo top-up untuk mulai beriklan?',
    a: 'Pengiklan dapat mulai dengan top-up ringan sesuai tarif dasar platform tanpa kontrak jangka panjang, serta memilih sendiri lokasi dan jam tayang.',
  },
]

export function PublicHomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const { data } = useQuery({
    queryKey: ['public-landing-data'],
    queryFn: publicSiteApi.getLandingData,
    staleTime: 60_000,
  })

  const locations = data?.locations ?? []
  const pricing = data?.pricing
  const basePrice = pricing?.base_price_image_idr ?? 50
  const sharePct = pricing?.default_partner_share_percent ?? 20

  return (
    <div>
      {/* Hero */}
      <section className="pub-hero">
        <div className="pub-container pub-hero-grid">
          <div>
            <span className="pub-eyebrow">
              <Wifi size={14} /> Platform Wi-Fi Captive Portal & Iklan Lokal
            </span>
            <h1 className="pub-h1">
              Ubah Wi-Fi Gratis Jadi Sumber Pendapatan & Media Iklan Tepat Sasaran.
            </h1>
            <p className="pub-lead">
              Setiap kali pengunjung kafe, restoran, atau ruang publik terhubung ke Wi-Fi gratis,
              iklan brand lokal tampil penuh di layar HP mereka — bagi hasil otomatis masuk ke
              pemilik lokasi.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '24px' }}>
              <Link to="/daftar-mitra" className="pub-btn pub-btn-primary pub-btn-lg">
                <Store size={18} /> Daftar Jadi Mitra Lokasi
              </Link>
              <Link to="/iklan-info" className="pub-btn pub-btn-secondary pub-btn-lg">
                <Megaphone size={18} /> Hitung Estimasi Iklan
              </Link>
            </div>

            <div className="pub-stat-strip">
              <div className="pub-stat-box">
                <div className="pub-stat-val">
                  {data?.stats.total_public_locations ?? locations.length}
                </div>
                <div className="pub-stat-lbl">Titik Wi-Fi Marketplace</div>
              </div>
              <div className="pub-stat-box">
                <div className="pub-stat-val">Mulai {formatRupiah(basePrice)}</div>
                <div className="pub-stat-lbl">Tarif per Tayangan</div>
              </div>
              <div className="pub-stat-box">
                <div className="pub-stat-val">{sharePct}%</div>
                <div className="pub-stat-lbl">Standar Bagi Hasil Mitra</div>
              </div>
            </div>
          </div>

          <CaptivePhonePreview />
        </div>
      </section>

      {/* How it works */}
      <section className="pub-section pub-section-alt">
        <div className="pub-container">
          <div style={{ maxWidth: '620px', marginBottom: '32px' }}>
            <span className="pub-eyebrow">Cara Kerja</span>
            <h2 className="pub-h2">Tiga Langkah Sederhana dari Login Hingga Online</h2>
            <p style={{ color: 'var(--pub-muted)', fontSize: '15px' }}>
              Dirancang ringan untuk semua HP pengunjung, ketat di sisi server untuk keakuratan
              billing iklan.
            </p>
          </div>

          <div className="pub-grid-3">
            <div className="pub-card pub-card-hover">
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#e8efff',
                  color: '#0037b0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px',
                }}
              >
                <Router size={20} />
              </div>
              <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>1. Koneksi ke Wi-Fi Mitra</h3>
              <p style={{ color: 'var(--pub-muted)', fontSize: '14px', lineHeight: 1.6 }}>
                Pengunjung memilih SSID Wi-Fi gratis di lokasi mitra. Router MikroTik langsung
                mengarahkan ke halaman Captive Portal ringan tanpa perlu install aplikasi.
              </p>
            </div>

            <div className="pub-card pub-card-hover">
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#e0f2fe',
                  color: '#00668a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px',
                }}
              >
                <ShieldCheck size={20} />
              </div>
              <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>2. Iklan Terverifikasi Server</h3>
              <p style={{ color: 'var(--pub-muted)', fontSize: '14px', lineHeight: 1.6 }}>
                Gambar atau video iklan tampil layar penuh. Durasi tonton diverifikasi oleh server
                sehingga pengiklan hanya membayar tayangan valid.
              </p>
            </div>

            <div className="pub-card pub-card-hover">
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px',
                }}
              >
                <TrendingUp size={20} />
              </div>
              <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>3. Online & Bagi Hasil Instan</h3>
              <p style={{ color: 'var(--pub-muted)', fontSize: '14px', lineHeight: 1.6 }}>
                Akses internet aktif via RADIUS. Dompet mitra otomatis menerima porsi bagi hasil
                yang dapat dipantau real-time dan dicairkan ke rekening bank.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Public Locations Map */}
      <section className="pub-section">
        <div className="pub-container">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <div>
              <span className="pub-eyebrow">Jaringan Lokasi Publik</span>
              <h2 className="pub-h2">Peta Titik Wi-Fi Siap Pasang Iklan</h2>
              <p style={{ color: 'var(--pub-muted)', fontSize: '14.5px' }}>
                Data lokasi diambil langsung dari jaringan router aktif yang terbuka di marketplace.
              </p>
            </div>
            <a href="/advertiser/login" className="pub-btn pub-btn-ghost">
              Pilih Lokasi di Portal Pengiklan <ArrowRight size={16} />
            </a>
          </div>

          <PublicLocationsMap locations={locations} />
        </div>
      </section>

      {/* Dual Value Prop */}
      <section className="pub-section pub-section-alt">
        <div className="pub-container pub-grid-2">
          <div className="pub-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <span className="pub-eyebrow" style={{ alignSelf: 'flex-start', marginBottom: 0 }}>
              Pemilik Lokasi (Mitra)
            </span>
            <h3 style={{ fontSize: '21px', fontWeight: 800 }}>
              Monetisasi Pengunjung Wi-Fi Kafe & Usaha Anda
            </h3>
            <p style={{ color: 'var(--pub-muted)', fontSize: '14.5px', lineHeight: 1.65 }}>
              Internet yang biasanya jadi biaya rutin bulanan kini menghasilkan pemasukan tambahan
              otomatis. Pantau trafik harian, bagi hasil, dan cairkan saldo kapan saja.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '8px' }}>
              <Link to="/mitra-info" className="pub-btn pub-btn-primary">
                Simulasi ROI Mitra <ArrowRight size={15} />
              </Link>
              <Link to="/daftar-mitra" className="pub-btn pub-btn-secondary">
                Daftar Sekarang
              </Link>
            </div>
          </div>

          <div className="pub-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <span
              className="pub-eyebrow"
              style={{ alignSelf: 'flex-start', marginBottom: 0, background: '#e0f2fe', color: '#00668a' }}
            >
              Pengiklan & Brand Lokal
            </span>
            <h3 style={{ fontSize: '21px', fontWeight: 800 }}>
              Tampil 100% Layar Penuh di Lokasi Pilihan Anda
            </h3>
            <p style={{ color: 'var(--pub-muted)', fontSize: '14.5px', lineHeight: 1.65 }}>
              Targetkan pelanggan nyata di kafe, resto, dan area komersial sekitar bisnis Anda.
              Atur jadwal jam tayang, batas budget harian, dan pantau klik serta tontonan lengkap.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '8px' }}>
              <Link to="/iklan-info" className="pub-btn pub-btn-primary">
                Kalkulator Tayangan <ArrowRight size={15} />
              </Link>
              <a href="/advertiser/login" className="pub-btn pub-btn-secondary">
                Buat Kampanye
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pub-section">
        <div className="pub-container" style={{ maxWidth: '820px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <span className="pub-eyebrow">FAQ</span>
            <h2 className="pub-h2">Pertanyaan yang Sering Diajukan</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx
              return (
                <div key={item.q} className="pub-faq-item">
                  <button
                    type="button"
                    className="pub-faq-btn"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      size={18}
                      style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 180ms cubic-bezier(0.23, 1, 0.32, 1)',
                        color: '#64748b',
                      }}
                    />
                  </button>
                  {isOpen && <div className="pub-faq-answer">{item.a}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
