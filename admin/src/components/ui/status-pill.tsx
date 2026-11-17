import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

export type StatusPillVariant =
  | 'active'
  | 'expired'
  | 'premium'
  | 'basic'
  | 'warning'
  | 'secondary'
  | 'neutral'

export interface StatusPillProps {
  children: ReactNode
  variant?: StatusPillVariant
  dot?: boolean
  icon?: LucideIcon
  iconSize?: number
  className?: string
  style?: CSSProperties
}

export function StatusPill({
  children,
  variant = 'neutral',
  dot = false,
  icon: Icon,
  iconSize = 13,
  className = '',
  style,
}: StatusPillProps) {
  const variantClass = variant !== 'neutral' ? variant : ''
  const baseClasses = `status-pill ${variantClass} ${className}`.trim()

  return (
    <span className={baseClasses} style={style}>
      {dot && <span className="dot-indicator" />}
      {Icon && <Icon size={iconSize} />}
      {children}
    </span>
  )
}
