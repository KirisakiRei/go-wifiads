import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

export interface DataTableCardProps {
  title: string
  icon?: LucideIcon
  iconColor?: string
  subtitle?: ReactNode
  badges?: ReactNode
  toolbarActions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function DataTableCard({
  title,
  icon: Icon,
  iconColor = '#1d4ed8',
  subtitle,
  badges,
  toolbarActions,
  footer,
  children,
  className = '',
  style,
}: DataTableCardProps) {
  return (
    <div className={`stitch-card-container ${className}`.trim()} style={style}>
      <div className="table-toolbar">
        <div className="table-toolbar-title">
          {Icon && <Icon size={20} style={{ color: iconColor }} />}
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0b1c30' }}>{title}</h3>
            {subtitle && <small style={{ color: '#747686', fontSize: '12px' }}>{subtitle}</small>}
          </div>
          {badges && <div style={{ display: 'inline-flex', gap: '0.4rem', marginLeft: '0.35rem' }}>{badges}</div>}
        </div>

        {toolbarActions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            {toolbarActions}
          </div>
        )}
      </div>

      <div className="table-wrapper">{children}</div>

      {footer && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: '#64748b',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  )
}
