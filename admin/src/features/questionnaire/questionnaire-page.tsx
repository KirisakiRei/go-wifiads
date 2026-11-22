import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Download,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/query-state'
import {
  DataTableCard,
  Pagination,
  SearchInput,
  StatusPill,
  WavyHeader,
} from '@/components/ui'
import {
  questionnaireApi,
  type FieldType,
  type QuestionnaireField,
} from '@/features/questionnaire/questionnaire.api'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatDate } from '@/lib/formatters'

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'TEXT', label: 'Teks Singkat (TEXT)' },
  { value: 'EMAIL', label: 'Email (EMAIL)' },
  { value: 'PHONE', label: 'Nomor HP / WA (PHONE)' },
  { value: 'NUMBER', label: 'Angka (NUMBER)' },
  { value: 'SELECT', label: 'Pilihan Dropdown (SELECT)' },
  { value: 'TEXTAREA', label: 'Teks Panjang (TEXTAREA)' },
]

export function QuestionnairePage() {
  const qc = useQueryClient()
  const { query, searchParams, searchTerm, setSearchTerm } = useTableQuery(350)
  const [tab, setTab] = useState<'fields' | 'submissions'>('fields')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<QuestionnaireField | null>(null)

  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<FieldType>('TEXT')
  const [placeholder, setPlaceholder] = useState('')
  const [optionsText, setOptionsText] = useState('')
  const [required, setRequired] = useState(false)
  const [isActive, setIsActive] = useState(true)

  const { data: fields = [], isPending, error } = useQuery({
    queryKey: ['questionnaire-fields'],
    queryFn: questionnaireApi.listFields,
  })

  const { data: subData, isPending: subLoading } = useQuery({
    queryKey: ['questionnaire-submissions', query],
    queryFn: () => questionnaireApi.listSubmissions(query),
    enabled: tab === 'submissions',
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        key: key.trim(),
        label: label.trim(),
        type,
        placeholder: placeholder.trim(),
        options:
          type === 'SELECT'
            ? optionsText
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        required,
        sort_order: editing ? editing.sort_order : fields.length + 1,
        is_active: isActive,
      }
      return editing
        ? questionnaireApi.updateField(editing.id, payload)
        : questionnaireApi.createField(payload)
    },
    onSuccess: () => {
      toast.success(editing ? 'Field kuesioner diperbarui' : 'Field kuesioner ditambahkan')
      qc.invalidateQueries({ queryKey: ['questionnaire-fields'] })
      setShowModal(false)
      setEditing(null)
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal menyimpan field'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => questionnaireApi.deleteField(id),
    onSuccess: () => {
      toast.success('Field kuesioner dihapus')
      qc.invalidateQueries({ queryKey: ['questionnaire-fields'] })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal menghapus field'),
  })

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => questionnaireApi.reorderFields(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questionnaire-fields'] })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal mengubah urutan'),
  })

  const openCreate = () => {
    setEditing(null)
    setKey('')
    setLabel('')
    setType('TEXT')
    setPlaceholder('')
    setOptionsText('')
    setRequired(false)
    setIsActive(true)
    setShowModal(true)
  }

  const openEdit = (f: QuestionnaireField) => {
    setEditing(f)
    setKey(f.key)
    setLabel(f.label)
    setType(f.type)
    setPlaceholder(f.placeholder || '')
    setOptionsText((f.options || []).join(', '))
    setRequired(f.required)
    setIsActive(f.is_active)
    setShowModal(true)
  }

  const moveField = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= fields.length) return
    const next = [...fields]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    reorderMutation.mutate(next.map((f) => f.id))
  }

  if (isPending) return <LoadingState />
  if (error) return <ErrorState message="Gagal memuat konfigurasi kuesioner." />

  return (
    <div>
      <WavyHeader
        title="Kuesioner Dinamis Portal"
        actions={
          tab === 'fields' ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Plus size={16} />
              Tambah Pertanyaan
            </button>
          ) : (
            <a
              href="/api/v1/admin/questionnaire/submissions/export"
              className="btn btn-primary"
              style={{ textDecoration: 'none' }}
            >
              <Download size={15} />
              Export CSV
            </a>
          )
        }
      />

      <div className="stitch-page-stage">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            type="button"
            className={`btn ${tab === 'fields' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('fields')}
          >
            <ClipboardList size={15} />
            Konfigurasi Field ({fields.length})
          </button>
          <button
            type="button"
            className={`btn ${tab === 'submissions' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('submissions')}
          >
            Jawaban Pengunjung
          </button>
        </div>

        {tab === 'fields' ? (
          <DataTableCard title="Daftar Pertanyaan Captive Portal" icon={ClipboardList}>
            {fields.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <EmptyState title="Belum ada field kuesioner kustom." />
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '0.5rem' }}>
                  Saat kosong, Captive Portal otomatis menampilkan 2 input bawaan: <strong>Email</strong> dan <strong>Nomor WhatsApp / HP</strong>.
                </p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Urutan</th>
                      <th>Label &amp; Key</th>
                      <th>Tipe</th>
                      <th>Wajib</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((f, idx) => (
                      <tr key={f.id}>
                        <td>
                          <div style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.4rem' }}
                              disabled={idx === 0 || reorderMutation.isPending}
                              onClick={() => moveField(idx, -1)}
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.4rem' }}
                              disabled={idx === fields.length - 1 || reorderMutation.isPending}
                              onClick={() => moveField(idx, 1)}
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                        </td>
                        <td>
                          <strong style={{ color: '#0f172a', fontSize: '13px' }}>{f.label}</strong>
                          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                            {f.key} {f.options.length > 0 ? `• Opsi: ${f.options.join(', ')}` : ''}
                          </div>
                        </td>
                        <td><StatusPill variant="basic">{f.type}</StatusPill></td>
                        <td>{f.required ? 'Wajib' : 'Opsional'}</td>
                        <td>
                          <StatusPill variant={f.is_active ? 'active' : 'expired'}>
                            {f.is_active ? 'Aktif' : 'Nonaktif'}
                          </StatusPill>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '11px' }}
                              onClick={() => openEdit(f)}
                            >
                              <Pencil size={12} />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.55rem', color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2' }}
                              onClick={() => deleteMutation.mutate(f.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataTableCard>
        ) : (
          <DataTableCard
            title="Riwayat Jawaban Kuesioner Pengunjung"
            icon={ClipboardList}
            toolbarActions={
              <SearchInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari MAC atau isi jawaban..."
                style={{ width: '250px' }}
              />
            }
          >
            {subLoading ? (
              <LoadingState />
            ) : subData && subData.data.length > 0 ? (
              <>
                <div className="table-wrapper">
                  <table className="stitch-table">
                    <thead>
                      <tr>
                        <th>Waktu</th>
                        <th>Router</th>
                        <th>MAC Address</th>
                        <th>Jawaban</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subData.data.map((s) => (
                        <tr key={s.id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>{formatDate(s.created_at)}</td>
                          <td style={{ fontSize: '12px', fontWeight: 600 }}>{s.router_name || '—'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{s.mac || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              {Object.entries(s.answers || {}).map(([k, v]) => (
                                <span
                                  key={k}
                                  style={{
                                    fontSize: '11px',
                                    background: '#f1f5f9',
                                    color: '#0f172a',
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                  }}
                                >
                                  <strong>{k}:</strong> {v}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination meta={subData.meta} path="/questionnaire" search={searchParams} />
              </>
            ) : (
              <div style={{ padding: '2rem' }}>
                <EmptyState title="Belum ada jawaban kuesioner masuk." />
              </div>
            )}
          </DataTableCard>
        )}
      </div>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 60,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="stitch-card-container"
            style={{ width: '100%', maxWidth: '480px', padding: '1.5rem', background: '#fff', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {editing ? 'Edit Field Kuesioner' : 'Tambah Field Kuesioner'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveMutation.mutate()
              }}
              style={{ display: 'grid', gap: '0.85rem' }}
            >
              <div className="form-field">
                <label>Label Pertanyaan</label>
                <input
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value)
                    if (!editing && !key) {
                      setKey(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
                    }
                  }}
                  placeholder="Contoh: Nomor WhatsApp"
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-field">
                  <label>Key Unik</label>
                  <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="whatsapp" required />
                </div>
                <div className="form-field">
                  <label>Tipe Input</label>
                  <select value={type} onChange={(e) => setType(e.target.value as FieldType)}>
                    {FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label>Placeholder</label>
                <input
                  value={placeholder}
                  onChange={(e) => setPlaceholder(e.target.value)}
                  placeholder="Contoh: 0812xxxxxxxx"
                />
              </div>
              {type === 'SELECT' && (
                <div className="form-field">
                  <label>Opsi Pilihan (pisahkan dengan koma)</label>
                  <input
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                    placeholder="Pelajar, Mahasiswa, Pekerja, Wirausaha"
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '13px' }}>
                  <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
                  Wajib diisi
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '13px' }}>
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  Aktif di Portal
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.4rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
                  <Save size={14} />
                  {saveMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
