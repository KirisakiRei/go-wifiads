import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Ban,
  Building2,
  CheckCircle2,
  Eye,
  PlusCircle,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { EmptyState, LoadingState } from '@/components/feedback/query-state'
import {
  DataTableCard,
  KpiCard,
  KpiGrid,
  Pagination,
  SearchInput,
  StatusPill,
  WavyHeader,
} from '@/components/ui'
import { adminMarketplaceApi } from '@/features/marketplace/marketplace.api'
import type { AdvertiserProfile } from '@/features/marketplace/marketplace.types'
import { formatDate, formatRupiah } from '@/lib/formatters'

export function AdminAdvertisersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedAdv, setSelectedAdv] = useState<AdvertiserProfile | null>(null)
  const [adjustingAdv, setAdjustingAdv] = useState<AdvertiserProfile | null>(null)
  const [adjustAmount, setAdjustAmount] = useState<number>(50000)
  const [adjustDesc, setAdjustDesc] = useState<string>('Penyesuaian saldo oleh Admin')

  const { data: advRes, isPending } = useQuery({
    queryKey: ['admin-mkt-advertisers', page, search],
    queryFn: () =>
      adminMarketplaceApi.listAdvertisers({
        page,
        per_page: 20,
        search: search || undefined,
      }),
  })

  const { data: detailCampaigns } = useQuery({
    queryKey: ['admin-adv-detail-campaigns', selectedAdv?.id],
    queryFn: () =>
      adminMarketplaceApi.listCampaigns({
        page: 1,
        per_page: 20,
        advertiser_id: selectedAdv!.id,
      }),
    enabled: Boolean(selectedAdv?.id),
  })

  const { data: detailTopups } = useQuery({
    queryKey: ['admin-adv-detail-topups', selectedAdv?.id],
    queryFn: () =>
      adminMarketplaceApi.listTopups({
        page: 1,
        per_page: 20,
        advertiser_id: selectedAdv!.id,
      }),
    enabled: Boolean(selectedAdv?.id),
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      adminMarketplaceApi.toggleAdvertiserStatus(id, is_active),
    onSuccess: () => {
      toast.success('Status akun pengiklan diperbarui')
      queryClient.invalidateQueries({ queryKey: ['admin-mkt-advertisers'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const adjustBalanceMutation = useMutation({
    mutationFn: () =>
      adminMarketplaceApi.adjustBalance(adjustingAdv!.id, {
        amount_idr: Number(adjustAmount),
        description: adjustDesc,
      }),
    onSuccess: () => {
      toast.success('Saldo pengiklan berhasil disesuaikan')
      queryClient.invalidateQueries({ queryKey: ['admin-mkt-advertisers'] })
      queryClient.invalidateQueries({ queryKey: ['admin-finance'] })
      setAdjustingAdv(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isPending) return <LoadingState />

  const advertisers = advRes?.data || []
  const meta = advRes?.meta
  const activeCount = advertisers.filter((a) => a.is_active).length
  const totalWallet = advertisers.reduce((acc, a) => acc + (a.wallet_balance_idr || 0), 0)
  const totalSpent = advertisers.reduce((acc, a) => acc + (a.total_spent_idr || 0), 0)

  return (
    <div>
      <WavyHeader title="Daftar Pengiklan" />

      <div className="stitch-page-stage">
        <KpiGrid columns={4}>
          <KpiCard
            label="Total Pengiklan"
            value={meta?.total_items || advertisers.length}
            icon={Building2}
            subtext="Akun klien terdaftar"
          />
          <KpiCard
            label="Akun Aktif"
            value={activeCount}
            icon={Users}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext="Dapat menayangkan iklan"
          />
          <KpiCard
            label="Total Deposit Klien"
            value={formatRupiah(totalWallet)}
            icon={Wallet}
            iconBoxVariant="secondary"
            subtext="Saldo mengendap di dompet"
          />
          <KpiCard
            label="Total Belanja Iklan"
            value={formatRupiah(totalSpent)}
            icon={TrendingUp}
            subtext="Akumulasi tayangan terpakai"
          />
        </KpiGrid>

        <DataTableCard
          title="Data Akun Pengiklan"
          icon={Building2}
          toolbarActions={
            <SearchInput
              placeholder="Cari nama, perusahaan, atau email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              style={{ width: '260px' }}
            />
          }
        >
          {advertisers.length === 0 ? (
            <div style={{ padding: '2rem' }}>
              <EmptyState title="Belum ada akun pengiklan yang sesuai pencarian." />
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Nama &amp; Perusahaan</th>
                      <th>Kontak</th>
                      <th>Iklan</th>
                      <th>Total Belanja</th>
                      <th>Sisa Saldo</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advertisers.map((adv) => (
                      <tr key={adv.id}>
                        <td>
                          <strong style={{ display: 'block', color: '#0f172a' }}>{adv.name}</strong>
                          <small style={{ color: '#64748b' }}>
                            {adv.company_name || 'Perorangan'}
                          </small>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <div>{adv.email}</div>
                          <small style={{ color: '#64748b' }}>{adv.phone || '—'}</small>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <strong>{adv.active_campaigns_count || 0}</strong> aktif{' '}
                          <span style={{ color: '#64748b' }}>
                            / {adv.total_campaigns_count || 0} total
                          </span>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <strong style={{ color: '#0f172a' }}>
                            {formatRupiah(adv.total_spent_idr || 0)}
                          </strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Top-Up: {formatRupiah(adv.total_topup_idr || 0)}
                          </div>
                        </td>
                        <td>
                          <strong style={{ fontSize: '14px', color: '#065f46' }}>
                            {formatRupiah(adv.wallet_balance_idr)}
                          </strong>
                        </td>
                        <td>
                          {adv.is_active ? (
                            <StatusPill variant="active" dot>
                              Aktif
                            </StatusPill>
                          ) : (
                            <StatusPill variant="expired">Nonaktif</StatusPill>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.38rem 0.65rem', fontSize: '12px' }}
                              onClick={() => setSelectedAdv(adv)}
                            >
                              <Eye size={13} /> Detail
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.38rem 0.65rem', fontSize: '12px' }}
                              onClick={() => {
                                setAdjustingAdv(adv)
                                setAdjustAmount(50000)
                                setAdjustDesc('Penambahan saldo manual oleh Admin')
                              }}
                            >
                              <PlusCircle size={13} /> Saldo
                            </button>
                            <button
                              type="button"
                              className={adv.is_active ? 'btn btn-danger' : 'btn btn-primary'}
                              style={{ padding: '0.38rem 0.65rem', fontSize: '12px' }}
                              onClick={() =>
                                toggleStatusMutation.mutate({
                                  id: adv.id,
                                  is_active: !adv.is_active,
                                })
                              }
                            >
                              {adv.is_active ? <Ban size={13} /> : <CheckCircle2 size={13} />}
                              {adv.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {meta && meta.total_pages > 1 && (
                <Pagination meta={meta} onPageChange={setPage} />
              )}
            </>
          )}
        </DataTableCard>
      </div>

      {/* Modal: Detail Advertiser */}
      {selectedAdv && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedAdv(null)
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '720px',
              width: '100%',
              maxHeight: '88vh',
              overflow: 'auto',
            }}
          >
            <div className="table-toolbar" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px' }}>
                  Detail Pengiklan: {selectedAdv.name}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {selectedAdv.company_name || 'Perorangan'} • {selectedAdv.email} • Terdaftar{' '}
                  {formatDate(selectedAdv.created_at)}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.4rem' }}
                onClick={() => setSelectedAdv(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1.35rem', display: 'grid', gap: '1.25rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '0.85rem',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Saldo Saat Ini</div>
                  <strong style={{ fontSize: '16px', color: '#065f46' }}>
                    {formatRupiah(selectedAdv.wallet_balance_idr)}
                  </strong>
                </div>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '0.85rem',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Total Top-Up Lunas</div>
                  <strong style={{ fontSize: '16px', color: '#0f172a' }}>
                    {formatRupiah(selectedAdv.total_topup_idr || 0)}
                  </strong>
                </div>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '0.85rem',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Total Belanja Iklan</div>
                  <strong style={{ fontSize: '16px', color: '#1d4ed8' }}>
                    {formatRupiah(selectedAdv.total_spent_idr || 0)}
                  </strong>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '14px' }}>
                  Kampanye Iklan ({detailCampaigns?.data?.length || 0})
                </h4>
                {(detailCampaigns?.data || []).length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#64748b' }}>Belum ada iklan yang dibuat.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {(detailCampaigns?.data || []).map((c) => (
                      <div
                        key={c.id}
                        style={{
                          padding: '0.65rem 0.85rem',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '12px',
                        }}
                      >
                        <div>
                          <strong style={{ color: '#0f172a' }}>{c.title}</strong>
                          <div style={{ color: '#64748b', fontSize: '11px' }}>
                            {c.impressions_count} tayangan • {c.clicks_count} klik • Terpakai{' '}
                            {formatRupiah(c.spent_amount_idr)}
                          </div>
                        </div>
                        <StatusPill variant={c.status === 'ACTIVE' ? 'active' : 'basic'}>
                          {c.status}
                        </StatusPill>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '14px' }}>
                  Riwayat Top-Up ({detailTopups?.data?.length || 0})
                </h4>
                {(detailTopups?.data || []).length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#64748b' }}>Belum ada riwayat Top-Up.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '0.45rem' }}>
                    {(detailTopups?.data || []).map((t) => (
                      <div
                        key={t.id}
                        style={{
                          padding: '0.6rem 0.85rem',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '12px',
                        }}
                      >
                        <div>
                          <code>{t.invoice_number}</code> • {t.payment_provider_name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong>{formatRupiah(t.amount_idr)}</strong>
                          <StatusPill variant={t.status === 'PAID' ? 'active' : 'basic'}>
                            {t.status === 'PAID' ? 'Lunas' : t.status}
                          </StatusPill>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adjust Balance */}
      {adjustingAdv && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              adjustBalanceMutation.mutate()
            }}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '1.5rem',
              display: 'grid',
              gap: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px' }}>Sesuaikan Saldo: {adjustingAdv.name}</h3>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Saldo saat ini: <strong>{formatRupiah(adjustingAdv.wallet_balance_idr)}</strong>{' '}
              (gunakan angka negatif untuk mengurangi saldo)
            </div>
            <div className="form-field">
              <label>Nominal Penyesuaian (Rp)</label>
              <input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(Number(e.target.value))}
                required
              />
            </div>
            <div className="form-field">
              <label>Keterangan Mutasi</label>
              <input
                value={adjustDesc}
                onChange={(e) => setAdjustDesc(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAdjustingAdv(null)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={adjustBalanceMutation.isPending}
              >
                Simpan Saldo
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
