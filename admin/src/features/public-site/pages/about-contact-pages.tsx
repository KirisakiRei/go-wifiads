import { ArrowRight, Building2, Mail, MapPin, MessageCircle, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

export function TentangPage() {
  return (
    <section className="pub-section">
      <div className="pub-container" style={{ maxWidth: '860px' }}>
        <span className="pub-eyebrow">
          <Building2 size={14} /> Tentang AdWave WiFi
        </span>
        <h1 className="pub-h1">Menghubungkan Koneksi Internet Publik dengan Ekonomi Lokal.</h1>
        <p className="pub-lead" style={{ maxWidth: '720px' }}>
          AdWave WiFi dibangun untuk membantu pemilik ruang publik, kafe, restoran, dan UMKM
          menyediakan akses Wi-Fi gratis yang aman dan tertata, sekaligus mengubah biaya internet
          menjadi peluang pendapatan baru melalui iklan lokal yang transparan.
        </p>

        <div className="pub-grid-2" style={{ marginTop: '32px' }}>
          <div className="pub-card">
            <ShieldCheck size={22} style={{ color: '#0037b0', marginBottom: '10px' }} />
            <h3 style={{ fontSize: '16px', marginBottom: '6px' }}>Arsitektur Industri (RADIUS AAA)</h3>
            <p style={{ color: 'var(--pub-muted)', fontSize: '14px', lineHeight: 1.65 }}>
              Terintegrasi langsung dengan MikroTik Hotspot & server RADIUS untuk kontrol sesi,
              kecepatan bandwidth, kuota data, dan pencatatan billing iklan yang akurat di sisi
              server.
            </p>
          </div>

          <div className="pub-card">
            <MapPin size={22} style={{ color: '#00668a', marginBottom: '10px' }} />
            <h3 style={{ fontSize: '16px', marginBottom: '6px' }}>Ekosistem Saling Menguntungkan</h3>
            <p style={{ color: 'var(--pub-muted)', fontSize: '14px', lineHeight: 1.65 }}>
              Pengunjung mendapat Wi-Fi gratis cepat, mitra lokasi mendapat bagi hasil rutin, dan
              pengiklan lokal menjangkau pelanggan nyata di sekitar lokasi usaha.
            </p>
          </div>
        </div>

        <div style={{ marginTop: '28px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/daftar-mitra" className="pub-btn pub-btn-primary">
            Bergabung Jadi Mitra <ArrowRight size={16} />
          </Link>
          <Link to="/kontak" className="pub-btn pub-btn-secondary">
            Hubungi Tim Kami
          </Link>
        </div>
      </div>
    </section>
  )
}

export function KontakPage() {
  return (
    <section className="pub-section">
      <div className="pub-container" style={{ maxWidth: '860px' }}>
        <span className="pub-eyebrow">
          <MessageCircle size={14} /> Kontak & Dukungan
        </span>
        <h1 className="pub-h1">Ada Pertanyaan? Tim Kami Siap Membantu.</h1>
        <p className="pub-lead">
          Baik untuk konsultasi pemasangan router MikroTik di lokasi mitra maupun perencanaan
          kampanye iklan multi-lokasi.
        </p>

        <div className="pub-grid-2" style={{ marginTop: '30px' }}>
          <div className="pub-card">
            <MessageCircle size={22} style={{ color: '#059669', marginBottom: '10px' }} />
            <h3 style={{ fontSize: '16px', marginBottom: '6px' }}>Kemitraan & Onboarding Router</h3>
            <p style={{ color: 'var(--pub-muted)', fontSize: '14px', marginBottom: '14px' }}>
              Ingin mendaftarkan kafe, restoran, atau area hotspot Anda? Kirim detail lokasi agar
              tim teknis kami segera menghubungi.
            </p>
            <Link to="/daftar-mitra" className="pub-btn pub-btn-primary">
              Isi Form Pendaftaran Mitra <ArrowRight size={15} />
            </Link>
          </div>

          <div className="pub-card">
            <Mail size={22} style={{ color: '#0037b0', marginBottom: '10px' }} />
            <h3 style={{ fontSize: '16px', marginBottom: '6px' }}>Pengiklan & Enterprise</h3>
            <p style={{ color: 'var(--pub-muted)', fontSize: '14px', marginBottom: '14px' }}>
              Daftar akun pengiklan mandiri untuk langsung memilih lokasi di peta, top-up saldo, dan
              menayangkan kampanye iklan Anda.
            </p>
            <a href="/advertiser/login" className="pub-btn pub-btn-secondary">
              Buka Portal Pengiklan <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
