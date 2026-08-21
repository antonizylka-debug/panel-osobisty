import { useEffect } from 'react'

export function Card({ children, className = '', ...rest }) {
  return (
    <section className={`card ${className}`.trim()} {...rest}>
      {children}
    </section>
  )
}

export function CardHead({ title, action, hint }) {
  return (
    <header className="card-head">
      <div>
        <h2 className="card-title">{title}</h2>
        {hint && <p className="card-hint">{hint}</p>}
      </div>
      {action}
    </header>
  )
}

export function ProgressBar({ value, max, tone = 'accent' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-fill is-${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function EmptyState({ children }) {
  return <p className="empty-state">{children}</p>
}

export function Segmented({ options, value, onChange, ariaLabel }) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={'segmented-item' + (value === opt.value ? ' is-active' : '')}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function Sheet({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Zamknij">×</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

/** Prosty wykres slupkowy na SVG — bez zewnetrznych bibliotek. */
export function BarChart({ data, height = 120, format = (v) => v, tone = 'accent', minSlots = 8 }) {
  if (!data.length) return <EmptyState>Za mało danych na wykres.</EmptyState>

  const max = Math.max(...data.map((d) => d.value), 1)
  // Przy jednym-dwoch slupkach nie rozciagamy ich na cala karte — trzymamy
  // stala szerokosc slotu, zeby pojedynczy pomiar nie wygladal jak plakat.
  const slots = Math.max(data.length, minSlots)
  const barW = 100 / slots

  return (
    <div className="chart">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="chart-svg" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 4)
          return (
            <rect
              key={i}
              x={i * barW + barW * 0.18}
              y={height - h}
              width={barW * 0.64}
              height={Math.max(h, d.value > 0 ? 2 : 0)}
              rx="1.6"
              className={`chart-bar is-${tone}`}
            />
          )
        })}
      </svg>
      <div className="chart-labels" style={{ gridTemplateColumns: `repeat(${slots}, 1fr)` }}>
        {data.map((d, i) => (
          <span key={i} title={format(d.value)}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

export function StatRow({ items }) {
  return (
    <div className="stat-row">
      {items.map((it) => (
        <div className="stat-cell" key={it.label}>
          <b>{it.value}</b>
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Glowna akcja ekranu. Plywa nad paskiem nawigacji, zeby nie mylila sie
 * z zakladkami — przycisk w rzedzie obok innego czytal sie jak nawigacja.
 */
export function Fab({ onClick, children }) {
  return (
    <button type="button" className="fab" onClick={onClick}>
      <span className="fab-plus" aria-hidden="true">+</span>
      {children}
    </button>
  )
}
