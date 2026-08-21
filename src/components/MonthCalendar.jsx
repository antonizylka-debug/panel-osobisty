import { useMemo, useState } from 'react'
import { todayISO, isoDate } from '../lib/date'

const DOW = ['pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.', 'niedz.']
const MONTH_FMT = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' })

/**
 * Siatka miesiaca z zaznaczonymi dniami, w ktorych cos zapisano.
 *
 * marks: Map<'YYYY-MM-DD', string[]>  — lista etykiet dla danego dnia
 * onSelect: (iso, labels) => void     — klikniecie zapisanego dnia
 */
export default function MonthCalendar({ marks, onSelect, legend }) {
  const today = todayISO()
  const [cursor, setCursor] = useState(() => today.slice(0, 7))

  const [year, month] = cursor.split('-').map(Number)

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1)
    const daysInMonth = new Date(year, month, 0).getDate()
    const leading = (first.getDay() + 6) % 7 // poniedzialek pierwszy

    const out = []
    for (let i = 0; i < leading; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) out.push(isoDate(new Date(year, month - 1, d)))
    return out
  }, [year, month])

  const filledCount = cells.filter((iso) => iso && marks.has(iso)).length
  const atCurrentMonth = cursor >= today.slice(0, 7)

  function shift(delta) {
    const d = new Date(year, month - 1 + delta, 1)
    setCursor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div>
      <div className="cal-head">
        <div>
          <div className="cal-title">{MONTH_FMT.format(new Date(year, month - 1, 1))}</div>
          <div className="cal-sub">{filledCount} zapisanych dni</div>
        </div>
        <div className="cal-nav">
          <button onClick={() => shift(-1)} aria-label="Poprzedni miesiąc">‹</button>
          <button onClick={() => shift(1)} disabled={atCurrentMonth} aria-label="Następny miesiąc">›</button>
        </div>
      </div>

      <div className="cal-grid">
        {DOW.map((d) => <div className="cal-dow" key={d}>{d}</div>)}

        {cells.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} />

          const labels = marks.get(iso)
          const filled = !!labels?.length
          const isToday = iso === today
          const isFuture = iso > today

          return (
            <button
              key={iso}
              type="button"
              className={
                'cal-cell'
                + (filled ? ' is-filled' : '')
                + (isToday ? ' is-today' : '')
                + (isFuture ? ' is-future' : '')
              }
              onClick={filled && onSelect ? () => onSelect(iso, labels) : undefined}
              disabled={!filled || !onSelect}
              title={filled ? labels.join(', ') : undefined}
            >
              <span>{Number(iso.slice(8))}</span>
              {filled && <span className="cal-dot" />}
            </button>
          )
        })}
      </div>

      {legend && <div className="cal-legend">{legend}</div>}
    </div>
  )
}
