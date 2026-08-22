import { useEffect, useState } from 'react'
import { saveMetrics, sleepHours } from './api'
import { Card, CardHead, ProgressBar } from '../../components/ui'
import { formatHours } from '../../lib/money'

const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.')))

export function SleepCard({ date, entry, onSaved }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    setStart(entry?.sleep_start?.slice(0, 5) ?? '')
    setEnd(entry?.sleep_end?.slice(0, 5) ?? '')
  }, [entry])

  const hours = sleepHours(start, end)
  const TARGET = 8

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!start || !end) return setError('Podaj obie godziny — zaśnięcie i pobudkę.')

    setSaving(true)
    try {
      await saveMetrics({ date, sleepStart: start, sleepEnd: end })
      onSaved()
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHead
        title="Sen"
        hint={entry?.sleep_hours != null ? `Zapisane · ${formatHours(entry.sleep_hours)}` : 'Brak wpisu'}
      />
      <form className="stack" onSubmit={submit}>
        <div className="field-grid">
          <label className="field">
            <span>Zasnąłem o</span>
            <input type="time" lang="pl" step="60" value={start}
              onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            <span>Wstałem o</span>
            <input type="time" lang="pl" step="60" value={end}
              onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>

        {hours != null && (
          <>
            <p className="big-number">{formatHours(hours)}</p>
            <ProgressBar
              value={Math.min(hours, TARGET)}
              max={TARGET}
              tone={hours >= 7 ? 'accent' : hours >= 6 ? 'warn' : 'danger'}
            />
            <p className="muted" style={{ marginTop: '-.4rem' }}>
              {hours >= 7
                ? 'Tyle wystarczy na regenerację.'
                : `Do ośmiu godzin brakuje ${formatHours(TARGET - hours)}.`}
            </p>
          </>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Zapisywanie…' : justSaved ? 'Zapisano ✓' : entry?.sleep_hours != null ? 'Zapisz zmianę' : 'Zapisz sen'}
        </button>
      </form>
    </Card>
  )
}

export function StepsCard({ date, entry, target = 10000, onSaved }) {
  const [steps, setSteps] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => { setSteps(entry?.steps != null ? String(entry.steps) : '') }, [entry])

  const value = num(steps)

  async function save(next) {
    setError('')
    setSaving(true)
    try {
      await saveMetrics({ date, steps: Math.max(0, Math.round(next)) })
      onSaved()
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (value == null || Number.isNaN(value) || value < 0) return setError('Podaj liczbę kroków.')
    await save(value)
  }

  const saved = entry?.steps ?? 0

  return (
    <Card>
      <CardHead
        title="Kroki"
        hint={entry?.steps != null ? `Zapisane · ${saved.toLocaleString('pl-PL')}` : 'Brak wpisu'}
      />
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Ile kroków dzisiaj</span>
          <input type="text" inputMode="numeric" value={steps} placeholder="np. 8420"
            onChange={(e) => setSteps(e.target.value)}
            style={{ fontSize: '1.5rem', fontWeight: 800 }} />
        </label>

        {/* Szybkie doliczenie spaceru bez liczenia w glowie */}
        <div className="chip-row">
          {[500, 1000, 2500, 5000].map((add) => (
            <button key={add} type="button" className="chip" disabled={saving}
              onClick={() => { const next = (value ?? saved) + add; setSteps(String(next)); save(next) }}>
              +{add.toLocaleString('pl-PL')}
            </button>
          ))}
        </div>

        {value != null && value > 0 && (
          <>
            <ProgressBar
              value={Math.min(value, target)}
              max={target}
              tone={value >= target ? 'accent' : value >= target * 0.7 ? 'warn' : 'danger'}
            />
            <p className="muted" style={{ marginTop: '-.4rem' }}>
              {value >= target
                ? `Cel ${target.toLocaleString('pl-PL')} zrobiony.`
                : `Do ${target.toLocaleString('pl-PL')} brakuje ${(target - value).toLocaleString('pl-PL')} kroków.`}
            </p>
          </>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Zapisywanie…' : justSaved ? 'Zapisano ✓' : 'Zapisz kroki'}
        </button>
      </form>
    </Card>
  )
}
