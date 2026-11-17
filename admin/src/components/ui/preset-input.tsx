import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

export interface PresetOption<T = number> {
  label: string
  val: T
}

export interface PresetInputProps {
  label: string
  icon?: LucideIcon
  iconColor?: string
  value: number
  onChange: (value: number) => void
  badgeText?: ReactNode
  helperText?: ReactNode
  presets?: PresetOption<number>[]
  min?: number
  max?: number
  step?: number
  required?: boolean
  className?: string
  style?: CSSProperties
}

export function PresetInput({
  label,
  icon: Icon,
  iconColor,
  value,
  onChange,
  badgeText,
  helperText,
  presets,
  min,
  max,
  step,
  required = false,
  className = '',
  style,
}: PresetInputProps) {
  return (
    <div className={`form-field ${className}`.trim()} style={style}>
      <label>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: iconColor }}>
          {Icon && <Icon size={16} />}
          {label}
        </span>
        {badgeText && <span className="live-badge">{badgeText}</span>}
      </label>

      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        required={required}
      />

      {helperText && <span className="helper-text">{helperText}</span>}

      {presets && presets.length > 0 && (
        <div className="preset-list">
          {presets.map((p) => (
            <button
              key={String(p.val)}
              type="button"
              className={`preset-btn ${value === p.val ? 'active' : ''}`}
              onClick={() => onChange(p.val)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
