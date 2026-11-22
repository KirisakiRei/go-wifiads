import { useMutation } from '@tanstack/react-query'
import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronUp,
  Download,
  FastForward,
  Gauge,
  Layers,
  Pencil,
  Plus,
  PlusCircle,
  Router,
  Save,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  Wifi,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { ErrorState, LoadingState } from '@/components/feedback/query-state'
import {
  KpiCard,
  KpiGrid,
  PolicyCard,
  PresetInput,
  StatusPill,
  WavyHeader,
} from '@/components/ui'
import { formatBytes, formatDuration } from '@/lib/formatters'
import { profilesApi } from '@/features/profiles/api/profiles.api'
import { profilesQueryKey, useProfiles } from '@/features/profiles/hooks/use-profiles'
import type { ConnectProfile, UpdateProfilePayload } from '@/features/profiles/types/profile.types'
import { routersApi } from '@/features/routers/routers.api'
import type { UpdateRouterVoucherConfigInput } from '@/features/routers/types'
import { useRouters } from '@/features/routers/use-routers'

function formatBw(kbps: number): string {
  if (!kbps || kbps <= 0) return 'Tanpa Batas'
  if (kbps >= 1024) {
    const mb = kbps / 1024
    return `${mb % 1 === 0 ? mb : mb.toFixed(1)} Mbps`
  }
  return `${kbps} Kbps`
}

function liveDescDuration(sec: number): string {
  if (!sec || sec <= 0) return 'Tanpa Batas'
  const hours = Math.floor(sec / 3600)
  const mins = Math.floor((sec % 3600) / 60)
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} Jam`)
  if (mins > 0) parts.push(`${mins} Menit`)
  if (parts.length === 0) parts.push(`${sec} Detik`)
  return parts.join(' ')
}

const BW_DOWN_PRESETS = [
  { label: '512 Kbps', val: 512 },
  { label: '1 Mbps', val: 1024 },
  { label: '2 Mbps', val: 2048 },
  { label: '5 Mbps', val: 5120 },
  { label: '10 Mbps', val: 10240 },
]

const BW_UP_PRESETS = [
  { label: '256 Kbps', val: 256 },
  { label: '512 Kbps', val: 512 },
  { label: '1 Mbps', val: 1024 },
  { label: '2 Mbps', val: 2048 },
]

const DURATION_PRESETS = [
  { label: '30 Menit', val: 1800 },
  { label: '1 Jam', val: 3600 },
  { label: '2 Jam', val: 7200 },
  { label: '6 Jam', val: 21600 },
  { label: '24 Jam', val: 86400 },
]

interface ProfileEditState {
  displayName: string
  description: string
  downKbps: number
  upKbps: number
  timeoutSeconds: number
  quotaMB: string
  sharedUsers: number
  isActive: boolean
}

interface ProfileEditFormProps {
  profile: ConnectProfile
  onToggle: () => void
  onSave: (payload: UpdateProfilePayload) => void
  isSaving: boolean
}

function ProfileInlineEditor({
  profile,
  onToggle,
  onSave,
  isSaving,
}: ProfileEditFormProps) {
  const [form, setForm] = useState<ProfileEditState>({
    displayName: profile.display_name,
    description: profile.description || '',
    downKbps: profile.bandwidth_down_kbps,
    upKbps: profile.bandwidth_up_kbps,
    timeoutSeconds: profile.session_timeout_seconds,
    quotaMB: profile.quota_bytes && profile.quota_bytes > 0 ? String(Math.round(profile.quota_bytes / (1024 * 1024))) : '',
    sharedUsers: profile.shared_users || 1,
    isActive: profile.is_active,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const quotaMbNum = Number(form.quotaMB)
    onSave({
      display_name: form.displayName,
      description: form.description,
      bandwidth_down_kbps: Number(form.downKbps),
      bandwidth_up_kbps: Number(form.upKbps),
      session_timeout_seconds: Number(form.timeoutSeconds),
      quota_bytes: quotaMbNum > 0 ? Math.round(quotaMbNum * 1024 * 1024) : 0,
      shared_users: Math.max(1, Number(form.sharedUsers) || 1),
      is_default: profile.is_default,
      is_active: form.isActive,
    })
  }

  return (
    <div style={{ padding: '1.75rem', background: '#fafcff' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
          paddingBottom: '0.85rem',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#eff6ff',
              color: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Pencil size={16} />
          </div>
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0b1c30', margin: 0 }}>
              Edit Paket: {profile.display_name}
            </h4>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Kode: <code>{profile.name}</code>
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
        <div className="form-grid-2col">
          {/* LEFT COLUMN */}
          <div style={{ display: 'grid', gap: '1.25rem', alignContent: 'start' }}>
            <div className="form-field">
              <label>Nama Paket</label>
              <input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Contoh: Paket Cepat 5 Mbps"
                required
              />
            </div>

            <div className="form-field">
              <label>Keterangan</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Contoh: Kecepatan standar untuk pengguna umum"
              />
            </div>

            <div className="form-field">
              <label className="no-between">Status Paket</label>
              <PolicyCard
                title="Aktifkan Paket Ini"
                description="Paket yang aktif dapat dipilih pada pengaturan router."
                checked={form.isActive}
                onChange={(checked) => setForm({ ...form, isActive: checked })}
              />
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'grid', gap: '1.25rem', alignContent: 'start' }}>
            <PresetInput
              label="Batas Kecepatan Unduh (Kbps)"
              icon={Download}
              iconColor="#065f46"
              value={form.downKbps}
              onChange={(downKbps) => setForm({ ...form, downKbps })}
              badgeText={formatBw(form.downKbps)}
              min={128}
              max={102400}
              presets={BW_DOWN_PRESETS}
              required
            />

            <PresetInput
              label="Batas Kecepatan Unggah (Kbps)"
              icon={Upload}
              iconColor="#0369a1"
              value={form.upKbps}
              onChange={(upKbps) => setForm({ ...form, upKbps })}
              badgeText={formatBw(form.upKbps)}
              min={128}
              max={51200}
              presets={BW_UP_PRESETS}
              required
            />

            <PresetInput
              label="Durasi Sesi (Detik)"
              icon={Timer}
              value={form.timeoutSeconds}
              onChange={(timeoutSeconds) => setForm({ ...form, timeoutSeconds })}
              badgeText={liveDescDuration(form.timeoutSeconds)}
              min={60}
              max={604800}
              presets={DURATION_PRESETS}
              required
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-field">
                <label>Kuota Data (MB)</label>
                <input
                  type="number"
                  min={0}
                  value={form.quotaMB}
                  onChange={(e) => setForm({ ...form, quotaMB: e.target.value })}
                  placeholder="Kosong = Unlimited"
                />
              </div>
              <div className="form-field">
                <label>Shared Users</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.sharedUsers}
                  onChange={(e) => setForm({ ...form, sharedUsers: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e2e8f0',
            alignItems: 'center',
          }}
        >
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            <Save size={16} />
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onToggle}>
            Batal
          </button>
        </div>
      </form>
    </div>
  )
}

function RouterMethodAssignmentCard({ profiles }: { profiles: ConnectProfile[] }) {
  const { data: routers = [], isLoading: isLoadingRouters } = useRouters()
  const [selectedRouterId, setSelectedRouterId] = useState<string>('')
  const [skipProfileId, setSkipProfileId] = useState<string>('')
  const [surveyProfileId, setSurveyProfileId] = useState<string>('')

  useEffect(() => {
    if (routers.length > 0 && !selectedRouterId) {
      setSelectedRouterId(routers[0].id)
    }
  }, [routers, selectedRouterId])

  const currentRouter = useMemo(
    () => routers.find((r) => r.id === selectedRouterId) || routers[0],
    [routers, selectedRouterId]
  )

  useEffect(() => {
    if (currentRouter) {
      if (currentRouter.default_profile_id) {
        setSkipProfileId(currentRouter.default_profile_id)
      } else if (profiles.length > 0) {
        const def = profiles.find((p) => p.is_default) || profiles[0]
        if (def) setSkipProfileId(def.id)
      }

      if (currentRouter.survey_profile_id) {
        setSurveyProfileId(currentRouter.survey_profile_id)
      } else if (profiles.length > 0) {
        const surveyProf = profiles.find((p) => !p.is_default && p.is_active) || profiles[profiles.length - 1]
        if (surveyProf) setSurveyProfileId(surveyProf.id)
      }
    }
  }, [currentRouter, profiles])

  const activeProfiles = useMemo(() => profiles.filter((p) => p.is_active), [profiles])

  const selectedSkipProfile = useMemo(
    () => profiles.find((p) => p.id === skipProfileId),
    [profiles, skipProfileId]
  )

  const selectedSurveyProfile = useMemo(
    () => profiles.find((p) => p.id === surveyProfileId),
    [profiles, surveyProfileId]
  )

  const updateMutation = useMutation({
    mutationFn: (input: UpdateRouterVoucherConfigInput) =>
      routersApi.updateVoucherConfig(selectedRouterId, input),
    onSuccess: () => {
      toast.success('Pengaturan paket router berhasil disimpan')
      queryClient.invalidateQueries({ queryKey: ['routers'] })
    },
    onError: (err: Error) => {
      toast.error('Gagal menyimpan pengaturan paket', {
        description: err.message,
      })
    },
  })

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRouterId) {
      toast.error('Pilih router terlebih dahulu')
      return
    }
    if (!currentRouter) return

    updateMutation.mutate({
      voucher_prefix: currentRouter.voucher_prefix || 'MK1-',
      voucher_digit_count: currentRouter.voucher_digit_count || 6,
      voucher_numeric_only: currentRouter.voucher_numeric_only ?? true,
      default_profile_id: skipProfileId || undefined,
      survey_profile_id: surveyProfileId || undefined,
      voucher_ttl_seconds: currentRouter.voucher_ttl_seconds || 86400,
      session_timeout_seconds: currentRouter.session_timeout_seconds || 3600,
    })
  }

  if (isLoadingRouters) {
    return (
      <div className="stitch-card-container" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.75rem' }}>
        <span style={{ fontSize: '13px', color: '#64748b' }}>Memuat pengaturan router...</span>
      </div>
    )
  }

  return (
    <div className="stitch-card-container" style={{ marginBottom: '2rem' }}>
      <div
        className="table-toolbar"
        style={{
          padding: '1.25rem 1.5rem',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div className="table-toolbar-title" style={{ gap: '0.85rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#eff6ff',
              color: '#0037b0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #dbeafe',
            }}
          >
            <Router size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0b1c30' }}>
              Pengaturan Paket per Router
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0.15rem 0 0 0' }}>
              Tentukan paket internet yang diberikan saat pengunjung melewati form kontak atau mengisi form kontak.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSavePolicy} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#fafcff' }}>
        {/* Router Selector */}
        <div style={{ background: '#ffffff', padding: '1.15rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.65rem' }}>
            <label
              htmlFor="select-policy-router"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                margin: 0,
              }}
            >
              <Router size={16} color="#0037b0" />
              Pilih Router
            </label>
          </div>

          {routers.length === 0 ? (
            <div style={{ padding: '0.85rem 1rem', borderRadius: '8px', background: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239', fontSize: '12px' }}>
              Belum ada router yang terdaftar.
            </div>
          ) : (
            <select
              id="select-policy-router"
              value={selectedRouterId}
              onChange={(e) => setSelectedRouterId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                fontWeight: 600,
                color: '#0f172a',
                background: '#ffffff',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {routers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.nas_identifier})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 2-Method Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {/* METHOD 1: SKIP SURVEY */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#f1f5f9',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FastForward size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#0b1c30' }}>
                  Tanpa Isi Kontak
                </h4>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Saat pengunjung memilih langsung terhubung
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                Paket Internet:
              </label>
              <select
                value={skipProfileId}
                onChange={(e) => setSkipProfileId(e.target.value)}
                style={{
                  padding: '0.7rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0f172a',
                  background: '#ffffff',
                }}
              >
                {activeProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} — ↓ {formatBw(p.bandwidth_down_kbps)} / ↑ {formatBw(p.bandwidth_up_kbps)} • {liveDescDuration(p.session_timeout_seconds)}
                  </option>
                ))}
              </select>
            </div>

            {selectedSkipProfile && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#475569',
                }}
              >
                <span>Kecepatan: <strong>↓ {formatBw(selectedSkipProfile.bandwidth_down_kbps)}</strong></span>
                <span>Durasi: <strong>{liveDescDuration(selectedSkipProfile.session_timeout_seconds)}</strong></span>
              </div>
            )}
          </div>

          {/* METHOD 2: COMPLETED SURVEY */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '2px solid #bfdbfe',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 2px 8px rgba(29, 78, 216, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#1e3a8a' }}>
                  Mengisi Kontak
                </h4>
                <span style={{ fontSize: '11px', color: '#1d4ed8' }}>
                  Saat pengunjung mengisi email atau nomor WhatsApp
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                Paket Internet:
              </label>
              <select
                value={surveyProfileId}
                onChange={(e) => setSurveyProfileId(e.target.value)}
                style={{
                  padding: '0.7rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #93c5fd',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0f172a',
                  background: '#ffffff',
                }}
              >
                {activeProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} — ↓ {formatBw(p.bandwidth_down_kbps)} / ↑ {formatBw(p.bandwidth_up_kbps)} • {liveDescDuration(p.session_timeout_seconds)}
                  </option>
                ))}
              </select>
            </div>

            {selectedSurveyProfile && (
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#1e40af',
                }}
              >
                <span>Kecepatan: <strong>↓ {formatBw(selectedSurveyProfile.bandwidth_down_kbps)}</strong></span>
                <span>Durasi: <strong>{liveDescDuration(selectedSurveyProfile.session_timeout_seconds)}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Submit Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            paddingTop: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', color: '#64748b' }}>
            <CheckCircle2 size={16} color="#10b981" />
            <span>Paket otomatis diterapkan sesuai pilihan pengunjung di halaman portal.</span>
          </div>

          <button
            type="submit"
            disabled={updateMutation.isPending || !selectedRouterId}
            className="btn btn-primary"
            style={{ padding: '0.75rem 1.5rem', fontWeight: 700 }}
          >
            <Save size={16} />
            {updateMutation.isPending ? 'Menyimpan...' : 'Simpan Pengaturan Router'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function ProfilesPage() {
  const { data: profiles, isPending, error } = useProfiles()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const [createName, setCreateName] = useState('')
  const [createDisplayName, setCreateDisplayName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createDown, setCreateDown] = useState(5120)
  const [createUp, setCreateUp] = useState(2048)
  const [createTimeout, setCreateTimeout] = useState(7200)
  const [createQuotaMB, setCreateQuotaMB] = useState('')
  const [createSharedUsers, setCreateSharedUsers] = useState(1)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: profilesApi.create,
    onSuccess: () => {
      toast.success('Paket baru berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: profilesQueryKey })
      setShowCreate(false)
      setCreateName('')
      setCreateDisplayName('')
      setCreateDesc('')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Gagal menambahkan paket')
    },
  })

  const updateMutation = useMutation({
    mutationFn: profilesApi.update,
    onSuccess: () => {
      toast.success('Perubahan paket berhasil disimpan')
      queryClient.invalidateQueries({ queryKey: profilesQueryKey })
      setExpandedId(null)
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Gagal memperbarui paket')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: profilesApi.delete,
    onSuccess: () => {
      toast.success('Profil paket berhasil dihapus')
      queryClient.invalidateQueries({ queryKey: profilesQueryKey })
      setConfirmDeleteId(null)
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Gagal menghapus profil paket')
    },
  })

  if (isPending) return <LoadingState />
  if (error || !profiles) return <ErrorState message="Gagal memuat daftar paket internet." />

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const quotaMbNum = Number(createQuotaMB)
    createMutation.mutate({
      name: createName.trim().toLowerCase().replace(/\s+/g, '-'),
      display_name: createDisplayName,
      description: createDesc,
      bandwidth_down_kbps: Number(createDown) || 1024,
      bandwidth_up_kbps: Number(createUp) || 512,
      session_timeout_seconds: Number(createTimeout) || 3600,
      quota_bytes: quotaMbNum > 0 ? Math.round(quotaMbNum * 1024 * 1024) : 0,
      shared_users: Math.max(1, Number(createSharedUsers) || 1),
      is_default: false,
      is_active: true,
    })
  }

  const maxDown = profiles.length > 0 ? Math.max(...profiles.map((p) => p.bandwidth_down_kbps)) : 0

  return (
    <div>
      <WavyHeader
        title="Profil Paket Internet"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? <X size={18} /> : <Plus size={18} />}
            {showCreate ? 'Tutup Form' : 'Tambah Paket Baru'}
          </button>
        }
      />

      <div className="stitch-page-stage">
        {/* KPI Cards */}
        <KpiGrid columns={3}>
          <KpiCard
            label="Total Paket"
            value={profiles.length}
            icon={Layers}
            subtext="Paket internet tersedia"
          />

          <KpiCard
            label="Rata-rata Durasi"
            value={
              profiles.length > 0
                ? formatDuration(
                    Math.round(
                      profiles.reduce((acc, p) => acc + p.session_timeout_seconds, 0) /
                        profiles.length
                    )
                  )
                : '0m'
            }
            icon={Timer}
            iconBoxVariant="secondary"
            subtext="Batas waktu per sesi"
          />

          <KpiCard
            label="Kecepatan Tertinggi"
            value={formatBw(maxDown)}
            icon={Gauge}
            subtext="Batas unduh maksimal"
          />
        </KpiGrid>

        {/* SECTION 1: Router Method Assignment Card */}
        <RouterMethodAssignmentCard profiles={profiles} />

        {/* Modal Popup: Tambah Paket Baru */}
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
                maxWidth: '860px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
                borderRadius: '16px',
                border: '1px solid #bfdbfe',
                animation: 'fadeIn 0.15s ease-out',
              }}
            >
              <div className="table-toolbar" style={{ borderBottom: '1px solid #e2e8f0', background: '#eff6ff' }}>
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
                    <PlusCircle size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#0b1c30' }}>Tambah Paket Baru</h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Atur batas kecepatan dan durasi sesi internet
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

              <form onSubmit={handleCreateSubmit} style={{ padding: '1.75rem', display: 'grid', gap: '1.5rem', background: '#ffffff' }}>
                <div className="form-grid-2col">
                  <div style={{ display: 'grid', gap: '1.25rem', alignContent: 'start' }}>
                    <div className="form-field">
                      <label>Kode Paket</label>
                      <input
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        placeholder="Contoh: paket-10mbps"
                        required
                      />
                      <span className="helper-text">Gunakan huruf kecil tanpa spasi.</span>
                    </div>

                    <div className="form-field">
                      <label>Nama Paket</label>
                      <input
                        value={createDisplayName}
                        onChange={(e) => setCreateDisplayName(e.target.value)}
                        placeholder="Contoh: Paket Cepat 10 Mbps"
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>Keterangan</label>
                      <input
                        value={createDesc}
                        onChange={(e) => setCreateDesc(e.target.value)}
                        placeholder="Contoh: Kecepatan tinggi untuk pengisi kontak"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '1.25rem', alignContent: 'start' }}>
                    <PresetInput
                      label="Batas Kecepatan Unduh (Kbps)"
                      icon={Download}
                      iconColor="#065f46"
                      value={createDown}
                      onChange={setCreateDown}
                      badgeText={formatBw(createDown)}
                      presets={BW_DOWN_PRESETS}
                      min={0}
                      max={100000}
                    />

                    <PresetInput
                      label="Batas Kecepatan Unggah (Kbps)"
                      icon={Upload}
                      iconColor="#0369a1"
                      value={createUp}
                      onChange={setCreateUp}
                      badgeText={formatBw(createUp)}
                      presets={BW_UP_PRESETS}
                      min={0}
                      max={100000}
                    />

                    <PresetInput
                      label="Durasi Sesi (Detik)"
                      icon={Timer}
                      iconColor="#00668a"
                      value={createTimeout}
                      onChange={setCreateTimeout}
                      badgeText={liveDescDuration(createTimeout)}
                      presets={DURATION_PRESETS}
                      min={60}
                      max={604800}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-field">
                        <label>Kuota Data (MB)</label>
                        <input
                          type="number"
                          min={0}
                          value={createQuotaMB}
                          onChange={(e) => setCreateQuotaMB(e.target.value)}
                          placeholder="Kosong = Unlimited"
                        />
                      </div>
                      <div className="form-field">
                        <label>Shared Users</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={createSharedUsers}
                          onChange={(e) => setCreateSharedUsers(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCreate(false)}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={createMutation.isPending}
                  >
                    <Save size={16} />
                    {createMutation.isPending ? 'Menyimpan...' : 'Simpan Paket'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SECTION 2: Profiles Table */}
        <div className="stitch-card-container">
          <div className="table-toolbar">
            <div className="table-toolbar-title">
              <Layers size={20} style={{ color: '#1d4ed8' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '15px' }}>Daftar Paket Internet</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Pilihan paket kecepatan dan durasi yang dapat digunakan pada router
                </span>
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="stitch-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '240px' }}>Nama Paket</th>
                  <th>Batas Unduh</th>
                  <th>Batas Unggah</th>
                  <th>Durasi &amp; Kuota</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const isExpanded = expandedId === p.id
                  return (
                    <Fragment key={p.id}>
                      <tr
                        style={{
                          background: isExpanded ? '#f0f7ff' : undefined,
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Wifi size={18} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <strong style={{ fontSize: '14px', color: '#0b1c30' }}>
                                  {p.display_name}
                                </strong>
                                <code
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {p.name}
                                </code>
                              </div>
                              {p.description && (
                                <small style={{ color: '#64748b', fontSize: '12px' }}>
                                  {p.description}
                                </small>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#065f46' }}>
                            ↓ {formatBw(p.bandwidth_down_kbps)}
                          </span>
                        </td>

                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#0369a1' }}>
                            ↑ {formatBw(p.bandwidth_up_kbps)}
                          </span>
                        </td>

                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0b1c30' }}>
                              {liveDescDuration(p.session_timeout_seconds)}
                            </span>
                            <small style={{ fontSize: '11px', color: '#64748b' }}>
                              {p.quota_bytes && p.quota_bytes > 0 ? `Kuota ${formatBytes(p.quota_bytes)}` : 'Kuota Unlimited'}
                              {p.shared_users && p.shared_users > 1 ? ` • ${p.shared_users} perangkat` : ''}
                            </small>
                          </div>
                        </td>

                        <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {p.is_active ? (
                            <StatusPill variant="active" dot>Aktif</StatusPill>
                          ) : (
                            <StatusPill variant="expired">Nonaktif</StatusPill>
                          )}
                        </td>

                        <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{
                                padding: '0.4rem 0.85rem',
                                fontSize: '12px',
                                background: isExpanded ? '#1d4ed8' : '#eff6ff',
                                color: isExpanded ? '#ffffff' : '#1d4ed8',
                                borderColor: isExpanded ? '#1d4ed8' : '#bfdbfe',
                              }}
                              onClick={() => handleToggle(p.id)}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <Pencil size={14} />}
                              {isExpanded ? 'Tutup' : 'Edit'}
                            </button>
                            {confirmDeleteId === p.id ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  style={{ padding: '0.4rem 0.7rem', fontSize: '11px' }}
                                  disabled={deleteMutation.isPending}
                                  onClick={() => deleteMutation.mutate(p.id)}
                                >
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '0.4rem 0.6rem', fontSize: '11px' }}
                                  onClick={() => setConfirmDeleteId(null)}
                                >
                                  Batal
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{
                                  padding: '0.4rem 0.55rem',
                                  color: '#b91c1c',
                                  borderColor: '#fecaca',
                                  background: '#fef2f2',
                                }}
                                title="Hapus Profil"
                                onClick={() => setConfirmDeleteId(p.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0, borderBottom: '2px solid #1d4ed8' }}>
                            <ProfileInlineEditor
                              profile={p}
                              onToggle={() => handleToggle(p.id)}
                              onSave={(data) => updateMutation.mutate({ id: p.id, data })}
                              isSaving={updateMutation.isPending}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
