import { Router, Shield } from 'lucide-react'
import { LoginForm } from '@/features/auth/components/login-form'

export function LoginPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '2.5rem 1.5rem',
        background: '#f8fafd',
        position: 'relative',
        overflowY: 'auto',
      }}
    >
      {/* Top Brand Header */}
      <header
        style={{
          width: '100%',
          maxWidth: '480px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#0037b0',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0, 55, 176, 0.2)',
            }}
          >
            <Router size={20} />
          </div>
          <div>
            <span
              style={{
                fontSize: '16px',
                fontWeight: 800,
                color: '#0b1c30',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                display: 'block',
              }}
            >
              AdWave WiFi
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
              MikroTik AdOps
            </span>
          </div>
        </div>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.65rem',
            borderRadius: '9999px',
            background: '#eff6ff',
            color: '#1e40af',
            fontSize: '11px',
            fontWeight: 700,
            border: '1px solid #dbeafe',
          }}
        >
          <Shield size={12} color="#1d4ed8" />
          Portal Terlindungi
        </span>
      </header>

      {/* Main Centered Content Column (Baseten Style) */}
      <section
        style={{
          width: '100%',
          maxWidth: '480px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          margin: 'auto 0',
          padding: '2rem 0',
        }}
      >
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 800,
            color: '#0b1c30',
            letterSpacing: '-0.03em',
            marginBottom: '0.5rem',
            lineHeight: 1.2,
          }}
        >
          Masuk ke Akun Anda
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: '#64748b',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Masukkan kredensial administrator untuk mengelola captive portal, kampanye iklan sponsor, dan distribusi voucher.
        </p>

        <LoginForm />
      </section>

      {/* Footer */}
      <footer
        style={{
          width: '100%',
          maxWidth: '480px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#94a3b8',
          borderTop: '1px solid #e2e8f0',
          paddingTop: '1.25rem',
        }}
      >
        <span>&copy; 2026 AdWave WiFi Platform</span>
        <span>Privat &amp; Aman</span>
      </footer>
    </main>
  )
}
