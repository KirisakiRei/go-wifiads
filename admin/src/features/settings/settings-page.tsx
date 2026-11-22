import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Save, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState, LoadingState } from '@/components/feedback/query-state'
import { WavyHeader } from '@/components/ui'
import { settingsApi } from '@/features/settings/settings.api'

const BOOL_KEYS = new Set(['portal.enable_voucher_redeem', 'portal.enable_survey'])

export function SettingsPage() {
  const qc = useQueryClient()
  const { data: items = [], isPending, error } = useQuery({
    queryKey: ['system-settings'],
    queryFn: settingsApi.list,
  })
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    if (items.length > 0) {
      const next: Record<string, string> = {}
      items.forEach((it) => {
        next[it.key] = it.value
      })
      setValues(next)
    }
  }, [items])

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.bulkUpdate(values),
    onSuccess: () => {
      toast.success('Pengaturan portal & sistem berhasil disimpan')
      qc.invalidateQueries({ queryKey: ['system-settings'] })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal menyimpan pengaturan'),
  })

  if (isPending) return <LoadingState />
  if (error) return <ErrorState message="Gagal memuat pengaturan portal." />

  return (
    <div>
      <WavyHeader
        title="Pengaturan Portal & Sistem"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Save size={15} />
            {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        }
      />

      <div className="stitch-page-stage">
        <div className="stitch-card-container" style={{ padding: '1.5rem', maxWidth: '780px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <Settings2 size={20} style={{ color: '#1d4ed8' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Konfigurasi Runtime Captive Portal</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Perubahan langsung diterapkan ke halaman <code>/portal</code> tanpa perlu restart server.
              </span>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveMutation.mutate()
            }}
            style={{ display: 'grid', gap: '1.1rem' }}
          >
            {items.map((item) => {
              const isBool = BOOL_KEYS.has(item.key)
              const val = values[item.key] ?? item.value
              return (
                <div
                  key={item.key}
                  style={{
                    display: 'grid',
                    gap: '0.35rem',
                    paddingBottom: '0.9rem',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{item.key}</strong>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{item.description}</div>
                    </div>
                    {isBool && (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '13px', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={val !== 'false'}
                          onChange={(e) =>
                            setValues((prev) => ({
                              ...prev,
                              [item.key]: e.target.checked ? 'true' : 'false',
                            }))
                          }
                        />
                        {val !== 'false' ? 'Aktif' : 'Nonaktif'}
                      </label>
                    )}
                  </div>
                  {!isBool && (
                    <input
                      value={val}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [item.key]: e.target.value }))
                      }
                      style={{
                        padding: '0.6rem 0.8rem',
                        borderRadius: '9px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                      }}
                    />
                  )}
                </div>
              )
            })}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
                <Save size={15} />
                {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
