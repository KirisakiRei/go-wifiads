import type { ReactNode } from 'react'

interface WavyHeaderProps {
  eyebrow?: string
  title: string | ReactNode
  description?: string | ReactNode
  actions?: ReactNode
}

export function WavyHeader({
  eyebrow,
  title,
  description,
  actions,
}: WavyHeaderProps) {
  return (
    <section className="wavy-ambient-section">
      <div className="wavy-ambient-content">
        <div className="wavy-header-main">
          <div className="wavy-title-area">
            {eyebrow && (
              <p className="eyebrow" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1d4ed8', marginBottom: '0.25rem' }}>
                {eyebrow}
              </p>
            )}
            <h1>{title}</h1>
            {description && <p style={{ marginTop: '0.35rem' }}>{description}</p>}
          </div>

          {actions && <div className="wavy-action-toolbar">{actions}</div>}
        </div>
      </div>

      {/* Organic Wavy Architectural Divider from Google Stitch */}
      <div className="wavy-svg-divider">
        <svg fill="none" preserveAspectRatio="none" viewBox="0 0 1440 28">
          <path
            d="M0,0 C320,24 640,28 960,14 C1200,3.5 1360,18 1440,28 L1440,28 L0,28 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </section>
  )
}
