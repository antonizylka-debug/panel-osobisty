import { useEffect, useRef, useState } from 'react'
import { useTheme, ACCENTS } from '../theme/ThemeContext'

/** Kropka koloru w naglowku — kolor zmienia sie na miejscu, bez wchodzenia w Ustawienia. */
export default function AccentMenu() {
  const { accent, setAccent } = useTheme()
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

  const current = ACCENTS.find((a) => a.value === accent) ?? ACCENTS[0]

  return (
    <div className="accent-menu" ref={boxRef}>
      <button
        className="theme-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Kolor akcentu: ${current.label}`}
        aria-expanded={open}
      >
        <span className="accent-dot" style={{ background: 'var(--accent)' }} />
      </button>

      {open && (
        <div className="accent-popover" role="menu">
          <span className="accent-popover-title">Kolor akcentu</span>
          <div className="accent-popover-grid">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                type="button"
                role="menuitemradio"
                aria-checked={accent === a.value}
                className={'accent-chip' + (accent === a.value ? ' is-active' : '')}
                title={a.label}
                onClick={() => { setAccent(a.value); setOpen(false) }}
              >
                <span style={{ background: a.swatch }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
