import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconMore } from './icons'

/**
 * Menu "kropki" przy elemencie listy — Edytuj/Usun itp.
 * items: [{ label, onClick, tone: 'danger'? }]
 */
export function Kebab({ items, ariaLabel = 'Wiecej opcji' }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      if (!boxRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="kebab" ref={boxRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="kebab-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
      >
        <IconMore />
      </button>
      {open && (
        <div className="kebab-menu" role="menu">
          <span className="kebab-menu-label">Więcej opcji</span>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className={'kebab-item' + (it.tone === 'danger' ? ' is-danger' : '')}
              onClick={() => { setOpen(false); it.onClick() }}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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

/**
 * Znak zapytania z wyjasnieniem, skad wzięla sie liczba.
 *
 * <button>, nie <span>: dymek ma sie pokazywac takze po tabulacji i po
 * dotknieciu na telefonie, a nie tylko pod kursorem myszy. `title` zostaje
 * jako zapasowy opis dla czytnikow ekranu.
 */
export function InfoTip({ text, label = 'Jak to jest liczone' }) {
  return (
    <button type="button" className="infotip" aria-label={label} title={text}>
      <span aria-hidden="true">?</span>
      <span className="infotip-bubble" role="tooltip">{text}</span>
    </button>
  )
}

/**
 * Rzad glownych liczb okresu.
 * `items`: [{ label, value, delta?, deltaGood?, tone? }]
 *  - delta        — zmiana wzgledem poprzedniego okresu (liczba, moze byc ujemna)
 *  - deltaGood    — czy wzrost jest dobry ('up' | 'down'); przy wydatkach
 *                   wzrost jest zly, przy zarobkach dobry
 */
export function SummaryRow({ items }) {
  return (
    <div className="summary-row">
      {items.map((it) => {
        const hasDelta = it.delta != null && Number.isFinite(it.delta)
        const rising = hasDelta && it.delta > 0
        const flat = hasDelta && Math.abs(it.delta) < 0.5
        const good = it.deltaGood === 'down' ? !rising : rising

        return (
          <div className="summary-cell" key={it.label}>
            <span className="summary-label">
              {it.label}
              {it.tip && <InfoTip text={it.tip} />}
            </span>
            <b className={'summary-value' + (it.tone === 'negative' ? ' is-negative' : '')}>
              {it.value}
            </b>
            {hasDelta && (
              <span className={'summary-delta' + (flat ? '' : good ? ' is-up' : ' is-down')}>
                {flat ? 'bez zmian' : `${rising ? '▲' : '▼'} ${it.deltaLabel}`}
                {it.deltaHint ? ` ${it.deltaHint}` : ''}
              </span>
            )}
            {!hasDelta && it.hint && <span className="summary-delta">{it.hint}</span>}
          </div>
        )
      })}
    </div>
  )
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

  // Portal do <body>: arkusz bywa wywolywany z wnetrza <tbody> (wiersz tabeli),
  // a <div> jako dziecko <tbody> to niepoprawny HTML. Portal wyprowadza go
  // poza tabele, niezaleznie od miejsca wywolania.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Zamknij">×</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body
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

/* Monochromatyczna rampa zamiast teczy. Dane sa posortowane malejaco, wiec
   najciemniejszy odcien = najwiekszy udzial — kolor niesie informacje, a nie
   tylko rozroznia. Osiem nasyconych barw czytalo sie jak wykres w podreczniku
   do szkoly podstawowej. */
const PIE_COLORS = ['#39414F', '#4E586A', '#667287', '#818CA1', '#9CA6B8', '#B7BFCD', '#D0D6E0', '#E4E8EE']

/** Kolko "na co ida pieniadze" — bez zewnetrznych bibliotek. */
export function PieChart({ data, format = (v) => v }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!data.length || total <= 0) return <EmptyState>Za mało danych na wykres.</EmptyState>

  const toRad = (deg) => (deg * Math.PI) / 180
  const point = (angle, r = 48) => [50 + r * Math.cos(toRad(angle)), 50 + r * Math.sin(toRad(angle))]

  let angle = -90
  const slices = data.map((d, i) => {
    const share = d.value / total
    const startAngle = angle
    angle += share * 360
    return { ...d, share, startAngle, endAngle: angle, color: PIE_COLORS[i % PIE_COLORS.length] }
  })

  return (
    <div className="pie-chart">
      <svg viewBox="0 0 100 100" className="pie-svg">
        {slices.map((s, i) => {
          if (s.share >= 0.999) return <circle key={i} cx="50" cy="50" r="48" fill={s.color} />
          const [x1, y1] = point(s.startAngle)
          const [x2, y2] = point(s.endAngle)
          const largeArc = s.endAngle - s.startAngle > 180 ? 1 : 0
          return (
            <path key={i} fill={s.color}
              d={`M 50 50 L ${x1} ${y1} A 48 48 0 ${largeArc} 1 ${x2} ${y2} Z`} />
          )
        })}
      </svg>
      <ul className="pie-legend">
        {slices.map((s, i) => (
          <li key={i}>
            <span className="pie-dot" style={{ background: s.color }} />
            <span className="pie-label">{s.label}</span>
            <span className="pie-value">{Math.round(s.share * 100)}% · {format(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Karty statystyk. `icon` i `tone` sa opcjonalne — bez nich komorka wyglada
 * tak jak zawsze (biale tlo). Podane razem dodaja pastelowy odcien i ikonke,
 * jak w kartach "Ten tydzien" na Starcie.
 */
export function StatRow({ items }) {
  return (
    <div className="stat-row">
      {items.map((it) => (
        <div
          className={'stat-cell' + (it.tone ? ' stat-cell--tone' : '')}
          key={it.label}
        >
          {it.icon && <span className="stat-cell-icon">{it.icon}</span>}
          <b>{it.value}</b>
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  )
}

