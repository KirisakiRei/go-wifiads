import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Building2, Loader2, Lock, Mail, Megaphone, Phone, User } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { advertiserAuthQueryKey } from '@/features/advertiser-portal/hooks/use-current-advertiser'
import { advertiserApi } from '@/features/marketplace/marketplace.api'

export function AdvertiserAuthPage({ initialMode = 'login' }: { initialMode?: 'login' | 'register' }) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  const loginMutation = useMutation({
    mutationFn: () => advertiserApi.login({ email, password }),
    onSuccess: (res) => {
      queryClient.setQueryData(advertiserAuthQueryKey, res.advertiser)
      toast.success(`Selamat datang, ${res.advertiser.name}`)
      navigate('/dashboard', { replace: true })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal masuk'),
  })

  const registerMutation = useMutation({
    mutationFn: () =>
      advertiserApi.register({
        name,
        company_name: companyName,
        email,
        phone,
        password,
      }),
    onSuccess: (res) => {
      queryClient.setQueryData(advertiserAuthQueryKey, res.advertiser)
      toast.success('Akun pengiklan berhasil dibuat')
      navigate('/dashboard', { replace: true })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal mendaftar'),
  })

  const isPending = loginMutation.isPending || registerMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'login') {
      loginMutation.mutate()
    } else {
      registerMutation.mutate()
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '2.25rem 1.25rem',
        background: '#f8fafd',
      }}
    >
      <header style={{ width: '100%', maxWidth: '460px', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: '#1d4ed8',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Megaphone size={20} />
        </div>
        <div>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'block', lineHeight: 1.1 }}>
            AdWave Partner
          </span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
            Portal Pemasangan Iklan Wi-Fi
          </span>
        </div>
      </header>

      <section
        style={{
          width: '100%',
          maxWidth: '460px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '18px',
          padding: '2rem 1.75rem',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
          margin: '1.5rem 0',
        }}
      >
        {/* Mode Switcher */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.4rem',
            background: '#f1f5f9',
            padding: '0.35rem',
            borderRadius: '10px',
            marginBottom: '1.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => setMode('login')}
            style={{
              padding: '0.55rem',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'login' ? '#ffffff' : 'transparent',
              color: mode === 'login' ? '#0f172a' : '#64748b',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: mode === 'login' ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
            }}
          >
            Masuk Akun
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            style={{
              padding: '0.55rem',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'register' ? '#ffffff' : 'transparent',
              color: mode === 'register' ? '#0f172a' : '#64748b',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: mode === 'register' ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
            }}
          >
            Daftar Pengiklan
          </button>
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem' }}>
          {mode === 'login' ? 'Masuk ke Portal Pengiklan' : 'Buat Akun Pengiklan Baru'}
        </h1>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
          {mode === 'login'
            ? 'Kelola penayangan iklan, pilih titik lokasi di peta, dan pantau statistik tayangan.'
            : 'Daftarkan usaha atau brand Anda untuk mulai menayangkan iklan di titik lokasi Wi-Fi.'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          {mode === 'register' && (
            <>
              <div className="form-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <User size={14} color="#64748b" /> Nama Lengkap
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  required
                />
              </div>

              <div className="form-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Building2 size={14} color="#64748b" /> Nama Usaha / Brand
                </label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Contoh: Kopi Senja Nusantara"
                />
              </div>
            </>
          )}

          <div className="form-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Mail size={14} color="#64748b" /> Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@usaha.com"
              required
            />
          </div>

          {mode === 'register' && (
            <div className="form-field">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Phone size={14} color="#64748b" /> Nomor WhatsApp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812xxxxxxxx"
              />
            </div>
          )}

          <div className="form-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Lock size={14} color="#64748b" /> Kata Sandi
            </label>
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isPending}
            style={{ width: '100%', padding: '0.8rem', marginTop: '0.4rem', fontWeight: 700 }}
          >
            {isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <span>{mode === 'login' ? 'Masuk ke Dashboard' : 'Daftar Sekarang'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </section>

      <footer style={{ width: '100%', maxWidth: '460px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
        &copy; 2026 AdWave WiFi
      </footer>
    </main>
  )
}
