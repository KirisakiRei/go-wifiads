import { useMutation } from '@tanstack/react-query'
import { Lock, LogIn, Store, User } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { partnerApi } from '@/features/marketplace/marketplace.api'
import { partnerAuthQueryKey } from '@/features/partner-portal/hooks/use-current-partner'

export function PartnerAuthPage() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')

  const loginMutation = useMutation({
    mutationFn: () => partnerApi.login({ identifier: identifier.trim(), password }),
    onSuccess: (res) => {
      queryClient.setQueryData(partnerAuthQueryKey, res.partner)
      toast.success(`Selamat datang, ${res.partner.venue_name || res.partner.name}!`)
      navigate(res.partner.has_coordinates ? '/dashboard' : '/profile', { replace: true })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal masuk ke portal mitra'),
  })

  return (
    <div
      className="partner-theme"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="stitch-card-container"
        style={{
          width: '100%',
          maxWidth: '430px',
          background: '#ffffff',
          borderRadius: '20px',
          padding: '2.1rem',
          boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.6rem' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: '#059669',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.8rem',
            }}
          >
            <Store size={26} />
          </div>
          <h1 style={{ fontSize: '21px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Portal Mitra Lokasi
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '0.35rem' }}>
            Pantau pengunjung Wi-Fi, iklan tayang, dan pendapatan lokasi Anda.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            loginMutation.mutate()
          }}
          style={{ display: 'grid', gap: '1.1rem' }}
        >
          <div className="form-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <User size={14} /> Username atau Email
            </label>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="contoh: kafekopi_nusantara"
              autoComplete="username"
              required
            />
          </div>
          <div className="form-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Lock size={14} /> Kata Sandi
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan kata sandi"
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loginMutation.isPending}
            style={{ width: '100%', padding: '0.8rem', fontWeight: 700, marginTop: '0.25rem' }}
          >
            <LogIn size={17} />
            {loginMutation.isPending ? 'Memproses...' : 'Masuk ke Portal Mitra'}
          </button>
        </form>

        <div
          style={{
            marginTop: '1.35rem',
            paddingTop: '1rem',
            borderTop: '1px solid #f1f5f9',
            textAlign: 'center',
            fontSize: '12px',
            color: '#64748b',
          }}
        >
          Belum punya akun? Daftar melalui link undangan yang dikirim tim AdWave ke WhatsApp Anda.
        </div>
      </div>
    </div>
  )
}
