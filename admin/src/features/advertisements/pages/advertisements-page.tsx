import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock,
  Film,
  Image,
  Megaphone,
  Monitor,
  Pencil,
  PlusCircle,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { queryClient } from '@/app/query-client'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/query-state'
import { AdMediaThumb, KpiCard, KpiGrid, SearchInput, StatusPill, WavyHeader } from '@/components/ui'
import { advertisementsApi } from '@/features/advertisements/api/advertisements.api'
import { advertisementsQueryKey, useAdvertisements } from '@/features/advertisements/hooks/use-advertisements'

export function AdvertisementsPage() {
  const navigate = useNavigate()
  const { data: ads, isPending, error } = useAdvertisements()
  const [search, setSearch] = useState('')
  const [filterLayout, setFilterLayout] = useState('')

  const deleteMutation = useMutation({
    mutationFn: advertisementsApi.delete,
    onSuccess: () => {
      toast.success('Materi iklan berhasil dihapus')
      queryClient.invalidateQueries({ queryKey: advertisementsQueryKey })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Gagal menghapus materi iklan')
    },
  })

  if (isPending) return <LoadingState />
  if (error || !ads) return <ErrorState message="Gagal memuat daftar iklan." />

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`Yakin ingin menghapus iklan "${title}"?`)) {
      deleteMutation.mutate(id)
    }
  }

  const activeAds = ads.filter((a) => a.is_active)
  const videoAds = ads.filter((a) => a.media_type === 'video')
  const landscapeAds = ads.filter((a) => a.layout_mode === 'landscape')

  const filteredAds = ads.filter((a) => {
    const matchSearch =
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.body.toLowerCase().includes(search.toLowerCase())
    const matchLayout = !filterLayout || a.layout_mode === filterLayout
    return matchSearch && matchLayout
  })

  return (
    <div>
      <WavyHeader
        title="Manajemen Iklan"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/advertisements/new')}
          >
            <PlusCircle size={18} />
            Tambah Iklan
          </button>
        }
      />

      <div className="stitch-page-stage">
        {/* KPI Cards */}
        <KpiGrid columns={4}>
          <KpiCard
            label="Iklan Aktif"
            value={activeAds.length}
            icon={Megaphone}
            iconColor="#10b981"
            iconBoxVariant="success"
            subtext="Sedang tayang di portal"
          />

          <KpiCard
            label="Iklan Video"
            value={videoAds.length}
            icon={Film}
            iconBoxVariant="secondary"
            subtext="Format MP4 / WebM"
          />

          <KpiCard
            label="Iklan Gambar"
            value={ads.length - videoAds.length}
            icon={Image}
            subtext="Format JPG / PNG / WebP"
          />

          <KpiCard
            label="Orientasi Landscape"
            value={landscapeAds.length}
            icon={Monitor}
            subtext={`${ads.length - landscapeAds.length} orientasi portrait`}
          />
        </KpiGrid>

        {/* Search & Filter Bar */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '1rem',
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          <SearchInput
            placeholder="Cari judul atau deskripsi iklan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            wrapperStyle={{ flex: 1, minWidth: '260px' }}
            style={{ width: '100%' }}
          />

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select
              value={filterLayout}
              onChange={(e) => setFilterLayout(e.target.value)}
              style={{ padding: '0.65rem 0.85rem' }}
            >
              <option value="">Semua Orientasi</option>
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
            </select>
          </div>
        </div>

        {/* Ads Cards Grid */}
        {filteredAds.length === 0 ? (
          <EmptyState title="Belum ada materi iklan yang sesuai pencarian." />
        ) : (
          <div className="ad-grid">
            {filteredAds.map((ad) => {
              const isVideo = ad.media_type === 'video'
              return (
                <div key={ad.id} className="ad-card">
                  <div
                    className="ad-media-thumb"
                    style={{ position: 'relative', cursor: 'pointer', background: '#05070c' }}
                    onClick={() => navigate(`/advertisements/${ad.id}/edit`)}
                    title="Klik untuk membuka detail iklan"
                  >
                    <AdMediaThumb
                      url={ad.image_url}
                      mediaType={ad.media_type}
                      alt={ad.title}
                    />

                    <div className="ad-badge-overlay">
                      <StatusPill
                        variant={isVideo ? 'secondary' : 'basic'}
                        icon={isVideo ? Film : Image}
                      >
                        {isVideo ? 'Video' : 'Gambar'}
                      </StatusPill>
                      <StatusPill style={{ background: '#0f172a', color: '#ffffff' }}>
                        {ad.layout_mode === 'portrait' ? 'Portrait' : 'Landscape'}
                      </StatusPill>
                    </div>
                  </div>

                  <div className="ad-card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0b1c30' }}>{ad.title}</h3>
                      {ad.is_active ? (
                        <StatusPill variant="active" dot>Aktif</StatusPill>
                      ) : (
                        <StatusPill variant="expired">Nonaktif</StatusPill>
                      )}
                    </div>

                    <p style={{ fontSize: '13px', color: '#434655', lineHeight: 1.5 }}>
                      {ad.body || 'Tidak ada deskripsi tambahan.'}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '12px', color: '#747686', marginTop: 'auto' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={15} />
                        {ad.duration_seconds > 0 ? `${ad.duration_seconds} detik` : '15 detik'}
                      </span>
                      <span>• Urutan #{ad.sort_order}</span>
                    </div>
                  </div>

                  <div className="ad-card-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 0.85rem' }}
                      onClick={() => navigate(`/advertisements/${ad.id}/edit`)}
                    >
                      <Pencil size={16} />
                      Edit
                    </button>

                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '0.45rem 0.85rem' }}
                      onClick={() => handleDelete(ad.id, ad.title)}
                    >
                      <Trash2 size={16} />
                      Hapus
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
