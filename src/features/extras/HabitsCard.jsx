import { useState } from 'react'
import { toggleHabit, setHabitProgress, setHabitRest, habitStreak, createHabit, deactivateHabit } from './api'
import { Card, CardHead, EmptyState, Sheet, ProgressBar } from '../../components/ui'
import { IconCheck, IconRest } from '../../components/icons'

/** 1.5 -> "1,5"; 2 -> "2" (bez zbednego przecinka) */
function num(v) {
  return Number(v).toLocaleString('pl-PL', { maximumFractionDigits: 2 })
}

export default function HabitsCard({ habits, logs, today, onChanged }) {
  const [manageOpen, setManageOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  const todayLogs = new Map(
    logs.filter((l) => l.date === today).map((l) => [l.habit_id, l])
  )
  const doneCount = [...todayLogs.values()].filter((l) => l.done).length

  async function run(habitId, fn) {
    setBusy(habitId)
    setError('')
    try { await fn(); onChanged() }
    catch (err) { setError(err.message) }
    finally { setBusy(null) }
  }

  return (
    <>
      <Card>
        <CardHead
          title="Małe nawyki"
          hint={`${doneCount} z ${habits.length} dziś`}
          action={<button className="chip" onClick={() => setManageOpen(true)}>Edytuj</button>}
        />

        {error && <p className="form-error" role="alert">{error}</p>}

        {habits.length === 0 ? (
          <EmptyState>Brak nawyków — dodaj je przyciskiem Edytuj.</EmptyState>
        ) : (
          <ul className="row-list">
            {habits.map((h) => {
              const log = todayLogs.get(h.id)
              const streak = habitStreak(h.id, logs, today)
              const hasTarget = h.target != null

              const isRest = !!log?.is_rest

              if (!hasTarget) {
                const done = !!log?.done
                return (
                  <li key={h.id}>
                    <div className={'habit-row' + (done ? ' is-done' : '') + (isRest ? ' is-rest' : '')}>
                      <span className="habit-check"><IconCheck /></span>
                      <div className="row-main">
                        <span className="row-title">{h.name}</span>
                        {isRest && <span className="row-sub">Dzień odpoczynku</span>}
                      </div>
                      {streak > 0 && <span className="habit-streak">{streak} dni</span>}
                      <div className="habit-actions">
                        <button
                          className={'habit-act' + (done ? ' is-on' : '')}
                          onClick={() => run(h.id, () => toggleHabit({ habitId: h.id, date: today, done: !done }))}
                          disabled={busy === h.id}
                          aria-pressed={done}
                          aria-label={done ? 'Cofnij odhaczenie' : 'Odhacz'}
                        ><IconCheck /></button>
                        <button
                          className={'habit-act' + (isRest ? ' is-rest-on' : '')}
                          onClick={() => run(h.id, () => setHabitRest({ habitId: h.id, date: today, isRest: !isRest }))}
                          disabled={busy === h.id}
                          aria-pressed={isRest}
                          aria-label={isRest ? 'Cofnij dzień odpoczynku' : 'Dzień odpoczynku'}
                        ><IconRest /></button>
                      </div>
                    </div>
                  </li>
                )
              }

              const value = Number(log?.value ?? 0)
              const target = Number(h.target)
              const step = Number(h.step)
              const done = value >= target

              return (
                <li key={h.id}>
                  <div className={'habit-progress' + (done ? ' is-done' : '') + (isRest ? ' is-rest' : '')}>
                    <div className="habit-progress-head">
                      <span className="habit-check" aria-hidden="true"><IconCheck /></span>
                      <div className="row-main">
                        <span className="row-title">{h.name}</span>
                        <span className="row-sub">
                          {isRest ? 'Dzień odpoczynku' : (
                            <>
                              {num(value)} z {num(target)}{h.unit ? ` ${h.unit}` : ''}
                              {streak > 0 && ` · ${streak} dni z rzędu`}
                            </>
                          )}
                        </span>
                      </div>
                      <button
                        className={'habit-act' + (isRest ? ' is-rest-on' : '')}
                        onClick={() => run(h.id, () => setHabitRest({ habitId: h.id, date: today, isRest: !isRest }))}
                        disabled={busy === h.id}
                        aria-pressed={isRest}
                        aria-label={isRest ? 'Cofnij dzień odpoczynku' : 'Dzień odpoczynku'}
                      ><IconRest /></button>
                    </div>

                    <ProgressBar value={value} max={target} />

                    <div className="habit-stepper">
                      <button
                        className="stepper-btn"
                        onClick={() => run(h.id, () => setHabitProgress({
                          habitId: h.id, date: today, value: value - step, target,
                        }))}
                        disabled={busy === h.id || value <= 0}
                        aria-label={`Odejmij ${num(step)}${h.unit ? ' ' + h.unit : ''}`}
                      >−</button>

                      <span className="stepper-value">
                        {num(value)}{h.unit ? ` ${h.unit}` : ''}
                      </span>

                      <button
                        className="stepper-btn is-plus"
                        onClick={() => run(h.id, () => setHabitProgress({
                          habitId: h.id, date: today, value: value + step, target,
                        }))}
                        disabled={busy === h.id}
                        aria-label={`Dodaj ${num(step)}${h.unit ? ' ' + h.unit : ''}`}
                      >+</button>

                      {!done && (
                        <button
                          className="chip"
                          onClick={() => run(h.id, () => setHabitProgress({
                            habitId: h.id, date: today, value: target, target,
                          }))}
                          disabled={busy === h.id}
                        >Cały</button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <ManageSheet
        open={manageOpen}
        habits={habits}
        onClose={() => setManageOpen(false)}
        onChanged={onChanged}
      />
    </>
  )
}

function ManageSheet({ open, habits, onClose, onChanged }) {
  const [name, setName] = useState('')
  const [withProgress, setWithProgress] = useState(false)
  const [target, setTarget] = useState('')
  const [unit, setUnit] = useState('')
  const [step, setStep] = useState('1')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function reset() {
    setName(''); setWithProgress(false); setTarget(''); setUnit(''); setStep('1'); setError('')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Podaj nazwę nawyku.')

    let targetNum = null
    let stepNum = 1
    if (withProgress) {
      targetNum = Number(String(target).replace(',', '.'))
      stepNum = Number(String(step).replace(',', '.'))
      if (!Number.isFinite(targetNum) || targetNum <= 0) return setError('Podaj cel większy od zera.')
      if (!Number.isFinite(stepNum) || stepNum <= 0) return setError('Podaj krok większy od zera.')
    }

    setBusy(true)
    try {
      await createHabit({ name: name.trim(), target: targetNum, unit: unit.trim(), step: stepNum })
      reset()
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} title="Nawyki" onClose={() => { reset(); onClose() }}>
      <div className="stack">
        <form className="stack" onSubmit={submit}>
          <label className="field">
            <span>Nowy nawyk</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="np. Wypić 2 litry wody" />
          </label>

          <div className="switch-row">
            <div>
              <div className="switch-label">Licz postęp</div>
              <div className="switch-hint">
                Zamiast ptaszka dostaniesz pasek i przyciski − / +
              </div>
            </div>
            <button type="button" className={'switch' + (withProgress ? ' is-on' : '')}
              onClick={() => setWithProgress((v) => !v)} aria-pressed={withProgress}
              aria-label="Licz postęp" />
          </div>

          {withProgress && (
            <div className="field-grid">
              <label className="field">
                <span>Cel dzienny</span>
                <input type="text" inputMode="decimal" value={target}
                  onChange={(e) => setTarget(e.target.value)} placeholder="2" />
              </label>
              <label className="field">
                <span>Jednostka</span>
                <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
                  placeholder="l, str., km" />
              </label>
              <label className="field field-wide">
                <span>Ile dodaje jedno kliknięcie</span>
                <input type="text" inputMode="decimal" value={step}
                  onChange={(e) => setStep(e.target.value)} placeholder="0,5" />
              </label>
            </div>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Dodawanie…' : 'Dodaj'}
          </button>
        </form>

        <ul className="row-list">
          {habits.map((h) => (
            <li key={h.id}>
              <div className="row-item" style={{ cursor: 'default' }}>
                <div className="row-main">
                  <span className="row-title">{h.name}</span>
                  {h.target != null && (
                    <span className="row-sub">
                      cel {num(h.target)}{h.unit ? ` ${h.unit}` : ''} · krok {num(h.step)}
                    </span>
                  )}
                </div>
                <button className="chip" style={{ color: 'var(--danger)' }}
                  onClick={async () => { await deactivateHabit(h.id); onChanged() }}>
                  Usuń
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}
