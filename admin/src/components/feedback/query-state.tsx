import type { LucideIcon } from 'lucide-react'
import { AlertCircle, FolderSearch, Loader2, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

export interface LoadingStateProps {
  message?: string
  submessage?: string
}

export function LoadingState({
  message = 'Memuat data…',
  submessage = 'Sedang menyiapkan informasi untuk Anda, mohon tunggu sebentar.',
}: LoadingStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        textAlign: 'center',
        color: '#434655',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: '#eff4ff',
          color: '#1d4ed8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem',
        }}
      >
        <Loader2
          size={24}
          style={{
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>
      <strong style={{ fontSize: '15px', color: '#0b1c30', marginBottom: '0.25rem' }}>
        {message}
      </strong>
      <span style={{ fontSize: '12px', color: '#747686' }}>{submessage}</span>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  description?: string
  action?: ReactNode
}

export function EmptyState({
  icon: Icon = FolderSearch,
  title = 'Belum Ada Data',
  description = 'Saat ini belum ada data yang dapat ditampilkan.',
  action,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3.5rem 2rem',
        textAlign: 'center',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px dashed #cbd5e1',
        margin: '0.5rem 0',
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '14px',
          background: '#f1f5f9',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem',
        }}
      >
        <Icon size={26} />
      </div>
      <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0b1c30', margin: '0 0 0.35rem 0' }}>
        {title}
      </h4>
      {description && (
        <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', margin: '0 0 1.25rem 0' }}>
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}

export interface ErrorStateProps {
  message?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({
  message = 'Tidak dapat menampilkan data saat ini',
  description = 'Terjadi kendala sementara. Silakan segarkan halaman atau coba beberapa saat lagi.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3.5rem 2rem',
        textAlign: 'center',
        background: '#fff',
        borderRadius: '14px',
        border: '1px solid #fee2e2',
        boxShadow: '0 1px 3px rgba(239, 68, 68, 0.05)',
        margin: '1.5rem',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: '#fef2f2',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem',
        }}
      >
        <AlertCircle size={24} />
      </div>
      <strong style={{ fontSize: '15px', color: '#991b1b', marginBottom: '0.35rem' }}>
        {message}
      </strong>
      <span style={{ fontSize: '13px', color: '#747686', maxWidth: '420px', marginBottom: '1.25rem' }}>
        {description}
      </span>
      {onRetry && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRetry}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={16} />
          Coba Lagi
        </button>
      )}
    </div>
  )
}
