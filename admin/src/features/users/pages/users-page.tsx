import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Key,
  Lock,
  Save,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/query-state'
import {
  DataTableCard,
  KpiCard,
  KpiGrid,
  SearchInput,
  StatusPill,
  WavyHeader,
} from '@/components/ui'
import { formatDate } from '@/lib/formatters'
import { usersApi } from '@/features/users/api/users.api'
import { usersQueryKey, useUsers } from '@/features/users/hooks/use-users'
import type { AdminUser } from '@/features/users/types/user.types'

export function UsersPage() {
  const { data: users, isPending, error } = useUsers()
  const [showCreate, setShowCreate] = useState(false)
  const [changingPasswordUser, setChangingPasswordUser] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [search, setSearch] = useState('')

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      toast.success('Pengguna admin berhasil dibuat')
      queryClient.invalidateQueries({ queryKey: usersQueryKey })
      setShowCreate(false)
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Gagal membuat pengguna')
    },
  })

  const passwordMutation = useMutation({
    mutationFn: usersApi.changePassword,
    onSuccess: () => {
      toast.success('Password pengguna berhasil diubah')
      setChangingPasswordUser(null)
      setNewPassword('')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Gagal mengubah password')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      toast.success('Pengguna berhasil dihapus')
      queryClient.invalidateQueries({ queryKey: usersQueryKey })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Gagal menghapus pengguna')
    },
  })

  if (isPending) return <LoadingState />
  if (error || !users) return <ErrorState message="Gagal memuat pengguna admin." />

  const handleDelete = (u: AdminUser) => {
    if (window.confirm(`Yakin ingin menghapus admin "${u.name || u.username}"?`)) {
      deleteMutation.mutate(u.id)
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!changingPasswordUser || !newPassword) return
    passwordMutation.mutate({
      id: changingPasswordUser.id,
      data: { password: newPassword },
    })
  }

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase()
    return u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
  })

  const uniqueRoles = new Set(users.map((u) => u.role)).size
  const activeAdmins = users.filter((u) => u.is_active).length

  return (
    <div>
      <WavyHeader
        title="Pengguna Admin"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
          >
            <UserPlus size={18} />
            Tambah Admin Baru
          </button>
        }
      />

      <div className="stitch-page-stage">
        {/* Telemetry KPI Cards from Stitch */}
        <KpiGrid columns={4}>
          <KpiCard
            label="Total Administrator"
            value={users.length}
            icon={Users}
            trend={{ label: 'Terdaftar', variant: 'success' }}
            footerLeft="Akun pengelola console"
            footerRight="Active Directory"
          />

          <KpiCard
            label="Peran Aktif (Roles)"
            value={uniqueRoles}
            icon={Shield}
            iconBoxVariant="secondary"
            trend={{ label: 'Role Sistem' }}
            footerLeft="Superuser, Admin, Operator"
            footerRight="RBAC Enforced"
          />

          <KpiCard
            label="Admin Aktif"
            value={activeAdmins}
            icon={ShieldCheck}
            iconColor="#10b981"
            iconBoxVariant="success"
            trend={{ label: 'Enabled', variant: 'success' }}
            footerLeft="Status akun login siap"
            footerRight="JWT Secure Cookie"
          />

          <KpiCard
            label="Keamanan Autentikasi"
            value="100%"
            icon={Lock}
            trend={{ label: 'Bcrypt Hash' }}
            footerLeft="Enforced Rate-Limit 10x/min"
            footerRight="Bruteforce Guard"
          />
        </KpiGrid>

        {/* Modal Popup: Tambah Pengguna Administrator Baru */}
        {showCreate && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11, 28, 48, 0.45)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCreate(false)
            }}
          >
            <div
              className="stitch-card-container"
              style={{
                width: '100%',
                maxWidth: '680px',
                borderRadius: '16px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
                border: '1px solid #bfdbfe',
                animation: 'fadeIn 0.15s ease-out',
                overflow: 'hidden',
              }}
            >
              <div className="table-toolbar" style={{ background: '#eff6ff', borderBottom: '1px solid #e2e8f0' }}>
                <div className="table-toolbar-title">
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: '#dbeafe',
                      color: '#1d4ed8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#0b1c30' }}>Tambah Administrator Baru</h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Akun pengelola console dengan proteksi password Bcrypt
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem', borderRadius: '8px' }}
                  onClick={() => setShowCreate(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const f = new FormData(e.currentTarget)
                  createMutation.mutate({
                    username: String(f.get('username') || ''),
                    password: String(f.get('password') || ''),
                    name: String(f.get('name') || ''),
                    role: String(f.get('role') || 'admin'),
                    is_active: true,
                  })
                }}
                style={{ padding: '1.75rem', display: 'grid', gap: '1.25rem', background: '#ffffff' }}
              >
                <div className="field-grid">
                  <div className="form-field">
                    <label>Username Akun</label>
                    <input name="username" required placeholder="Misal: ryan_operator" />
                    <span className="helper-text">Digunakan saat login ke dashboard admin.</span>
                  </div>

                  <div className="form-field">
                    <label>Nama Lengkap</label>
                    <input name="name" required placeholder="Misal: Ryan Hidayat" />
                    <span className="helper-text">Nama tampilan profil admin.</span>
                  </div>

                  <div className="form-field">
                    <label>Password Akun</label>
                    <input name="password" type="password" required minLength={8} placeholder="Minimal 8 karakter" />
                    <span className="helper-text">Disimpan dengan hashing Bcrypt aman.</span>
                  </div>

                  <div className="form-field">
                    <label>Peran / Role RBAC</label>
                    <select name="role" defaultValue="admin">
                      <option value="admin">Administrator (Akses Penuh)</option>
                      <option value="operator">Operator (Monitoring &amp; Voucher)</option>
                    </select>
                    <span className="helper-text">Tentukan level hak akses pengguna.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                    Batal
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
                    <Save size={16} />
                    {createMutation.isPending ? 'Menyimpan...' : 'Simpan Akun Admin'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Popup: Ubah Password */}
        {changingPasswordUser && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11, 28, 48, 0.45)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setChangingPasswordUser(null)
            }}
          >
            <div
              className="stitch-card-container"
              style={{
                width: '100%',
                maxWidth: '520px',
                borderRadius: '16px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
                border: '1px solid #fde68a',
                animation: 'fadeIn 0.15s ease-out',
                overflow: 'hidden',
              }}
            >
              <div className="table-toolbar" style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                <div className="table-toolbar-title">
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: '#fef3c7',
                      color: '#d97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Key size={18} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#92400e' }}>Ubah Password Admin</h3>
                    <span style={{ fontSize: '12px', color: '#b45309' }}>
                      Akun: <strong>{changingPasswordUser.name}</strong> ({changingPasswordUser.username})
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem', borderRadius: '8px' }}
                  onClick={() => setChangingPasswordUser(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handlePasswordSubmit} style={{ padding: '1.75rem', display: 'grid', gap: '1.25rem', background: '#ffffff' }}>
                <div className="form-field">
                  <label>Password Baru</label>
                  <input
                    type="password"
                    placeholder="Masukkan password baru (minimal 8 karakter)"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    style={{ padding: '0.75rem 0.85rem' }}
                  />
                  <span className="helper-text">
                    Password akan di-hash menggunakan algoritma Bcrypt (cost 10).
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setChangingPasswordUser(null)}>
                    Batal
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={passwordMutation.isPending}>
                    <Save size={16} />
                    {passwordMutation.isPending ? 'Menyimpan...' : 'Simpan Password Baru'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Users Table */}
        <DataTableCard
          title="Daftar Pengguna Administrator"
          icon={ShieldCheck}
          toolbarActions={
            <SearchInput
              placeholder="Cari admin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '220px' }}
            />
          }
        >

          {filteredUsers.length ? (
            <div className="table-wrapper">
              <table className="stitch-table">
                <thead>
                  <tr>
                    <th>Nama &amp; Username</th>
                    <th>Peran (Role)</th>
                    <th>Status Akun</th>
                    <th>Terakhir Login</th>
                    <th>Waktu Dibuat</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div className="user-avatar-circle">
                            {(u.name || u.username).substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ fontSize: '14px', color: '#0b1c30' }}>{u.name}</strong>
                            <br />
                            <small>@{u.username}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusPill variant="premium" style={{ textTransform: 'capitalize' }}>
                          {u.role}
                        </StatusPill>
                      </td>
                      <td>
                        {u.is_active ? (
                          <StatusPill variant="active" dot>Aktif</StatusPill>
                        ) : (
                          <StatusPill variant="expired">Nonaktif</StatusPill>
                        )}
                      </td>
                      <td>{formatDate(u.last_login_at)}</td>
                      <td>{formatDate(u.created_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.45rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '12px' }}
                            onClick={() => setChangingPasswordUser(u)}
                          >
                            <Key size={14} />
                            Password
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '12px' }}
                            onClick={() => handleDelete(u)}
                          >
                            <Trash2 size={14} />
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '2rem' }}>
              <EmptyState title="Tidak ada data pengguna admin." />
            </div>
          )}
        </DataTableCard>
      </div>
    </div>
  )
}
