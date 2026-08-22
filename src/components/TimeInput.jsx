import { useEffect, useRef, useState } from 'react'

/**
 * Pole godziny zawsze w formacie 24-godzinnym.
 *
 * Natywne <input type="time"> bierze format z jezyka przegladarki, wiec przy
 * angielskim Chrome pokazuje 05:10 AM i nie da sie tego wymusic atrybutem.
 * Dwa pola HH : MM sa jednoznaczne niezaleznie od ustawien systemu, a na
 * telefonie i tak otwieraja klawiature numeryczna.
 *
 * value / onChange operuja na 'HH:MM' albo pustym stringu.
 */
export default function TimeInput({ value, onChange, disabled, ariaLabel }) {
  const [h, setH] = useState('')
  const [m, setM] = useState('')
  const [editing, setEditing] = useState(false)
  const minuteRef = useRef(null)

  // Dopoki uzytkownik nie pisze, pole idzie za wartoscia z zewnatrz.
  useEffect(() => {
    if (editing) return
    const [hh = '', mm = ''] = (value ?? '').split(':')
    setH(hh)
    setM(mm)
  }, [value, editing])

  function emit(nextH, nextM) {
    if (nextH === '' && nextM === '') return onChange('')
    if (nextH === '' || nextM === '') return
    onChange(`${nextH.padStart(2, '0')}:${nextM.padStart(2, '0')}`)
  }

  function handleHours(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 2)
    if (digits === '') { setH(''); emit('', m); return }

    let next = digits
    if (Number(next) > 23) next = '23'
    setH(next)

    // Po dwoch cyfrach albo po cyfrze, ktora nie moze zaczynac godziny
    // dwucyfrowej (3-9), przeskakujemy do minut.
    if (next.length === 2 || Number(next[0]) > 2) {
      minuteRef.current?.focus()
      minuteRef.current?.select()
    }
    emit(next, m)
  }

  function handleMinutes(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 2)
    if (digits === '') { setM(''); emit(h, ''); return }

    let next = digits
    if (Number(next) > 59) next = '59'
    setM(next)
    emit(h, next)
  }

  function finish() {
    setEditing(false)
    if (h === '' && m === '') { onChange(''); return }

    const hh = (h === '' ? '0' : h).padStart(2, '0')
    const mm = (m === '' ? '0' : m).padStart(2, '0')
    setH(hh)
    setM(mm)
    onChange(`${hh}:${mm}`)
  }

  const common = {
    type: 'text',
    inputMode: 'numeric',
    disabled,
    onFocus: (e) => { setEditing(true); e.target.select() },
    onBlur: finish,
    onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur() } },
  }

  return (
    <div className="time-input" role="group" aria-label={ariaLabel}>
      <input
        {...common}
        className="time-part"
        value={h}
        placeholder="--"
        aria-label="Godzina"
        onChange={(e) => handleHours(e.target.value)}
      />
      <span className="time-sep" aria-hidden="true">:</span>
      <input
        {...common}
        ref={minuteRef}
        className="time-part"
        value={m}
        placeholder="--"
        aria-label="Minuty"
        onChange={(e) => handleMinutes(e.target.value)}
      />
    </div>
  )
}
