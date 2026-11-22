import { Menu, Wifi, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import '../public.css'

const navItems = [
  { to: '/', label: 'Beranda', end: true },
  { to: '/mitra-info', label: 'Untuk Mitra' },
  { to: '/iklan-info', label: 'Untuk Pengiklan' },
  { to: '/daftar-mitra', label: 'Daftar Mitra' },
  { to: '/tentang', label: 'Tentang' },
  { to: '/kontak', label: 'Kontak' },
]

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="pub-root">
      <header className="pub-nav">
        <div className="pub-container pub-nav-inner">
          <Link to="/" className="pub-brand" onClick={() => setMenuOpen(false)}>
            <span className="pub-brand-mark">
              <Wifi size={18} />
            </span>
            <span>AdWave WiFi</span>
          </Link>

          <nav className="pub-nav-links" aria-label="Navigasi utama">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `pub-nav-link${isActive ? ' active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="pub-nav-actions">
            <a href="/partner/login" className="pub-btn pub-btn-secondary">
              Portal Mitra
            </a>
            <a href="/advertiser/login" className="pub-btn pub-btn-primary">
              Pasang Iklan
            </a>
          </div>

          <button
            type="button"
            className="pub-mobile-toggle"
            aria-label="Buka menu navigasi"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div className={`pub-mobile-drawer${menuOpen ? ' open' : ''}`}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `pub-nav-link${isActive ? ' active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <a href="/partner/login" className="pub-btn pub-btn-secondary" style={{ flex: 1 }}>
              Portal Mitra
            </a>
            <a href="/advertiser/login" className="pub-btn pub-btn-primary" style={{ flex: 1 }}>
              Pasang Iklan
            </a>
          </div>
        </div>
      </header>

      <main className="pub-main">
        <Outlet />
      </main>

      <footer className="pub-footer">
        <div className="pub-container">
          <div className="pub-footer-grid">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span className="pub-brand-mark">
                  <Wifi size={18} />
                </span>
                <strong style={{ color: '#fff', fontSize: '16px' }}>AdWave WiFi</strong>
              </div>
              <p style={{ fontSize: '13.5px', lineHeight: 1.65, color: '#94a3b8', maxWidth: '300px' }}>
                Jaringan Wi-Fi Captive Portal berbasis iklan yang menghubungkan pemilik lokasi
                (kafe, restoran, ruang publik) dengan pengiklan lokal secara transparan.
              </p>
            </div>

            <div>
              <h4 style={{ color: '#fff', fontSize: '13.5px', marginBottom: '12px' }}>Solusi</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Link to="/mitra-info">Program Mitra & ROI</Link>
                <Link to="/iklan-info">Iklan Wi-Fi & Tarif</Link>
                <Link to="/daftar-mitra">Daftar Jadi Mitra</Link>
              </div>
            </div>

            <div>
              <h4 style={{ color: '#fff', fontSize: '13.5px', marginBottom: '12px' }}>Portal Masuk</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <a href="/advertiser/login">Portal Pengiklan</a>
                <a href="/partner/login">Portal Mitra Lokasi</a>
                <a href="/admin/login">Panel Pengelola</a>
              </div>
            </div>

            <div>
              <h4 style={{ color: '#fff', fontSize: '13.5px', marginBottom: '12px' }}>Perusahaan</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Link to="/tentang">Tentang Kami</Link>
                <Link to="/kontak">Hubungi Tim</Link>
              </div>
            </div>
          </div>

          <div
            style={{
              paddingTop: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '12.5px',
              color: '#64748b',
            }}
          >
            <span>© {new Date().getFullYear()} AdWave WiFi. Seluruh hak cipta dilindungi.</span>
            <span>Terintegrasi MikroTik Hotspot & RADIUS AAA</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
