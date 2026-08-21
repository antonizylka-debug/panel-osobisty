import { useEffect, useState } from 'react'
import {
  toggleHabit, setHabitProgress, setHabitRest, habitStreak,
  createHabit, updateHabit, deactivateHabit,
} from './api'
import { Card, CardHead, EmptyState, Sheet, ProgressBar } from '../../components/ui'
import { IconCheck, IconRest } from '../../components/icons'

/** 1.5 -> "1,5"; 2 -> "2" (bez zbednego przecinka) */
function num(v) {
  return Number(v).toLocaleString('pl-PL', { maximumFractionDigits: 2 })
}
const parse = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')))

export default function HabitsCard({ habits, logs, today, onChanged }) {
  const [manageOpen, setManageOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  const todayLogs = new Map(logs.filter((l) => l.date === today).map((l) => [l.habit_id, l]))
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
              const isRest = !!log?.is_rest

              if (h.target == null) {
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

              const commit = (next) => run(h.id, () =>
                setHabitProgress({ habitId: h.id, date: today, value: next, target })
              )

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
                        onClick={() => commit(value - step)}
                        disabled={busy === h.id || value <= 0}
                        aria-label={`Odejmij ${num(step)}`}
                      >−</button>

                      <ProgressInput
                        value={value}
                        unit={h.unit}
                        disabled={busy === h.id}
                        onCommit={commit}
                      />

                      <button
                        className="stepper-btn is-plus"
                        onClick={() => commit(value + step)}
                        disabled={busy === h.id}
                        aria-label={`Dodaj ${num(step)}`}
                      >+</button>

                      {!done && (
                        <button className="chip" onClick={() => commit(target)} disabled={busy === h.id}>
                          Cały
                        </button>
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

/** Pole do wpisania dokladnej wartosci — 10 000 krokow nie da sie wyklikac. */
function ProgressInput({ value, unit, disabled, onCommit }) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => { if (!editing) setDraft(num(value)) }, [value, editing])

  function commit() {
    setEditing(false)
    const parsed = parse(draft)
    if (parsed == null || Number.isNaN(parsed) || parsed < 0) {
      setDraft(num(value))
      return
    }
    if (parsed !== value) onCommit(parsed)
  }

  return (
    <div className="stepper-field">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        onFocus={(e) => { setEditing(true); e.target.select() }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
          if (e.key === 'Escape') { setEditing(false); setDraft(num(value)); e.target.blur() }
        }}
        aria-label="Wpisz dokładną wartość"
      />
      {unit && <span className="stepper-unit">{unit}</span>}
    </div>
  )
}

function ManageSheet({ open, habits, onClose, onChanged }) {
  const [editing, setEditing] = useState(null)

  return (
    <Sheet open={open} title="Nawyki" onClose={() => { setEditing(null); onClose() }}>
      <div className="stack">
        <HabitForm
          key={editing?.id ?? 'new'}
          habit={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged() }}
        />

        <ul className="row-list">
          {habits.map((h) => (
            <li key={h.id}>
              <div className="row-item" style={{ cursor: 'default' }}>
                <div className="row-main">
                  <span className="row-title">{h.name}</span>
                  <span className="row-sub">
                    {h.target != null
                      ? `cel ${num(h.target)}${h.unit ? ` ${h.unit}` : ''} · krok ${num(h.step)}`
                      : 'zwykły ptaszek'}
                  </span>
                </div>
                <button className="chip" onClick={() => setEditing(h)}>Zmień</button>
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

function HabitForm({ habit, onCancel, onSaved }) {
  const isEdit = !!habit
  const [name, setName] = useState(habit?.name ?? '')
  const [withProgress, setWithProgress] = useState(habit?.target != null)
  const [target, setTarget] = useState(habit?.target != null ? String(habit.target) : '')
  const [unit, setUnit] = useState(habit?.unit ?? '')
  const [step, setStep] = useState(habit?.step != null ? String(habit.step) : '1')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Podaj nazwę nawyku.')

    let targetNum = null
    let stepNum = 1
    if (withProgress) {
      targetNum = parse(target)
      stepNum = parse(step)
      if (targetNum == null || !(targetNum > 0)) return setError('Podaj cel większy od zera.')
      if (stepNum == null || !(stepNum > 0)) return setError('Podaj krok większy od zera.')
    }

    setBusy(true)
    try {
      const payload = { name: name.trim(), target: targetNum, unit: unit.trim(), step: stepNum }
      if (isEdit) await updateHabit(habit.id, payload)
      else await createHabit(payload)

      if (!isEdit) { setName(''); setWithProgress(false); setTarget(''); setUnit(''); setStep('1') }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field">
        <span>{isEdit ? `Zmieniasz: ${habit.name}` : 'Nowy nawyk'}</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="np. Kroki" />
      </label>

      <div className="switch-row">
        <div>
          <div className="switch-label">Licz postęp</div>
          <div className="switch-hint">Wpisujesz konkretną liczbę zamiast odhaczać</div>
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
              onChange={(e) => setTarget(e.target.value)} placeholder="10000" />
          </label>
          <label className="field">
            <span>Jednostka</span>
            <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
              placeholder="kroków, l, str." />
          </label>
          <label className="field field-wide">
            <span>Ile dodaje jedno kliknięcie +</span>
            <input type="text" inputMode="decimal" value={step}
              onChange={(e) => setStep(e.target.value)} placeholder="500" />
          </label>
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className={isEdit ? 'onboard-actions' : ''}>
        {isEdit && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Anuluj</button>
        )}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Zapisywanie…' : isEdit ? 'Zapisz zmiany' : 'Dodaj'}
        </button>
      </div>
    </form>
  )
}
