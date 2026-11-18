import { useMutation } from '@tanstack/react-query'
import {
  CheckSquare,
  Edit3,
  Key,
  Plus,
  Save,
  Shield,
  ShieldCheck,
  Square,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
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
import { usersApi } from '@/features/users/api/users.api'
import { rolesQueryKey, usersQueryKey, useRoles, useUsers } from '@/features/users/hooks/use-users'
import type { AdminUser, RoleItem } from '@/features/users/types/user.types'
import { formatDate } from '@/lib/formatters'

interface PermissionModule {
  module: string
  label: string
  description: string
  actions: { key: string; label: string }[]
}

const PERMISSION_MODULES: PermissionModule[] = [
  {
    module: 'dashboard',
    label: 'Dashboard',
    description: 'Ringkasan statistik jaringan, trafik, dan iklan aktif',
    actions: [{ key: 'dashboard:view', label: 'Lihat' }],
  },
  {
    module: 'routers',
    label: 'Router',
    description: 'Kelola perangkat router dan generator script MikroTik',
    actions: [
      { key: 'routers:view', label: 'Lihat' },
      { key: 'routers:create', label: 'Tambah' },
      { key: 'routers:edit', label: 'Ubah' },
      { key: 'routers:delete', label: 'Hapus' },
    ],
  },
  {
    module: 'profiles',
    label: 'Profil Paket',
    description: 'Atur batas kecepatan internet dan durasi sesi pengguna',
    actions: [
      { key: 'profiles:view', label: 'Lihat' },
      { key: 'profiles:create', label: 'Tambah' },
      { key: 'profiles:edit', label: 'Ubah' },
      { key: 'profiles:delete', label: 'Hapus' },
    ],
  },
  {
    module: 'advertisements',
    label: 'Iklan Default',
    description: 'Kelola materi gambar dan video iklan bawaan',
    actions: [
      { key: 'advertisements:view', label: 'Lihat' },
      { key: 'advertisements:create', label: 'Tambah' },
      { key: 'advertisements:edit', label: 'Ubah' },
      { key: 'advertisements:delete', label: 'Hapus' },
    ],
  },
  {
    module: 'marketplace',
    label: 'Pengiklan',
    description: 'Kelola akun pengiklan, moderasi iklan klien, dan verifikasi Top-Up',
    actions: [
      { key: 'marketplace:view', label: 'Lihat' },
      { key: 'marketplace:moderate', label: 'Setujui / Tolak' },
    ],
  },
  {
    module: 'partners',
    label: 'Mitra Lokasi',
    description: 'Kelola akun mitra pemilik lokasi, porsi bagi hasil, dan pencairan dana',
    actions: [
      { key: 'partners:view', label: 'Lihat' },
      { key: 'partners:manage', label: 'Kelola & Pencairan' },
    ],
  },
  {
    module: 'finance',
    label: 'Keuangan & Tarif',
    description: 'Laporan pendapatan platform, parameter rank otomatis, dan rekening pembayaran',
    actions: [
      { key: 'finance:view', label: 'Lihat Laporan' },
      { key: 'marketplace:settings', label: 'Atur Tarif & Rank' },
    ],
  },
  {
    module: 'vouchers',
    label: 'Voucher',
    description: 'Atur format kode voucher dan riwayat penggunaan',
    actions: [
      { key: 'vouchers:view', label: 'Lihat' },
      { key: 'vouchers:create', label: 'Tambah' },
      { key: 'vouchers:edit', label: 'Ubah' },
      { key: 'vouchers:delete', label: 'Hapus' },
    ],
  },
  {
    module: 'visitors',
    label: 'Pengunjung',
    description: 'Lihat daftar perangkat terhubung, pemakaian data, dan kontak pengunjung',
    actions: [
      { key: 'visitors:view', label: 'Lihat' },
      { key: 'visitors:delete', label: 'Hapus' },
    ],
  },
  {
    module: 'rbac',
    label: 'Pengguna & Akses',
    description: 'Kelola akun pengelola dashboard, role, dan pembagian hak akses',
    actions: [
      { key: 'users:view', label: 'Lihat Pengguna' },
      { key: 'users:create', label: 'Tambah Pengguna' },
      { key: 'users:edit', label: 'Ubah Pengguna' },
      { key: 'users:delete', label: 'Hapus Pengguna' },
      { key: 'roles:view', label: 'Lihat Role' },
      { key: 'roles:create', label: 'Tambah Role' },
      { key: 'roles:edit', label: 'Ubah Role' },
      { key: 'roles:delete', label: 'Hapus Role' },
    ],
  },
]

const ALL_PERMISSION_KEYS = PERMISSION_MODULES.flatMap((m) => m.actions.map((a) => a.key))

export function UsersPage() {
  const { data: users = [], isPending: isUsersLoading, error: usersError } = useUsers()
  const { data: roles = [], isPending: isRolesLoading } = useRoles()

  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users')
  const [search, setSearch] = useState('')

  // User modals state
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [changingPasswordUser, setChangingPasswordUser] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState('')

  // Role modal state
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null)
  const [roleCode, setRoleCode] = useState('')
  const [roleDisplayName, setRoleDisplayName] = useState('')
  const [roleDescription, setRoleDescription] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])

  // User mutations
  const createUserMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      toast.success('Pengguna berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: usersQueryKey })
      queryClient.invalidateQueries({ queryKey: rolesQueryKey })
      setShowCreateUser(false)
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal menambahkan pengguna'),
  })

  const updateUserMutation = useMutation({
    mutationFn: usersApi.update,
    onSuccess: () => {
      toast.success('Data pengguna berhasil diperbarui')
      queryClient.invalidateQueries({ queryKey: usersQueryKey })
      queryClient.invalidateQueries({ queryKey: rolesQueryKey })
      setEditingUser(null)
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal memperbarui pengguna'),
  })

  const passwordMutation = useMutation({
    mutationFn: usersApi.changePassword,
    onSuccess: () => {
      toast.success('Kata sandi pengguna berhasil diubah')
      setChangingPasswordUser(null)
      setNewPassword('')
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal mengubah kata sandi'),
  })

  const deleteUserMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      toast.success('Pengguna berhasil dihapus')
      queryClient.invalidateQueries({ queryKey: usersQueryKey })
      queryClient.invalidateQueries({ queryKey: rolesQueryKey })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal menghapus pengguna'),
  })

  // Role mutations
  const createRoleMutation = useMutation({
    mutationFn: usersApi.createRole,
    onSuccess: () => {
      toast.success('Role baru berhasil dibuat')
      queryClient.invalidateQueries({ queryKey: rolesQueryKey })
      setShowRoleModal(false)
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal membuat role'),
  })

  const updateRoleMutation = useMutation({
    mutationFn: usersApi.updateRole,
    onSuccess: () => {
      toast.success('Role dan hak akses berhasil diperbarui')
      queryClient.invalidateQueries({ queryKey: rolesQueryKey })
      queryClient.invalidateQueries({ queryKey: usersQueryKey })
      setShowRoleModal(false)
      setEditingRole(null)
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal memperbarui role'),
  })

  const deleteRoleMutation = useMutation({
    mutationFn: usersApi.deleteRole,
    onSuccess: () => {
      toast.success('Role berhasil dihapus')
      queryClient.invalidateQueries({ queryKey: rolesQueryKey })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal menghapus role'),
  })

  if (isUsersLoading || isRolesLoading) return <LoadingState />
  if (usersError) return <ErrorState message="Gagal memuat data pengguna dan role." />

  const openCreateRoleModal = () => {
    setEditingRole(null)
    setRoleCode('')
    setRoleDisplayName('')
    setRoleDescription('')
    setSelectedPermissions(['dashboard:view', 'visitors:view'])
    setShowRoleModal(true)
  }

  const openEditRoleModal = (role: RoleItem) => {
    setEditingRole(role)
    setRoleCode(role.name)
    setRoleDisplayName(role.display_name)
    setRoleDescription(role.description)
    setSelectedPermissions(role.permissions || [])
    setShowRoleModal(true)
  }

  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const toggleModuleAll = (mod: PermissionModule) => {
    const modKeys = mod.actions.map((a) => a.key)
    const allSelected = modKeys.every((k) => selectedPermissions.includes(k))
    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((k) => !modKeys.includes(k)))
    } else {
      setSelectedPermissions((prev) => Array.from(new Set([...prev, ...modKeys])))
    }
  }

  const handleRoleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingRole) {
      updateRoleMutation.mutate({
        id: editingRole.id,
        data: {
          display_name: roleDisplayName.trim(),
          description: roleDescription.trim(),
          permissions: selectedPermissions,
        },
      })
    } else {
      createRoleMutation.mutate({
        name: roleCode.trim().toLowerCase().replace(/\s+/g, '_'),
        display_name: roleDisplayName.trim(),
        description: roleDescription.trim(),
        permissions: selectedPermissions,
      })
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase()
    return (
      u.username.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    )
  })

  const activeAdmins = users.filter((u) => u.is_active).length

  return (
    <div>
      <WavyHeader
        title="Pengguna & Hak Akses"
        actions={
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setActiveTab('roles')
                openCreateRoleModal()
              }}
            >
              <Shield size={17} />
              Buat Role
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setActiveTab('users')
                setShowCreateUser(true)
              }}
            >
              <UserPlus size={18} />
              Tambah Pengguna
            </button>
          </div>
        }
      />

      <div className="stitch-page-stage">
        {/* KPI Summary */}
        <KpiGrid columns={3}>
          <KpiCard
            label="Total Pengguna"
            value={users.length}
            icon={Users}
            subtext="Akun pengelola terdaftar"
          />

          <KpiCard
            label="Pengguna Aktif"
            value={activeAdmins}
            icon={ShieldCheck}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext="Dapat mengakses dashboard"
          />

          <KpiCard
            label="Total Role"
            value={roles.length}
            icon={Shield}
            iconBoxVariant="secondary"
            subtext="Kelompok hak akses"
          />
        </KpiGrid>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            background: '#ffffff',
            padding: '0.45rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            width: 'fit-content',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.2rem',
              borderRadius: '9px',
              border: 'none',
              background: activeTab === 'users' ? '#2563eb' : 'transparent',
              color: activeTab === 'users' ? '#ffffff' : '#475569',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Users size={16} />
            Daftar Pengguna ({users.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.2rem',
              borderRadius: '9px',
              border: 'none',
              background: activeTab === 'roles' ? '#2563eb' : 'transparent',
              color: activeTab === 'roles' ? '#ffffff' : '#475569',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Shield size={16} />
            Daftar Role ({roles.length})
          </button>
        </div>

        {/* ==================== TAB 1: USERS TABLE ==================== */}
        {activeTab === 'users' && (
          <DataTableCard
            title="Daftar Akun Pengguna"
            icon={Users}
            toolbarActions={
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                <SearchInput
                  placeholder="Cari nama, username, atau role..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '240px' }}
                />
              </div>
            }
          >
            {filteredUsers.length ? (
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Nama &amp; Username</th>
                      <th>Role</th>
                      <th>Hak Akses</th>
                      <th>Status</th>
                      <th>Login Terakhir</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const permCount = u.permissions?.length || 0
                      return (
                        <tr key={u.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <div className="user-avatar-circle">
                                {(u.name || u.username).substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <strong style={{ fontSize: '14px', color: '#0b1c30' }}>{u.name}</strong>
                                <br />
                                <small style={{ fontFamily: 'monospace', color: '#64748b' }}>@{u.username}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <StatusPill variant="premium" style={{ width: 'fit-content' }}>
                              {u.role_display_name || u.role}
                            </StatusPill>
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#1e3a8a',
                                background: '#eff6ff',
                                padding: '3px 9px',
                                borderRadius: '6px',
                                border: '1px solid #dbeafe',
                              }}
                            >
                              {permCount} Akses
                            </span>
                          </td>
                          <td>
                            {u.is_active ? (
                              <StatusPill variant="active" dot>Aktif</StatusPill>
                            ) : (
                              <StatusPill variant="expired">Nonaktif</StatusPill>
                            )}
                          </td>
                          <td>{formatDate(u.last_login_at)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '0.4rem 0.7rem', fontSize: '12px' }}
                                onClick={() => setEditingUser(u)}
                              >
                                <Edit3 size={13} />
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '0.4rem 0.7rem', fontSize: '12px' }}
                                onClick={() => setChangingPasswordUser(u)}
                              >
                                <Key size={13} />
                                Sandi
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger"
                                style={{ padding: '0.4rem 0.7rem', fontSize: '12px' }}
                                onClick={() => {
                                  if (window.confirm(`Yakin ingin menghapus pengguna "${u.name || u.username}"?`)) {
                                    deleteUserMutation.mutate(u.id)
                                  }
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '2rem' }}>
                <EmptyState title="Belum ada pengguna terdaftar." />
              </div>
            )}
          </DataTableCard>
        )}

        {/* ==================== TAB 2: ROLES & PERMISSIONS ==================== */}
        {activeTab === 'roles' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {roles.map((r) => (
              <div
                key={r.id}
                className="stitch-card-container"
                style={{
                  background: '#ffffff',
                  padding: '1.35rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                          {r.display_name}
                        </h3>
                        {r.is_system && (
                          <span style={{ fontSize: '10px', fontWeight: 700, background: '#e0e7ff', color: '#1d4ed8', padding: '2px 7px', borderRadius: '999px' }}>
                            Bawaan
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {r.users_count} pengguna
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '12px' }}
                        onClick={() => openEditRoleModal(r)}
                      >
                        <Edit3 size={13} />
                        Atur Akses
                      </button>
                      {!r.is_system && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '0.4rem 0.65rem', fontSize: '12px' }}
                          onClick={() => {
                            if (window.confirm(`Hapus role "${r.display_name}"?`)) {
                              deleteRoleMutation.mutate(r.id)
                            }
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: '12px', color: '#475569', margin: '0.65rem 0', lineHeight: 1.5 }}>
                    {r.description || 'Tidak ada keterangan tambahan.'}
                  </p>

                  {/* Permission Summary Badges per Module */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.75rem' }}>
                    {PERMISSION_MODULES.map((mod) => {
                      const activeActions = mod.actions.filter((a) => r.permissions.includes(a.key))
                      if (activeActions.length === 0) return null
                      return (
                        <span
                          key={mod.module}
                          style={{
                            fontSize: '11px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            color: '#0f172a',
                          }}
                        >
                          <strong>{mod.label}:</strong>{' '}
                          {activeActions.map((a) => a.label).join(', ')}
                        </span>
                      )
                    })}
                  </div>
                </div>

                <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                  <span><strong>{r.permissions.length}</strong> dari {ALL_PERMISSION_KEYS.length} akses aktif</span>
                  <span>Diperbarui: {formatDate(r.updated_at)}</span>
                </div>
              </div>
            ))}

            {/* Card to Add New Role */}
            <button
              type="button"
              onClick={openCreateRoleModal}
              style={{
                borderRadius: '16px',
                border: '2px dashed #93c5fd',
                background: '#f8fbff',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                color: '#1d4ed8',
                cursor: 'pointer',
                minHeight: '220px',
              }}
            >
              <Plus size={28} />
              <strong style={{ fontSize: '14px' }}>+ Buat Role Baru</strong>
              <span style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', maxWidth: '260px' }}>
                Tambahkan kelompok role baru dan sesuaikan hak akses setiap menu.
              </span>
            </button>
          </div>
        )}

        {/* ==================== MODAL: CREATE / EDIT ROLE & PERMISSIONS ==================== */}
        {showRoleModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11, 28, 48, 0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowRoleModal(false)
            }}
          >
            <div
              className="stitch-card-container"
              style={{
                width: '100%',
                maxWidth: '820px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '16px',
                background: '#ffffff',
                overflow: 'hidden',
              }}
            >
              <div className="table-toolbar" style={{ background: '#eff6ff', borderBottom: '1px solid #dbeafe' }}>
                <div className="table-toolbar-title">
                  <Shield size={20} color="#1d4ed8" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>
                      {editingRole ? `Atur Role: ${editingRole.display_name}` : 'Buat Role Baru'}
                    </h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Pilih hak akses yang diizinkan untuk setiap menu di bawah ini
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem' }}
                  onClick={() => setShowRoleModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={handleRoleFormSubmit}
                style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="form-field">
                    <label>Nama Role</label>
                    <input
                      value={roleDisplayName}
                      onChange={(e) => setRoleDisplayName(e.target.value)}
                      placeholder="Contoh: Tim Keuangan / Auditor"
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>Kode Role</label>
                    <input
                      value={roleCode}
                      onChange={(e) => setRoleCode(e.target.value)}
                      placeholder="Contoh: auditor"
                      disabled={Boolean(editingRole)}
                      required
                      style={{ fontFamily: 'monospace', background: editingRole ? '#f1f5f9' : '#fff' }}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label>Keterangan Role</label>
                  <input
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    placeholder="Keterangan singkat tugas role ini..."
                  />
                </div>

                {/* Permission Matrix Table */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                      Daftar Hak Akses Menu ({selectedPermissions.length} dipilih)
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPermissions(ALL_PERMISSION_KEYS)}
                        style={{ border: 'none', background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        Pilih Semua
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPermissions([])}
                        style={{ border: 'none', background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        Kosongkan
                      </button>
                    </div>
                  </div>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                    {PERMISSION_MODULES.map((mod, idx) => {
                      const modKeys = mod.actions.map((a) => a.key)
                      const allChecked = modKeys.every((k) => selectedPermissions.includes(k))
                      return (
                        <div
                          key={mod.module}
                          style={{
                            padding: '0.9rem 1rem',
                            background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                            borderBottom: idx < PERMISSION_MODULES.length - 1 ? '1px solid #e2e8f0' : 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.6rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                            <div>
                              <strong style={{ fontSize: '13px', color: '#0f172a' }}>{mod.label}</strong>
                              <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>{mod.description}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleModuleAll(mod)}
                              style={{
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#334155',
                              }}
                            >
                              {allChecked ? 'Hapus Pilihan' : 'Pilih Semua'}
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {mod.actions.map((act) => {
                              const checked = selectedPermissions.includes(act.key)
                              return (
                                <button
                                  key={act.key}
                                  type="button"
                                  onClick={() => togglePermission(act.key)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: '8px',
                                    border: checked ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                                    background: checked ? '#eff6ff' : '#ffffff',
                                    color: checked ? '#1d4ed8' : '#475569',
                                    fontSize: '12px',
                                    fontWeight: checked ? 700 : 500,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {checked ? <CheckSquare size={14} /> : <Square size={14} />}
                                  {act.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowRoleModal(false)}>
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                  >
                    <Save size={16} />
                    {editingRole ? 'Simpan Perubahan' : 'Buat Role'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================== MODAL: CREATE USER ==================== */}
        {showCreateUser && (
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
              if (e.target === e.currentTarget) setShowCreateUser(false)
            }}
          >
            <div className="stitch-card-container" style={{ width: '100%', maxWidth: '640px', borderRadius: '16px', background: '#ffffff', overflow: 'hidden' }}>
              <div className="table-toolbar" style={{ background: '#eff6ff', borderBottom: '1px solid #e2e8f0' }}>
                <div className="table-toolbar-title">
                  <UserPlus size={18} color="#1d4ed8" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#0b1c30' }}>Tambah Pengguna Baru</h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Buat akun pengelola dan pilih role aksesnya</span>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={() => setShowCreateUser(false)}>
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const f = new FormData(e.currentTarget)
                  createUserMutation.mutate({
                    username: String(f.get('username') || ''),
                    password: String(f.get('password') || ''),
                    name: String(f.get('name') || ''),
                    role: String(f.get('role') || 'admin'),
                    is_active: true,
                  })
                }}
                style={{ padding: '1.5rem', display: 'grid', gap: '1.15rem' }}
              >
                <div className="field-grid">
                  <div className="form-field">
                    <label>Username</label>
                    <input name="username" required placeholder="Contoh: ryan_admin" />
                  </div>
                  <div className="form-field">
                    <label>Nama Lengkap</label>
                    <input name="name" required placeholder="Contoh: Ryan Hidayat" />
                  </div>
                  <div className="form-field">
                    <label>Kata Sandi</label>
                    <input name="password" type="password" required minLength={6} placeholder="Minimal 6 karakter" />
                  </div>
                  <div className="form-field">
                    <label>Pilih Role</label>
                    <select name="role" defaultValue={roles[0]?.name || 'admin'}>
                      {roles.map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.display_name} ({r.permissions.length} akses)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateUser(false)}>
                    Batal
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={createUserMutation.isPending}>
                    <Save size={16} />
                    {createUserMutation.isPending ? 'Menyimpan...' : 'Simpan Pengguna'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================== MODAL: EDIT USER ==================== */}
        {editingUser && (
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
              if (e.target === e.currentTarget) setEditingUser(null)
            }}
          >
            <div className="stitch-card-container" style={{ width: '100%', maxWidth: '540px', borderRadius: '16px', background: '#ffffff', overflow: 'hidden' }}>
              <div className="table-toolbar" style={{ background: '#eff6ff', borderBottom: '1px solid #e2e8f0' }}>
                <div className="table-toolbar-title">
                  <Edit3 size={18} color="#1d4ed8" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#0b1c30' }}>Edit Pengguna</h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>@{editingUser.username}</span>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={() => setEditingUser(null)}>
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const f = new FormData(e.currentTarget)
                  updateUserMutation.mutate({
                    id: editingUser.id,
                    data: {
                      name: String(f.get('name') || ''),
                      role: String(f.get('role') || editingUser.role),
                      is_active: f.get('is_active') === 'true',
                    },
                  })
                }}
                style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}
              >
                <div className="form-field">
                  <label>Nama Lengkap</label>
                  <input name="name" defaultValue={editingUser.name} required />
                </div>

                <div className="form-field">
                  <label>Role</label>
                  <select name="role" defaultValue={editingUser.role}>
                    {roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.display_name} ({r.permissions.length} akses)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Status Akun</label>
                  <select name="is_active" defaultValue={String(editingUser.is_active)}>
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>
                    Batal
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={updateUserMutation.isPending}>
                    <Save size={16} />
                    {updateUserMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================== MODAL: CHANGE PASSWORD ==================== */}
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
            <div className="stitch-card-container" style={{ width: '100%', maxWidth: '480px', borderRadius: '16px', background: '#ffffff', overflow: 'hidden' }}>
              <div className="table-toolbar" style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                <div className="table-toolbar-title">
                  <Key size={18} color="#d97706" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#92400e' }}>Ubah Kata Sandi</h3>
                    <span style={{ fontSize: '12px', color: '#b45309' }}>
                      {changingPasswordUser.name} (@{changingPasswordUser.username})
                    </span>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={() => setChangingPasswordUser(null)}>
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!newPassword) return
                  passwordMutation.mutate({
                    id: changingPasswordUser.id,
                    data: { password: newPassword },
                  })
                }}
                style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}
              >
                <div className="form-field">
                  <label>Kata Sandi Baru</label>
                  <input
                    type="password"
                    placeholder="Minimal 6 karakter"
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setChangingPasswordUser(null)}>
                    Batal
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={passwordMutation.isPending}>
                    <Save size={16} />
                    Simpan Kata Sandi
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
