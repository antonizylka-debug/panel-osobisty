import { useEffect, useState } from 'react'

/**
 * Pole godziny zawsze w formacie 24-godzinnym.
 *
 * Natywne <input type="time"> bierze format z jezyka przegladarki, wiec przy
 * angielskim Chrome pokazuje 05:10 AM i nie da sie tego wymusic atrybutem.
 *
 * Jedno zwykle pole tekstowe. Wpisujesz jak wygodnie — 5:30, 530, 0530,
 * 5.30 — a po wyjsciu z pola zamienia sie na 05:30. Zadnego przeskakiwania
 * kursora miedzy polami.
 */

/** '530' -> '05:30', '5' -> '05:00', '1745' -> '17:45'. Null gdy sie nie da. */
export function parseTime(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits === '') return ''

  let h, m
  if (digits.length <= 2) {
    h = Number(digits)
    m = 0
  } else if (digits.length === 3) {
    h = Number(digits.slice(0, 1))
    m = Number(digits.slice(1))
  } else {
    h = Number(digits.slice(0, 2))
    m = Number(digits.slice(2, 4))
  }

  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h > 23 || m > 59) return null

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function TimeInput({ value, onChange, disabled, ariaLabel, placeholder = 'np. 5:30' }) {
  const [draft, setDraft] = useState(value ?? '')
  const [editing, setEditing] = useState(false)

  // Dopoki uzytkownik nie pisze, pole idzie za wartoscia z zewnatrz.
  useEffect(() => {
    if (!editing) setDraft(value ?? '')
  }, [value, editing])

  function finish() {
    setEditing(false)

    const parsed = parseTime(draft)
    if (parsed === null) {
      setDraft(value ?? '')   // nie da sie odczytac — wracamy do poprzedniej
      return
    }
    setDraft(parsed)
    if (parsed !== (value ?? '')) onChange(parsed)
  }

  return (
    <input
      className="time-input"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={draft}
      onFocus={(e) => { setEditing(true); e.target.select() }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
        if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); e.target.blur() }
      }}
    />
  )
}
