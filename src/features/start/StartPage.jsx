import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchMainGoal, fetchSavingsGoal, saveSavingsGoal, saveMainGoal,
  quoteOfTheDay, fetchYearAgo, fetchLatestBusinessIdea,
} from './api'
import { fetchQuotes, fetchHabits, fetchHabitLogs, fetchDailyPlan, habitStreak } from '../extras/api'
import HabitsCard from '../extras/HabitsCard'
import DailyPlanCard from '../extras/DailyPlanCard'
import { fetchRange } from '../work/api'
import { fetchExpenses, fetchBudgets } from '../expenses/api'
import { fetchEntry, fetchMoodHistory } from '../gratitude/api'
import { fetchDebts, fetchPayments, upcomingPayments } from '../debts/api'
import { todayISO, addDaysISO, isoDate, formatDatePl } from '../../lib/date'
import { formatPLN, formatHours, parseAmount } from '../../lib/money'
import { Card, CardHead, ProgressBar, StatRow, EmptyState, Sheet } from '../../components/ui'

function monthStart(iso) { return iso.slice(0, 8) + '01' }

export default function StartPage() {
  const today = todayISO()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showFavoriteQuote, setShowFavoriteQuote] = useState(false)
  const [savingsOpen, setSavingsOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const monthFrom = monthStart(today)
      const [
        goal, savings, quotes, habits, habitLogs, plan,
        workDays, expenses, budgets, gratitudeToday, moods,
        debts, payments, yearAgo, idea,
      ] = await Promise.all([
        fetchMainGoal(), fetchSavingsGoal(), fetchQuotes(),
        fetchHabits(), fetchHabitLogs(addDaysISO(today, -60)), fetchDailyPlan(today),
        fetchRange(monthFrom, today), fetchExpenses({ from: monthFrom, to: today }),
        fetchBudgets(monthFrom), fetchEntry(today), fetchMoodHistory(addDaysISO(today, -30)),
        fetchDebts(), fetchPayments(), fetchYearAgo(today), fetchLatestBusinessIdea(),
      ])
      setData({
        goal, savings, quotes, habits, habitLogs, plan,
        workDays, expenses, budgets, gratitudeToday, moods,
        debts, payments, yearAgo, idea,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => { load() }, [load])

  const derived = useMemo(() => {
    if (!data) return null

    const pay = data.workDays.reduce((s, d) => s + Number(d.pay_amount ?? 0), 0)
    const spent = data.expenses.reduce((s, e) => s + Number(e.amount), 0)
    const activeDebts = data.debts.filter((d) => d.active)
    const installments = activeDebts.reduce((s, d) => s + Number(d.monthly_payment), 0)

    const now = new Date()
    const dow = (now.getDay() + 6) % 7
    const monday = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow))
    const weekDays = data.workDays.filter((d) => d.date >= monday)
    const weekExpenses = data.expenses.filter((e) => e.date >= monday)

    const workedToday = data.workDays.find((d) => d.date === today)
    const overall = data.budgets.find((b) => !b.category)

    const selfCareStreak = data.habits.length
      ? Math.max(...data.habits.map((h) => habitStreak(h.id, data.habitLogs, today)))
      : 0

    return {
      balance: pay - spent - installments,
      monthPay: pay,
      monthSpent: spent,
      installments,
      weekHours: weekDays.reduce((s, d) => s + Number(d.hours_worked ?? 0), 0),
      weekBusiness: weekDays.reduce((s, d) => s + Number(d.business_hours ?? 0), 0),
      weekPersonal: weekDays.reduce((s, d) => s + Number(d.personal_hours ?? 0), 0),
      weekPay: weekDays.reduce((s, d) => s + Number(d.pay_amount ?? 0), 0),
      weekSpent: weekExpenses.reduce((s, e) => s + Number(e.amount), 0),
      workedToday,
      overall,
      lastMood: [...data.moods].reverse().find((m) => m.mood != null),
      selfCareStreak,
      upcoming: upcomingPayments(activeDebts, data.payments, today),
    }
  }, [data, today])

  if (loading) return <div className="page-pad"><p className="page-lede">Wczytywanie…</p></div>
  if (error) return <div className="page-pad"><p className="form-error" role="alert">{error}</p></div>

  const quote = quoteOfTheDay(data.quotes, today)
  const favoriteQuotes = data.quotes.filter((q) => q.is_favorite)
  const shownQuote = showFavoriteQuote && favoriteQuotes.length
    ? favoriteQuotes[Math.floor(Math.random() * favoriteQuotes.length)]
    : quote

  return (
    <div className="page-pad">
      {shownQuote && (
        <Card>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.45 }}>
            {shownQuote.text}
          </p>
          {shownQuote.author && (
            <p className="muted" style={{ marginTop: '.5rem', fontWeight: 700 }}>— {shownQuote.author}</p>
          )}
          {favoriteQuotes.length > 0 && (
            <button className="chip mt-1" onClick={() => setShowFavoriteQuote((v) => !v)}>
              {showFavoriteQuote ? 'Pokaż cytat dnia' : 'Pokaż losowy ulubiony'}
            </button>
          )}
        </Card>
      )}

      {derived.upcoming.length > 0 && (
        <Card>
          <CardHead title="Zbliża się rata" />
          {derived.upcoming.map(({ debt, daysLeft }) => (
            <p key={debt.id} className="converter" style={{ marginBottom: '.5rem' }}>
              {debt.name} · {formatPLN(debt.monthly_payment)} ·{' '}
              {daysLeft === 0 ? 'dzisiaj' : daysLeft === 1 ? 'jutro' : `za ${daysLeft} dni`}
            </p>
          ))}
          <Link className="chip" to="/wydatki">Otwórz spłaty</Link>
        </Card>
      )}

      <Card>
        <CardHead
          title="Bilans miesiąca"
          hint="Dniówki minus wydatki minus raty"
          action={<Link className="chip" to="/wydatki">Szczegóły</Link>}
        />
        <p className={'big-number ' + (derived.balance >= 0 ? 'is-positive' : 'is-negative')}>
          {formatPLN(derived.balance)}
        </p>
        <p className="muted" style={{ marginTop: '.4rem' }}>
          {formatPLN(derived.monthPay, { short: true })} zarobione ·{' '}
          {formatPLN(derived.monthSpent, { short: true })} wydane ·{' '}
          {formatPLN(derived.installments, { short: true })} raty
        </p>
      </Card>

      <Card>
        <CardHead
          title="Dzisiaj"
          action={<Link className="chip" to="/szukaj">Szukaj</Link>}
        />
        <ul className="row-list">
          <li>
            <Link className="row-item" to="/wdziecznosc">
              <div className="row-main">
                <span className="row-title">Wdzięczność</span>
                <span className="row-sub">
                  {data.gratitudeToday ? 'Zapisane ✓' : 'Jeszcze nie dodałeś'}
                </span>
              </div>
              <span className={'badge' + (data.gratitudeToday ? ' is-accent' : '')}>
                {data.gratitudeToday ? 'Gotowe' : 'Dodaj'}
              </span>
            </Link>
          </li>
          <li>
            <Link className="row-item" to="/godziny-pracy">
              <div className="row-main">
                <span className="row-title">Godziny pracy</span>
                <span className="row-sub">
                  {derived.workedToday
                    ? `Zapisane · ${formatHours(derived.workedToday.hours_worked)}`
                    : 'Jeszcze nie zapisałeś'}
                </span>
              </div>
              <span className={'badge' + (derived.workedToday ? ' is-accent' : '')}>
                {derived.workedToday ? 'Gotowe' : 'Zapisz'}
              </span>
            </Link>
          </li>
        </ul>
      </Card>

      <DailyPlanCard plan={data.plan} date={today} onChanged={load} />

      <StatRow items={[
        { label: 'godzin w tyg.', value: Math.round(derived.weekHours) },
        { label: 'dniówki', value: formatPLN(derived.weekPay, { short: true }) },
        { label: 'wydatki', value: formatPLN(derived.weekSpent, { short: true }) },
      ]} />

      <Card>
        <CardHead title="Na co szedł czas" hint="Ten tydzień" />
        <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
          {formatHours(derived.weekHours)} za pieniądze · {formatHours(derived.weekBusiness)} na własny biznes ·{' '}
          {formatHours(derived.weekPersonal)} dla siebie
        </p>
      </Card>

      {derived.overall && (
        <Card>
          <CardHead title="Budżet miesiąca" hint={`Limit ${formatPLN(derived.overall.limit_amount)}`} />
          <ProgressBar
            value={derived.monthSpent}
            max={Number(derived.overall.limit_amount)}
            tone={
              derived.monthSpent / Number(derived.overall.limit_amount) >= 1 ? 'danger'
                : derived.monthSpent / Number(derived.overall.limit_amount) >= 0.8 ? 'warn' : 'accent'
            }
          />
          <p className="muted" style={{ marginTop: '.4rem' }}>
            {formatPLN(derived.monthSpent)} z {formatPLN(derived.overall.limit_amount)}
          </p>
        </Card>
      )}

      <Card>
        <CardHead
          title="Główny cel"
          action={<button className="chip" onClick={() => setGoalOpen(true)}>
            {data.goal ? 'Zmień' : 'Ustaw'}
          </button>}
        />
        {data.goal ? (
          <>
            <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>{data.goal.title}</p>
            {data.goal.description && <p className="muted" style={{ marginTop: '.3rem' }}>{data.goal.description}</p>}
            {data.goal.progress_target && (
              <div className="mt-1">
                <ProgressBar value={Number(data.goal.progress_current)} max={Number(data.goal.progress_target)} />
                <p className="muted" style={{ marginTop: '.4rem' }}>
                  {data.goal.progress_current} z {data.goal.progress_target}
                </p>
              </div>
            )}
          </>
        ) : (
          <EmptyState>Nie masz ustawionego głównego celu.</EmptyState>
        )}
      </Card>

      <Card>
        <CardHead
          title="Cel oszczędnościowy"
          action={<button className="chip" onClick={() => setSavingsOpen(true)}>
            {data.savings ? 'Zmień' : 'Ustaw'}
          </button>}
        />
        {data.savings ? (
          <>
            <p style={{ margin: 0, fontWeight: 700 }}>{data.savings.title}</p>
            <div className="mt-1">
              <ProgressBar
                value={Number(data.savings.current_amount)}
                max={Number(data.savings.target_amount)}
              />
              <p className="muted" style={{ marginTop: '.4rem' }}>
                {formatPLN(data.savings.current_amount)} z {formatPLN(data.savings.target_amount)} ·
                brakuje {formatPLN(Math.max(0, Number(data.savings.target_amount) - Number(data.savings.current_amount)))}
              </p>
            </div>
          </>
        ) : (
          <EmptyState>Ustaw, ile chcesz uzbierać na start biznesu.</EmptyState>
        )}
      </Card>

      <HabitsCard habits={data.habits} logs={data.habitLogs} today={today} onChanged={load} />

      <StatRow items={[
        { label: 'ostatni nastrój', value: derived.lastMood?.mood ? `${derived.lastMood.mood}/5` : '—' },
        { label: 'dbam o siebie', value: `${derived.selfCareStreak} dni` },
      ]} />

      {data.idea && (
        <Card>
          <CardHead title="Ostatni pomysł na biznes" action={<Link className="chip" to="/mysli-i-cele">Otwórz</Link>} />
          <p style={{ margin: 0, fontWeight: 700 }}>{data.idea.title || data.idea.content?.slice(0, 80)}</p>
          {data.idea.next_step && <p className="muted" style={{ marginTop: '.3rem' }}>Następny krok: {data.idea.next_step}</p>}
        </Card>
      )}

      {data.yearAgo && (
        <Card>
          <CardHead title="Rok temu dziś" hint={formatDatePl(data.yearAgo.date)} />
          <ul className="entry-items">
            {data.yearAgo.items.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
          {data.yearAgo.reflection && <p className="entry-reflection">{data.yearAgo.reflection}</p>}
        </Card>
      )}

      <GoalSheet open={goalOpen} goal={data.goal} onClose={() => setGoalOpen(false)}
        onDone={() => { setGoalOpen(false); load() }} />
      <SavingsSheet open={savingsOpen} savings={data.savings} onClose={() => setSavingsOpen(false)}
        onDone={() => { setSavingsOpen(false); load() }} />
    </div>
  )
}

function GoalSheet({ open, goal, onClose, onDone }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [current, setCurrent] = useState('')
  const [target, setTarget] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(goal?.title ?? '')
    setDescription(goal?.description ?? '')
    setCurrent(goal?.progress_current != null ? String(goal.progress_current) : '')
    setTarget(goal?.progress_target != null ? String(goal.progress_target) : '')
    setError('')
  }, [open, goal])

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setError('Podaj cel.')
    try {
      await saveMainGoal({
        title: title.trim(),
        description,
        progressCurrent: parseAmount(current) ?? 0,
        progressTarget: parseAmount(target),
      })
      onDone()
    } catch (err) { setError(err.message) }
  }

  return (
    <Sheet open={open} title="Główny cel" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Cel</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="np. Zostać przedsiębiorcą" />
        </label>
        <label className="field">
          <span>Opis</span>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="field-grid">
          <label className="field">
            <span>Postęp — teraz</span>
            <input type="text" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className="field">
            <span>Postęp — cel</span>
            <input type="text" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit">Zapisz</button>
      </form>
    </Sheet>
  )
}

function SavingsSheet({ open, savings, onClose, onDone }) {
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [current, setCurrent] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(savings?.title ?? '')
    setTarget(savings?.target_amount != null ? String(savings.target_amount) : '')
    setCurrent(savings?.current_amount != null ? String(savings.current_amount) : '')
    setError('')
  }, [open, savings])

  async function submit(e) {
    e.preventDefault()
    const t = parseAmount(target)
    if (!title.trim()) return setError('Podaj nazwę celu.')
    if (!t || t <= 0) return setError('Podaj kwotę do uzbierania.')
    try {
      await saveSavingsGoal({
        title: title.trim(),
        targetAmount: t,
        currentAmount: parseAmount(current) ?? 0,
      })
      onDone()
    } catch (err) { setError(err.message) }
  }

  return (
    <Sheet open={open} title="Cel oszczędnościowy" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Na co zbierasz</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="np. Start biznesu" />
        </label>
        <div className="field-grid">
          <label className="field">
            <span>Uzbierane</span>
            <input type="text" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className="field">
            <span>Potrzebne</span>
            <input type="text" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit">Zapisz</button>
      </form>
    </Sheet>
  )
}
