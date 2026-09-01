import { useEffect, useRef, useState } from 'react'

const PHASE_LABEL = {
  in: 'Wdech',
  hold1: 'Zatrzymaj',
  out: 'Wydech',
  hold2: 'Zatrzymaj',
}

/**
 * Sesja na pelnym ekranie: odliczanie + (opcjonalnie) prowadzony oddech.
 *
 * Czas liczymy z zegara (Date.now), nie zliczajac tyknieć interwalu —
 * setInterval w karcie w tle bywa dlawiony przez przegladarke, wiec licznik
 * oparty na tykaniu potrafilby zgubic kilka minut w 20-minutowej sesji.
 */
export default function SessionOverlay({ technique, plannedSeconds, onFinish, onCancel }) {
  const [elapsed, setElapsed] = useState(0)
  const [phase, setPhase] = useState('in')
  const [phaseLeft, setPhaseLeft] = useState(0)
  const startedAt = useRef(Date.now())

  const phases = technique.phases
  const remaining = Math.max(0, plannedSeconds - elapsed)
  const done = remaining === 0

  // Jeden zegar na wszystko: czas sesji i faza oddechu.
  useEffect(() => {
    const id = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt.current) / 1000)
      setElapsed(secs)

      if (phases) {
        const cycle = phases.in + phases.hold1 + phases.out + phases.hold2
        const t = secs % cycle
        if (t < phases.in) {
          setPhase('in'); setPhaseLeft(phases.in - t)
        } else if (t < phases.in + phases.hold1) {
          setPhase('hold1'); setPhaseLeft(phases.in + phases.hold1 - t)
        } else if (t < phases.in + phases.hold1 + phases.out) {
          setPhase('out'); setPhaseLeft(phases.in + phases.hold1 + phases.out - t)
        } else {
          setPhase('hold2'); setPhaseLeft(cycle - t)
        }
      }
    }, 200)
    return () => clearInterval(id)
  }, [phases])

  // Koniec zaplanowanego czasu — zapisujemy pelna sesje.
  useEffect(() => {
    if (done) onFinish(elapsed)
  }, [done, elapsed, onFinish])

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  // Kolo rosnie na wdechu, kurczy sie na wydechu, stoi na zatrzymaniu.
  const scale = phases
    ? phase === 'in' ? 1 - (phaseLeft / phases.in) * 0.45
      : phase === 'out' ? 0.55 + (phaseLeft / phases.out) * 0.45
      : phase === 'hold1' ? 1 : 0.55
    : 1

  return (
    <div className="meditation-overlay" role="dialog" aria-label="Sesja medytacji">
      <p className="meditation-technique">{technique.label}</p>

      <div className="meditation-stage">
        <div
          className={'meditation-circle is-' + phase}
          style={{
            transform: `scale(${scale})`,
            // Bez animacji CSS: skala jest przeliczana co 200 ms, wiec
            // dodatkowe przejscie tylko rozjezdzaloby ja z licznikiem faz.
            transition: phases ? 'transform .2s linear' : 'none',
          }}
        />
        <div className="meditation-center">
          {phases && <span className="meditation-phase">{PHASE_LABEL[phase]}</span>}
          <span className="meditation-count">{mm}:{ss}</span>
          {phases && <span className="meditation-phase-left">{Math.ceil(phaseLeft)}</span>}
        </div>
      </div>

      <div className="meditation-actions">
        <button className="btn btn-ghost" onClick={() => onCancel(elapsed)}>
          Zakończ wcześniej
        </button>
      </div>
      <p className="meditation-hint">
        Przerwana sesja też się liczy — zapiszę faktyczny czas.
      </p>
    </div>
  )
}
