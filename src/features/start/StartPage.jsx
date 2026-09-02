import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchMainGoal, fetchSavingsGoal, saveMainGoal,
  quoteOfTheDay, fetchYearAgo, fetchLatestBusinessIdea,
} from './api'
import { fetchQuotes, fetchHabits, fetchHabitLogs, fetchDailyPlan, habitStreak } from '../extras/api'
import HabitsCard from '../extras/HabitsCard'
import DailyPlanCard from '../extras/DailyPlanCard'
import { fetchRange } from '../work/api'
import { fetchBlocksRange } from '../work/blocksApi'
import { categoryLabel } from '../work/TimeBlocks'
import { fetchExpenses, fetchExtraIncome } from '../expenses/api'
import { fetchEntry, fetchMoodHistory } from '../gratitude/api'
import { fetchDebts, fetchPayments, upcomingPayments } from '../debts/api'
import { todayISO, addDaysISO, isoDate, formatDatePl } from '../../lib/date'
import { formatPLN, formatHours, parseAmount } from '../../lib/money'
import { Card, CardHead, ProgressBar, EmptyState, Sheet } from '../../components/ui'
import { PageLoader } from '../../components/FullScreenSpinner'
import { IconWorkHours, IconPayout, IconExpenses } from '../../components/icons'
import BudgetSplitCard from '../budget/BudgetSplitCard'
import SavingsGoalSheet from '../budget/SavingsGoalSheet'
import NetWorthCard from '../networth/NetWorthCard'
import BalanceOverviewCard from '../balance/BalanceOverviewCard'
import SimpleBalanceCard from '../balance/SimpleBalanceCard'
import QuickAddExpense from '../expenses/QuickAddExpense'
import { generateDueExpenses } from '../expenses/recurringApi'
import { savingsProjection } from '../../lib/savings'

function monthStart(iso) { return iso.slice(0, 8) + '01' }

export default function StartPage() {
  const today = todayISO()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showFavoriteQuote, setShowFavoriteQuote] = useState(false)
  const [savingsOpen, setSavingsOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  // Wymusza przeliczenie wartosci netto po dopisaniu wydatku z Pulpitu.
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    try {
      // Zalegle wydatki cykliczne dopisujemy PRZED odczytem, zeby od razu
      // weszly do bilansu miesiaca. Blad (np. brak migracji 0019) nie moze
      // zablokowac calego Pulpitu — cykliczne sa dodatkiem, nie rdzeniem.
      await generateDueExpenses().catch(() => {})

      const monthFrom = monthStart(today)
      const [
        goal, savings, quotes, habits, habitLogs, plan,
        workDays, expenses, extraIncome, gratitudeToday, moods,
        debts, payments, yearAgo, idea, blocks,
      ] = await Promise.all([
        fetchMainGoal(), fetchSavingsGoal(), fetchQuotes(),
        fetchHabits(), fetchHabitLogs(addDaysISO(today, -60)), fetchDailyPlan(today),
        fetchRange(monthFrom, today), fetchExpenses({ from: monthFrom, to: today }),
        fetchExtraIncome({ from: monthFrom, to: today }).catch(() => []),
        fetchEntry(today), fetchMoodHistory(addDaysISO(today, -30)),
        fetchDebts(), fetchPayments(), fetchYearAgo(today), fetchLatestBusinessIdea(),
        fetchBlocksRange(addDaysISO(today, -60), today).catch(() => []),
      ])
      setData({
        goal, savings, quotes, habits, habitLogs, plan,
        workDays, expenses, extraIncome, gratitudeToday, moods,
        debts, payments, yearAgo, idea, blocks,
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
      + data.extraIncome.reduce((s, e) => s + Number(e.amount), 0)
    const spent = data.expenses.reduce((s, e) => s + Number(e.amount), 0)
    const activeDebts = data.debts.filter((d) => d.active)
    const installments = activeDebts.reduce((s, d) => s + Number(d.monthly_payment), 0)

    const now = new Date()
    const dow = (now.getDay() + 6) % 7
    const monday = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow))
    const weekDays = data.workDays.filter((d) => d.date >= monday)
    const weekExtra = data.extraIncome.filter((e) => e.date >= monday)
    const weekExpenses = data.expenses.filter((e) => e.date >= monday)

    const workedToday = data.workDays.find((d) => d.date === today)

    const selfCareStreak = data.habits.length
      ? Math.max(...data.habits.map((h) => habitStreak(h.id, data.habitLogs, today)))
      : 0

    return {
      balance: pay - spent - installments,
      monthPay: pay,
      monthSpent: spent,
      installments,
      weekHours: weekDays.reduce((s, d) => s + Number(d.hours_worked ?? 0), 0),
      weekByCategory: (data.blocks ?? []).reduce((acc, b) => {
        if (b.date < monday) return acc
        acc[b.category] = (acc[b.category] ?? 0) + Number(b.hours ?? 0)
        return acc
      }, {}),
      weekPay: weekDays.reduce((s, d) => s + Number(d.pay_amount ?? 0), 0)
        + weekExtra.reduce((s, e) => s + Number(e.amount), 0),
      weekSpent: weekExpenses.reduce((s, e) => s + Number(e.amount), 0),
      workedToday,
      lastMood: [...data.moods].reverse().find((m) => m.mood != null),
      selfCareStreak,
      upcoming: upcomingPayments(activeDebts, data.payments, today),
      savingsProjection: savingsProjection(data.savings, pay - spent - installments, today),
    }
  }, [data, today])

  if (loading) return <PageLoader />
  if (error) return <div className="page-pad"><p className="form-error" role="alert">{error}</p></div>

  const quote = quoteOfTheDay(data.quotes, today)
  const favoriteQuotes = data.quotes.filter((q) => q.is_favorite)
  const shownQuote = showFavoriteQuote && favoriteQuotes.length
    ? favoriteQuotes[Math.floor(Math.random() * favoriteQuotes.length)]
    : quote

  const weekBreakdown = Object.entries(derived.weekByCategory)
  const hasMemories = !!data.idea || !!data.yearAgo

  return (
    <div className="page-pad">
      {/* Jedna liczba, bez rat i okresow — pierwsza rzecz na stronie. */}
      <SimpleBalanceCard refreshKey={refreshKey} />

      {/* Cytat dnia — cicha linia bez ramki, zeby nie konkurowal z pieniedzmi o uwage */}
      {shownQuote && (
        <div className="quote-line">
          <p>
            {shownQuote.text}
            {shownQuote.author && <span className="quote-author"> — {shownQuote.author}</span>}
          </p>
          {favoriteQuotes.length > 0 && (
            <button className="quote-toggle" onClick={() => setShowFavoriteQuote((v) => !v)}>
              {showFavoriteQuote ? 'Cytat dnia' : 'Losowy ulubiony'}
            </button>
          )}
        </div>
      )}

      {/* Rzadkie, wazne ostrzezenie — na samej gorze, zeby nie zniknelo w tlumie */}
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

      {/* Otwarty naglowek strony — bez ramki karty, jak sekcja "Andreeva" u Altezzy:
          duza liczba po lewej, kolumny etykieta/wartosc po prawej, cienka linia pod spodem. */}
      <div className="page-header-panel">
        <div className="page-header-main">
          <div className="page-header-top">
            <span className="page-header-eyebrow">Bilans miesiąca</span>
            <Link className="chip" to="/wydatki">Szczegóły</Link>
          </div>
          <p className={'page-header-figure ' + (derived.balance >= 0 ? 'is-positive' : 'is-negative')}>
            {formatPLN(derived.balance)}
          </p>
          <span className="page-header-sub">Dniówki minus wydatki minus raty</span>
        </div>

        <div className="page-header-stats">
          <div className="page-header-stat">
            <span>Zarobione</span>
            <b>{formatPLN(derived.monthPay, { short: true })}</b>
          </div>
          <div className="page-header-stat">
            <span>Wydane</span>
            <b>{formatPLN(derived.monthSpent, { short: true })}</b>
          </div>
          <div className="page-header-stat">
            <span>Raty</span>
            <b>{formatPLN(derived.installments, { short: true })}</b>
          </div>
        </div>
      </div>

      {/* Tydzien: jeden czysty rzad, bez pastelowych blokow — ta sama
          stonowana stylistyka co naglowek, tylko z malymi ikonkami. */}
      <div className="mini-stats">
        <span className="mini-stats-label">Ten tydzień</span>
        <div className="mini-stats-row">
          <div className="mini-stat">
            <span className="mini-stat-icon"><IconWorkHours /></span>
            <div>
              <b>{Math.round(derived.weekHours)}</b>
              <span className="mini-stat-label">godzin</span>
            </div>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-icon"><IconPayout /></span>
            <div>
              <b>{formatPLN(derived.weekPay, { short: true })}</b>
              <span className="mini-stat-label">dniówki</span>
            </div>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-icon"><IconExpenses /></span>
            <div>
              <b>{formatPLN(derived.weekSpent, { short: true })}</b>
              <span className="mini-stat-label">wydatki</span>
            </div>
          </div>
        </div>
        {weekBreakdown.length > 0 && (
          <p className="muted" style={{ margin: '.6rem 0 0', fontSize: '.82rem' }}>
            Poza dniówką: {weekBreakdown.map(([cat, h], i) => (
              <span key={cat}>{i > 0 && ' · '}{formatHours(h)} {categoryLabel(cat).toLowerCase()}</span>
            ))}
          </p>
        )}
      </div>

      {/* Bilans w kilku okresach naraz — "ile mi zostaje" w skali dnia,
          tygodnia, miesiaca, roku i calej historii. */}
      <BalanceOverviewCard refreshKey={refreshKey} />

      {/* Wszystkie pieniadze w jednej liczbie — jedyna wartosc, ktora
          sprawdza sie codziennie. */}
      <NetWorthCard key={`nw-${refreshKey}`} />

      {/* Dopisanie wydatku bez wchodzenia w Wydatki — najczestsza czynnosc
          w calej apce, wiec dostaje miejsce na Pulpicie. */}
      <Card>
        <CardHead title="Szybki wydatek" hint="Dopisujesz dzisiejszą datę" />
        <QuickAddExpense onAdded={() => { setRefreshKey((k) => k + 1); load() }} />
      </Card>

      {/* Podzial 50/30/20 — cala karta, bez skracania */}
      <BudgetSplitCard income={derived.monthPay} expenses={data.expenses} />

      {/* Dwa klikniecia dziennie — sedno apki */}
      <Card>
        <CardHead
          title="Dzisiaj"
          action={<Link className="chip" to="/szukaj">Szukaj</Link>}
        />
        <ul className="row-list">
          <li>
            <Link className="row-item row-item--flat" to="/wdziecznosc">
              <div className="row-main">
                <span className="row-title">Wdzięczność</span>
                <span className="row-sub">
                  {data.gratitudeToday ? 'Zapisane ✓' : 'Jeszcze nie dodałeś'}
                </span>
              </div>
              <span className={'badge' + (data.gratitudeToday ? ' is-success' : '')}>
                {data.gratitudeToday ? 'Gotowe' : 'Dodaj'}
              </span>
            </Link>
          </li>
          <li>
            <Link className="row-item row-item--flat" to="/godziny-pracy">
              <div className="row-main">
                <span className="row-title">Godziny pracy</span>
                <span className="row-sub">
                  {derived.workedToday
                    ? `Zapisane · ${formatHours(derived.workedToday.hours_worked)}`
                    : 'Jeszcze nie zapisałeś'}
                </span>
              </div>
              <span className={'badge' + (derived.workedToday ? ' is-success' : '')}>
                {derived.workedToday ? 'Gotowe' : 'Zapisz'}
              </span>
            </Link>
          </li>
        </ul>
      </Card>

      {/* Nizej: plan dnia, cele, nawyki — wazne, ale nie na pierwszy rzut oka */}
      <DailyPlanCard plan={data.plan} date={today} onChanged={load} />

      {/* Cele: glowny + oszczednosciowy w jednej karcie zamiast dwoch */}
      <Card>
        <CardHead title="Cele" />

        <div className="entry-head">
          <span className="field-label">Główny cel</span>
          <button className="chip" onClick={() => setGoalOpen(true)}>
            {data.goal ? 'Zmień' : 'Ustaw'}
          </button>
        </div>
        {data.goal ? (
          <>
            <p style={{ margin: '.4rem 0 0', fontSize: '1.1rem', fontWeight: 800 }}>{data.goal.title}</p>
            {data.goal.description && <p className="muted" style={{ marginTop: '.2rem' }}>{data.goal.description}</p>}
            {data.goal.progress_target && (
              <div style={{ marginTop: '.6rem' }}>
                <ProgressBar value={Number(data.goal.progress_current)} max={Number(data.goal.progress_target)} />
                <p className="muted" style={{ marginTop: '.3rem' }}>
                  {data.goal.progress_current} z {data.goal.progress_target}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="muted" style={{ margin: '.4rem 0 0' }}>Nie masz ustawionego głównego celu.</p>
        )}

        <div className="entry-head" style={{ marginTop: '1.1rem' }}>
          <span className="field-label">Cel oszczędnościowy</span>
          <button className="chip" onClick={() => setSavingsOpen(true)}>
            {data.savings ? 'Zmień' : 'Ustaw'}
          </button>
        </div>
        {data.savings ? (
          <>
            <p style={{ margin: '.4rem 0 0', fontWeight: 700 }}>{data.savings.title}</p>
            <div style={{ marginTop: '.6rem' }}>
              <ProgressBar
                value={Number(data.savings.current_amount)}
                max={Number(data.savings.target_amount)}
              />
              <p className="muted" style={{ marginTop: '.3rem' }}>
                {formatPLN(data.savings.current_amount)} z {formatPLN(data.savings.target_amount)} ·
                brakuje {formatPLN(Math.max(0, Number(data.savings.target_amount) - Number(data.savings.current_amount)))}
              </p>
            </div>

            {derived.savingsProjection && !derived.savingsProjection.done && (
              <p className="converter mt-1">
                {derived.savingsProjection.monthlyRate <= 0 ? (
                  'W tym miesiącu nic nie odkładasz (wydatki zjadają cały dochód) — na razie nie da się przewidzieć terminu.'
                ) : derived.savingsProjection.targetDate ? (
                  derived.savingsProjection.onTrack ? (
                    <>W tempie {formatPLN(derived.savingsProjection.monthlyRate, { short: true })}/mies. uzbierasz to już{' '}
                      {formatDatePl(derived.savingsProjection.projectedDate)} — przed terminem
                      ({formatDatePl(derived.savingsProjection.targetDate)}).</>
                  ) : (
                    <>W tym tempie zdążysz dopiero {formatDatePl(derived.savingsProjection.projectedDate)}.
                      Żeby zdążyć do {formatDatePl(derived.savingsProjection.targetDate)}, musisz odkładać{' '}
                      {formatPLN(derived.savingsProjection.requiredPerMonth, { short: true })}/mies.
                      (teraz {formatPLN(derived.savingsProjection.monthlyRate, { short: true })}/mies.)</>
                  )
                ) : (
                  <>W tempie {formatPLN(derived.savingsProjection.monthlyRate, { short: true })}/mies. uzbierasz to{' '}
                    {formatDatePl(derived.savingsProjection.projectedDate)}.</>
                )}
              </p>
            )}
          </>
        ) : (
          <p className="muted" style={{ margin: '.4rem 0 0' }}>Ustaw, ile chcesz uzbierać na start biznesu.</p>
        )}
      </Card>

      {/* Nawyki: nastroj i streak jako podpis, nie osobny rzad liczb */}
      <p className="muted" style={{ margin: '0 0 .6rem', fontSize: '.82rem' }}>
        Ostatni nastrój {derived.lastMood?.mood ? `${derived.lastMood.mood}/5` : '—'} ·
        {' '}dbam o siebie {derived.selfCareStreak} {derived.selfCareStreak === 1 ? 'dzień' : 'dni'} z rzędu
      </p>
      <HabitsCard habits={data.habits} logs={data.habitLogs} today={today} onChanged={load} />

      {/* Wspomnienia: pomysl na biznes + rok temu, ciche i male, na samym dole */}
      {hasMemories && (
        <Card>
          <CardHead title="Wspomnienia" />
          <div className="stack" style={{ gap: '.9rem' }}>
            {data.idea && (
              <div>
                <div className="entry-head">
                  <span className="badge is-accent">Pomysł na biznes</span>
                  <Link className="chip" to="/mysli-i-cele">Otwórz</Link>
                </div>
                <p style={{ margin: '.4rem 0 0', fontWeight: 700 }}>
                  {data.idea.title || data.idea.content?.slice(0, 80)}
                </p>
                {data.idea.next_step && (
                  <p className="muted" style={{ marginTop: '.2rem' }}>Następny krok: {data.idea.next_step}</p>
                )}
              </div>
            )}

            {data.yearAgo && (
              <div>
                <span className="badge">Rok temu dziś · {formatDatePl(data.yearAgo.date)}</span>
                <ul className="entry-items" style={{ marginTop: '.5rem' }}>
                  {data.yearAgo.items.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
                {data.yearAgo.reflection && <p className="entry-reflection">{data.yearAgo.reflection}</p>}
              </div>
            )}
          </div>
        </Card>
      )}

      <GoalSheet open={goalOpen} goal={data.goal} onClose={() => setGoalOpen(false)}
        onDone={() => { setGoalOpen(false); load() }} />
      <SavingsGoalSheet open={savingsOpen} savings={data.savings} onClose={() => setSavingsOpen(false)}
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

