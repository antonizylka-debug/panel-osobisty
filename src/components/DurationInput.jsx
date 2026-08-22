import { useEffect, useState } from 'react'
import { hoursToClock, clockToHours } from '../lib/money'

/**
 * Pole czasu trwania w zapisie H:MM — 7 h 20 min wpisujesz jako 7:20,
 * a nie jako 7,33. Przyjmuje tez zapis dziesietny (7,5), bo czasem tak
 * jest szybciej, i pokazuje go potem jako 7:30.
 *
 * value / onChange operuja na godzinach dziesietnych, bo tak trzyma je baza.
 */
export default function DurationInput({ value, onChange, disabled, placeholder = 'np. 7:20', ariaLabel }) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(hoursToClock(value))
  }, [value, editing])

  function finish() {
    setEditing(false)

    const parsed = clockToHours(draft)
    if (parsed === null || (parsed !== '' && parsed > 24)) {
      setDraft(hoursToClock(value))   // nieczytelne albo ponad dobe
      return
    }
    setDraft(hoursToClock(parsed))
    if (parsed !== value) onChange(parsed)
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
        if (e.key === 'Escape') { setDraft(hoursToClock(value)); setEditing(false); e.target.blur() }
      }}
    />
  )
}
