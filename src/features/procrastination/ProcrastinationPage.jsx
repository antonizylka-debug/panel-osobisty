import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EMOTIONS, EMOTION_LABEL, fetchSessions, createSession, updateSession } from './api'
import { formatDatePl } from '../../lib/date'
import { Card, CardHead, EmptyState, BarChart, Sheet } from '../../components/ui'

const TIMER_CHOICES = [10, 15, 25]

export default function ProcrastinationPage() {
  const [sessions, setSessions] = useState([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [patternsOpen, setPatternsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setSessions(await fetchSessions()) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Nieukonczone zadania po prostu wracaja na liste — bez licznika porazek.
  const openTasks = useMemo(() => sessions.filter((s) => !s.completed), [sessions])
  const doneCount = sessions.filter((s) => s.completed).length

  const emotionCounts = useMemo(() => {
    const counts = new Map()
    for (const s of sessions) {
      if (!s.emotion) continue
      counts.set(s.emotion, (counts.get(s.emotion) ?? 0) + 1)
    }
    return EMOTIONS
      .map((e) => ({ label: e.label, value: counts.get(e.value) ?? 0 }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [sessions])

  if (loading) return <div className="page-pad"><p className="page-lede">Wczytywanie…</p></div>

  return (
    <div className="page-pad">
      <h1 className="page-title">Zrób to teraz</h1>
      <p className="page-lede">
        Prokrastynacja to unikanie emocji, nie lenistwo. Cztery pytania i ruszasz.
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="action-bar">
        <button className="btn btn-primary" onClick={() => setWizardOpen(true)}>Coś odkładam</button>
        <button className="btn btn-ghost" onClick={() => setPatternsOpen(true)}>Moje wzorce</button>
      </div>

      <Card>
        <CardHead
          title="Wróciły na listę"
          hint={openTasks.length ? `${openTasks.length} czeka` : 'Nic nie czeka'}
        />
        {openTasks.length === 0 ? (
          <EmptyState>Czysto. Jak coś zaczniesz odkładać, wróć tutaj.</EmptyState>
        ) : (
          <ul className="row-list">
            {openTasks.map((s) => (
              <OpenTaskRow key={s.id} session={s} onChanged={load} />
            ))}
          </ul>
        )}
      </Card>

      {doneCount > 0 && (
        <Card>
          <CardHead title="Domknięte" hint={`${doneCount} zadań`} />
          <ul className="entry-list">
            {sessions.filter((s) => s.completed).slice(0, 8).map((s) => (
              <li key={s.id} className="entry">
                <div className="entry-head">
                  <span className="row-title">{s.task}</span>
                  <span className="badge is-accent">{s.rounds} × {s.timer_minutes} min</span>
                </div>
                <span className="row-sub">
                  {formatDatePl(s.created_at.slice(0, 10))}
                  {s.emotion && ` · ${EMOTION_LABEL[s.emotion]}`}
                </span>
                {s.reward && <p className="entry-reflection">Nagroda: {s.reward}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <WizardSheet
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onDone={() => { setWizardOpen(false); load() }}
      />

      <Sheet open={patternsOpen} title="Moje wzorce" onClose={() => setPatternsOpen(false)}>
        {emotionCounts.length === 0 ? (
          <EmptyState>Za mało danych — wróć po kilku sesjach.</EmptyState>
        ) : (
          <div className="stack">
            <p className="muted">Co najczęściej Cię blokuje:</p>
            <BarChart data={emotionCounts} height={110} format={(v) => `${v}×`} />
            <p className="muted">
              Najczęstsza emocja: <strong>{emotionCounts[0].label}</strong>.
              {' '}Rada na nią: {EMOTIONS.find((e) => e.label === emotionCounts[0].label)?.advice}
            </p>
          </div>
        )}
      </Sheet>
    </div>
  )
}

function OpenTaskRow({ session, onChanged }) {
  const [timerOpen, setTimerOpen] = useState(false)

  return (
    <>
      <li>
        <button className="row-item" onClick={() => setTimerOpen(true)}>
          <div className="row-main">
            <span className="row-title">{session.task}</span>
            <span className="row-sub">
              {session.micro_step ? `Pierwszy krok: ${session.micro_step}` : 'Zacznij od małego kroku'}
            </span>
          </div>
          <span className="badge is-accent">Start</span>
        </button>
      </li>
      {timerOpen && (
        <TimerOverlay
          session={session}
          onClose={() => setTimerOpen(false)}
          onFinished={() => { setTimerOpen(false); onChanged() }}
        />
      )}
    </>
  )
}

function WizardSheet({ open, onClose, onDone }) {
  const [step, setStep] = useState(1)
  const [task, setTask] = useState('')
  const [emotion, setEmotion] = useState(null)
  const [microStep, setMicroStep] = useState('')
  const [when, setWhen] = useState('')
  const [where, setWhere] = useState('')
  const [what, setWhat] = useState('')
  const [minutes, setMinutes] = useState(25)
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setStep(1); setTask(''); setEmotion(null); setMicroStep('')
    setWhen(''); setWhere(''); setWhat(''); setMinutes(25)
    setSession(null); setError('')
  }

  const advice = EMOTIONS.find((e) => e.value === emotion)?.advice

  async function start() {
    setError('')
    setSaving(true)
    try {
      const created = await createSession({
        task: task.trim(),
        emotion,
        micro_step: microStep.trim() || null,
        if_then_when: when || null,
        if_then_where: where.trim() || null,
        if_then_what: what.trim() || null,
        timer_minutes: minutes,
      })
      setSession(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (session) {
    return (
      <TimerOverlay
        session={session}
        onClose={() => { reset(); onDone() }}
        onFinished={() => { reset(); onDone() }}
      />
    )
  }

  return (
    <Sheet open={open} title="Zrób to teraz" onClose={() => { reset(); onClose() }}>
      <div className="wizard-progress" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={'wizard-dot' + (n <= step ? ' is-done' : '')} />
        ))}
      </div>

      {step === 1 && (
        <div className="stack">
          <label className="field">
            <span>Co odkładam?</span>
            <input type="text" value={task} onChange={(e) => setTask(e.target.value)}
              placeholder="np. zadzwonić w sprawie faktury" autoFocus />
          </label>
          <button className="btn btn-primary btn-block" disabled={!task.trim()} onClick={() => setStep(2)}>
            Dalej
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <span className="field-label">Co czuję?</span>
          <div className="emotion-grid">
            {EMOTIONS.map((e) => (
              <button key={e.value} type="button"
                className={'emotion-tile' + (emotion === e.value ? ' is-selected' : '')}
                onClick={() => setEmotion(e.value)}>
                {e.label}
              </button>
            ))}
          </div>
          {advice && <p className="emotion-advice">{advice}</p>}
          <div className="onboard-actions">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>Wstecz</button>
            <button className="btn btn-primary" disabled={!emotion} onClick={() => setStep(3)}>Dalej</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <label className="field">
            <span>Pierwszy krok (max 2 minuty)</span>
            <input type="text" value={microStep} onChange={(e) => setMicroStep(e.target.value)}
              placeholder="np. otworzyć plik i napisać 3 zdania" autoFocus />
          </label>

          <span className="field-label">Plan jeśli–to</span>
          <p className="muted" style={{ marginTop: '-.5rem' }}>
            „Jeśli jest 19:00 i siedzę przy biurku, to otworzę plik i napiszę 3 zdania”
          </p>
          <div className="field-grid">
            <label className="field">
              <span>Kiedy</span>
              <input type="time" value={when} onChange={(e) => setWhen(e.target.value)} />
            </label>
            <label className="field">
              <span>Gdzie</span>
              <input type="text" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="przy biurku" />
            </label>
            <label className="field field-wide">
              <span>Co zrobię</span>
              <input type="text" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="otworzę plik" />
            </label>
          </div>

          <div className="onboard-actions">
            <button className="btn btn-ghost" onClick={() => setStep(2)}>Wstecz</button>
            <button className="btn btn-primary" onClick={() => setStep(4)}>Dalej</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="stack">
          <label className="field">
            <span>Ile minut?</span>
            <div className="segmented" role="group">
              {TIMER_CHOICES.map((m) => (
                <button key={m} type="button"
                  className={'segmented-item' + (minutes === m ? ' is-active' : '')}
                  onClick={() => setMinutes(m)}>{m} min</button>
              ))}
            </div>
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="btn btn-primary btn-block" onClick={start} disabled={saving}
            style={{ fontSize: '1.05rem', minHeight: 60 }}>
            {saving ? 'Startuję…' : 'ZACZYNAM TERAZ'}
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => setStep(3)}>Wstecz</button>
        </div>
      )}
    </Sheet>
  )
}

function TimerOverlay({ session, onClose, onFinished }) {
  const [remaining, setRemaining] = useState(session.timer_minutes * 60)
  const [phase, setPhase] = useState('running')
  const [reward, setReward] = useState(session.reward ?? '')
  const [saving, setSaving] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (phase !== 'running') return
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current)
          setPhase('finished')
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [phase])

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  async function complete() {
    setSaving(true)
    try {
      await updateSession(session.id, { completed: true, reward: reward.trim() || null })
      onFinished()
    } finally { setSaving(false) }
  }

  async function anotherRound() {
    setSaving(true)
    try {
      await updateSession(session.id, { rounds: session.rounds + 1 })
      session.rounds += 1
      setRemaining(session.timer_minutes * 60)
      setPhase('running')
    } finally { setSaving(false) }
  }

  return (
    <div className="timer-overlay" role="dialog" aria-label="Timer">
      {phase === 'running' ? (
        <>
          <p className="timer-task">{session.task}</p>
          <p className="timer-count">{mm}:{ss}</p>
          <div className="timer-actions">
            <button className="btn btn-ghost" onClick={onClose}>Przerwij</button>
          </div>
        </>
      ) : (
        <>
          <p className="timer-task">{session.task}</p>
          <p className="timer-count">✓</p>
          <div style={{ width: '100%', maxWidth: 340 }}>
            <label className="field">
              <span style={{ color: 'inherit' }}>Mini-nagroda</span>
              <input type="text" value={reward} onChange={(e) => setReward(e.target.value)}
                placeholder="np. kawa i 10 minut przerwy"
                style={{ background: 'rgba(255,255,255,.14)', color: 'inherit' }} />
            </label>
          </div>
          <div className="timer-actions">
            <button className="btn btn-ghost" onClick={anotherRound} disabled={saving}>
              Jeszcze jedna runda
            </button>
            <button className="btn btn-primary" onClick={complete} disabled={saving}
              style={{ background: '#fff', color: '#14171A' }}>
              Zrobione
            </button>
          </div>
        </>
      )}
    </div>
  )
}
