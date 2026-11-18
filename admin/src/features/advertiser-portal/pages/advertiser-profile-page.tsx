import { useMutation } from '@tanstack/react-query'
import { Key, Save, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { WavyHeader } from '@/components/ui'
import {
  advertiserAuthQueryKey,
  useCurrentAdvertiser,
} from '@/features/advertiser-portal/hooks/use-current-advertiser'
import { advertiserApi } from '@/features/marketplace/marketplace.api'

export function AdvertiserProfilePage() {
  const { data: advertiser } = useCurrentAdvertiser()
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (advertiser) {
      setName(advertiser.name || '')
      setCompanyName(advertiser.company_name || '')
      setPhone(advertiser.phone || '')
    }
  }, [advertiser])

  const profileMutation = useMutation({
    mutationFn: () =>
      advertiserApi.updateProfile({
        name: name.trim(),
        company_name: companyName.trim(),
        phone: phone.trim(),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(advertiserAuthQueryKey, updated)
      toast.success('Profil berhasil disimpan')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const passwordMutation = useMutation({
    mutationFn: () =>
      advertiserApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      toast.success('Kata sandi berhasil diperbarui')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div>
      <WavyHeader title="Profil Usaha & Akun" />

      <div className="stitch-page-stage">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          <div className="stitch-card-container" style={{ background: '#ffffff', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={18} color="#2563eb" /> Informasi Pengiklan
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                profileMutation.mutate()
              }}
              style={{ display: 'grid', gap: '1rem' }}
            >
              <div className="form-field">
                <label>Email Akun</label>
                <input value={advertiser?.email || ''} disabled style={{ background: '#f1f5f9' }} />
              </div>

              <div className="form-field">
                <label>Nama Lengkap</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="form-field">
                <label>Nama Usaha / Brand</label>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Contoh: Kopi Senja" />
              </div>

              <div className="form-field">
                <label>Nomor WhatsApp</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812xxxxxxxx" />
              </div>

              <div>
                <button type="submit" className="btn btn-primary" disabled={profileMutation.isPending}>
                  <Save size={16} /> Simpan Profil
                </button>
              </div>
            </form>
          </div>

          <div className="stitch-card-container" style={{ background: '#ffffff', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key size={18} color="#2563eb" /> Ubah Kata Sandi
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                passwordMutation.mutate()
              }}
              style={{ display: 'grid', gap: '1rem' }}
            >
              <div className="form-field">
                <label>Kata Sandi Saat Ini</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label>Kata Sandi Baru</label>
                <input
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  required
                />
              </div>

              <div>
                <button type="submit" className="btn btn-primary" disabled={passwordMutation.isPending}>
                  <Save size={16} /> Perbarui Kata Sandi
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
