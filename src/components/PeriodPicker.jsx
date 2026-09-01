import { useEffect, useRef, useState } from 'react'
import { usePeriod } from '../features/period/PeriodContext'
import { PERIOD_PRESETS, formatRange, periodLabel } from '../lib/period'
import { todayISO } from '../lib/date'
import { IconChevronDown } from './icons'

/**
 * Wybor zakresu dat — presety + zakres wlasny.
 * Ten sam komponent na Wydatkach, Przychodach i Godzinach; zmiana tutaj
 * przestawia wszystkie trzy ekrany naraz (stan siedzi w PeriodContext).
 */
export default function PeriodPicker() {
  const { period, setPeriod, range } = usePeriod()
  const [open, setOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(range.from)
  const [customTo, setCustomTo] = useState(range.to)
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

  // Po otwarciu pola zakresu wlasnego startuja od aktualnie widocznego okresu,
  // zeby dalo sie go doprecyzowac zamiast wpisywac obie daty od zera.
  useEffect(() => {
    if (open) { setCustomFrom(range.from); setCustomTo(range.to) }
  }, [open, range.from, range.to])

  function applyCustom() {
    if (!customFrom || !customTo) return
    setPeriod({ preset: 'custom', from: customFrom, to: customTo })
    setOpen(false)
  }

  return (
    <div className="period" ref={boxRef}>
      <button
        type="button"
        className="period-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Okres: ${periodLabel(period)}, ${formatRange(range)}`}
      >
        <span className="period-trigger-text">
          <span className="period-trigger-label">{periodLabel(period)}</span>
          <span className="period-trigger-range">{formatRange(range)}</span>
        </span>
        <IconChevronDown className="period-chevron" />
      </button>

      {open && (
        <div className="period-popover" role="dialog" aria-label="Wybierz okres">
          <span className="period-section">Szybki wybór</span>
          <div className="period-presets">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={'period-option' + (period.preset === p.value ? ' is-active' : '')}
                onClick={() => { setPeriod({ preset: p.value }); setOpen(false) }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <span className="period-section">Zakres własny</span>
          <div className="period-custom">
            <label className="field">
              <span>Od</span>
              <input type="date" value={customFrom} max={todayISO()}
                onChange={(e) => setCustomFrom(e.target.value)} />
            </label>
            <label className="field">
              <span>Do</span>
              <input type="date" value={customTo} max={todayISO()}
                onChange={(e) => setCustomTo(e.target.value)} />
            </label>
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={applyCustom}>
            Pokaż ten zakres
          </button>
        </div>
      )}
    </div>
  )
}
