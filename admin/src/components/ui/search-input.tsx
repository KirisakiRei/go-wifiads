import { Search } from 'lucide-react'
import type { CSSProperties, InputHTMLAttributes } from 'react'

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onSearchChange?: (value: string) => void
  wrapperStyle?: CSSProperties
  iconColor?: string
  iconSize?: number
}

export function SearchInput({
  className = '',
  style,
  wrapperStyle,
  iconColor = '#747686',
  iconSize = 18,
  onSearchChange,
  onChange,
  ...props
}: SearchInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e)
    onSearchChange?.(e.target.value)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', ...wrapperStyle }}>
      <Search
        size={iconSize}
        style={{
          position: 'absolute',
          left: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: iconColor,
          pointerEvents: 'none',
        }}
      />
      <input
        {...props}
        onChange={handleChange}
        style={{
          paddingLeft: '2.25rem',
          ...style,
        }}
        className={className}
      />
    </div>
  )
}
