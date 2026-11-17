import type { CSSProperties, ReactNode } from 'react'

export interface PolicyCardProps {
  title: string
  description?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  style?: CSSProperties
}

export function PolicyCard({
  title,
  description,
  checked,
  onChange,
  disabled = false,
  className = '',
  style,
}: PolicyCardProps) {
  return (
    <div
      className={`policy-card ${checked ? 'active' : ''} ${className}`.trim()}
      style={{
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        ...style,
      }}
      onClick={() => !disabled && onChange(!checked)}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          e.stopPropagation()
          onChange(e.target.checked)
        }}
      />
      <div className="policy-card-text">
        <span className="policy-card-title">{title}</span>
        {description && <span className="policy-card-desc">{description}</span>}
      </div>
    </div>
  )
}
