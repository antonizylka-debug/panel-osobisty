import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchWeeklyReview, saveWeeklyReview } from './api'
import { fetchRange } from '../work/api'
import { fetchExpenses } from '../expenses/api'
import { fetchMoodHistory } from '../gratitude/api'
import { todayISO, addDaysISO, isoDate, formatDatePl } from '../../lib/date'
import { formatPLN, formatHours } from '../../lib/money'
import { Card, CardHead, StatRow } from '../../components/ui'

function mondayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = (date.getDay() + 6) % 7
  return isoDate(new Date(y, m - 1, d - dow))
}

export default function WeeklyReviewPage() {
  const today = todayISO()
  const [weekStart, setWeekStart] = useState(() => mondayOf(today))
  const [review, setReview] = useState(null)
  const [wentWell, setWentWell] = useState('')
  const [wouldChange, setWouldChange] = useState('')
  const [nextPriority, setNextPriority] = useState('')
  const [numbers, setNumbers] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  const weekEnd = useMemo(() => addDaysISO(weekStart, 6), [weekStart])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rev, days, expenses, moods] = await Promise.all([
        fetchWeeklyReview(weekStart),
        fetchRange(weekStart, weekEnd),
        fetchExpenses({ from: weekStart, to: weekEnd }),
        fetchMoodHistory(weekStart),
      ])
      setReview(rev)
      setWentWell(rev?.went_well ?? '')
      setWouldChange(rev?.would_change ?? '')
      setNextPriority(rev?.next_priority ?? '')

      const hours = days.reduce((s, d) => s + Number(d.hours_worked ?? 0), 0)
      const pay = days.reduce((s, d) => s + Number(d.pay_amount ?? 0), 0)
      const spent = expenses.reduce((s, e) => s + Number(e.amount), 0)
      setNumbers({
        hours, pay, spent,
        balance: pay - spent,
        entries: moods.filter((m) => m.date >= weekStart && m.date <= weekEnd).length,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [weekStart, weekEnd])

  useEffect(() => { load() }, [load])

  async function submit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const saved = await saveWeeklyReview({ weekStart, wentWell, wouldChange, nextPriority })
      setReview(saved)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-pad">
      <h1 className="page-title">Przegląd tygodnia</h1>
      <p className="page-lede">{formatDatePl(weekStart)} – {formatDatePl(weekEnd)}</p>

      <div className="action-bar">
        <button className="btn btn-ghost" onClick={() => setWeekStart(addDaysISO(weekStart, -7))}>
          ← Poprzedni
        </button>
        <button className="btn btn-ghost" disabled={weekStart >= mondayOf(today)}
          onClick={() => setWeekStart(addDaysISO(weekStart, 7))}>
          Następny →
        </button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {numbers && (
        <>
          <StatRow items={[
            { label: 'godzin', value: Math.round(numbers.hours) },
            { label: 'dniówki', value: formatPLN(numbers.pay, { short: true }) },
            { label: 'wydatki', value: formatPLN(numbers.spent, { short: true }) },
          ]} />
          <Card>
            <CardHead title="Bilans tygodnia" hint={`${numbers.entries} wpisów wdzięczności`} />
            <p className={'big-number ' + (numbers.balance >= 0 ? 'is-positive' : 'is-negative')}>
              {formatPLN(numbers.balance)}
            </p>
            <p className="muted" style={{ marginTop: '.3rem' }}>
              Przepracowane {formatHours(numbers.hours)}
            </p>
          </Card>
        </>
      )}

      <Card>
        <CardHead title="Twoje podsumowanie" hint={review ? 'Zapisane' : 'Jeszcze nieuzupełnione'} />
        <form className="stack" onSubmit={submit}>
          <label className="field">
            <span>Co poszło dobrze</span>
            <textarea rows={3} value={wentWell} onChange={(e) => setWentWell(e.target.value)} />
          </label>
          <label className="field">
            <span>Co bym zmienił</span>
            <textarea rows={3} value={wouldChange} onChange={(e) => setWouldChange(e.target.value)} />
          </label>
          <label className="field">
            <span>Priorytet na przyszły tydzień</span>
            <input type="text" value={nextPriority} onChange={(e) => setNextPriority(e.target.value)} />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={saving || loading}>
            {saving ? 'Zapisywanie…' : justSaved ? 'Zapisano ✓' : 'Zapisz przegląd'}
          </button>
        </form>
      </Card>
    </div>
  )
}
