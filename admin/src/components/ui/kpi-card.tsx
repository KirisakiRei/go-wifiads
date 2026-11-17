import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

export interface KpiCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  iconSize?: number
  iconColor?: string
  iconBoxVariant?: 'primary' | 'secondary' | 'success' | 'warning'
  trend?: {
    label: string
    variant?: 'success' | 'warning' | 'default'
  }
  progressBar?: {
    percent: number
    color?: string
  }
  footerLeft?: ReactNode
  footerRight?: ReactNode
  subtext?: ReactNode
  compact?: boolean
  className?: string
  style?: CSSProperties
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  iconSize = 22,
  iconColor,
  iconBoxVariant = 'primary',
  trend,
  progressBar,
  footerLeft,
  footerRight,
  subtext,
  compact = false,
  className = '',
  style,
}: KpiCardProps) {
  const iconBoxClass = `kpi-icon-box ${iconBoxVariant !== 'primary' ? iconBoxVariant : ''}`.trim()
  const trendClass = `trend-chip ${trend?.variant && trend.variant !== 'default' ? trend.variant : ''}`.trim()

  if (compact) {
    return (
      <div className={`kpi-card ${className}`.trim()} style={{ padding: '1rem 1.25rem', ...style }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {Icon && (
            <div className={iconBoxClass} style={{ width: '38px', height: '38px' }}>
              <Icon size={18} style={iconColor ? { color: iconColor } : undefined} />
            </div>
          )}
          <div>
            <span className="kpi-label">{label}</span>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0b1c30' }}>{value}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`kpi-card ${className}`.trim()} style={style}>
      <div className="kpi-card-header">
        <span className="kpi-label">{label}</span>
        {Icon && (
          <div className={iconBoxClass}>
            <Icon size={iconSize} style={iconColor ? { color: iconColor } : undefined} />
          </div>
        )}
      </div>

      <div>
        <div className="kpi-metric-row">
          <span className="kpi-number">{value}</span>
          {trend && <span className={trendClass}>{trend.label}</span>}
        </div>

        {progressBar && (
          <div
            style={{
              marginTop: '0.75rem',
              width: '100%',
              height: '6px',
              background: '#e5eeff',
              borderRadius: '999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(0, progressBar.percent))}%`,
                height: '100%',
                background: progressBar.color || '#1d4ed8',
                borderRadius: '999px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        )}

        {subtext && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '0.35rem' }}>{subtext}</div>}

        {(footerLeft || footerRight) && (
          <div className="kpi-card-footer">
            <span>{footerLeft}</span>
            <span style={{ fontWeight: 600 }}>{footerRight}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function KpiGrid({
  children,
  columns,
  className = '',
}: {
  children: ReactNode
  columns?: 3 | 4
  className?: string
}) {
  const colStyle = columns ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined
  return (
    <div className={`kpi-telemetry-grid ${className}`.trim()} style={colStyle}>
      {children}
    </div>
  )
}
