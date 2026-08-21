import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ExpenseForm from './ExpenseForm'
import DebtsSection from '../debts/DebtsSection'
import CsvImportSheet from './CsvImportSheet'
import { fetchExpenses, fetchBudgets, saveBudget, deleteExpense, receiptUrl, CATEGORIES } from './api'
import { fetchDebts, fetchPayments } from '../debts/api'
import { fetchRealHourlyRate } from '../work/api'
import { todayISO, addDaysISO, formatDatePl } from '../../lib/date'
import { formatPLN, formatHours, parseAmount } from '../../lib/money'
import { Card, CardHead, ProgressBar, BarChart, EmptyState, Sheet, Segmented, StatRow } from '../../components/ui'

function monthStart(iso) { return iso.slice(0, 8) + '01' }
function daysInMonth(iso) {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export default function ExpensesPage() {
  const today = todayISO()
  const navigate = useNavigate()
  const location = useLocation()

  const [expenses, setExpenses] = useState([])
  const [budgets, setBudgets] = useState([])
  const [debts, setDebts] = useState([])
  const [payments, setPayments] = useState([])
  const [hourlyRate, setHourlyRate] = useState(null)
  const [addOpen, setAddOpen] = useState(location.pathname.endsWith('/nowy'))
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [exp, bud, dbt, pay, rate] = await Promise.all([
        fetchExpenses({ from: addDaysISO(today, -120), to: today }),
        fetchBudgets(monthStart(today)),
        fetchDebts(),
        fetchPayments(),
        fetchRealHourlyRate(addDaysISO(today, -30)),
      ])
      setExpenses(exp); setBudgets(bud); setDebts(dbt); setPayments(pay); setHourlyRate(rate)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => { load() }, [load])

  function closeAdd() {
    setAddOpen(false)
    if (location.pathname.endsWith('/nowy')) navigate('/wydatki', { replace: true })
  }

  const thisMonth = useMemo(
    () => expenses.filter((e) => e.date >= monthStart(today)),
    [expenses, today]
  )

  const monthTotal = thisMonth.reduce((s, e) => s + Number(e.amount), 0)
  const overallBudget = budgets.find((b) => !b.category)

  const byContext = useMemo(() => {
    let priv = 0, workSelf = 0, workOther = 0
    for (const e of thisMonth) {
      const amt = Number(e.amount)
      if (e.context === 'private') priv += amt
      else if (e.for_whom === 'self') workSelf += amt
      else workOther += amt
    }
    return { priv, workSelf, workOther }
  }, [thisMonth])

  // Prognoza: przy obecnym tempie w tym tygodniu wydasz ok. X zl
  const weekForecast = useMemo(() => {
    const now = new Date()
    const dow = (now.getDay() + 6) % 7
    const monday = addDaysISO(today, -dow)
    const spent = expenses.filter((e) => e.date >= monday).reduce((s, e) => s + Number(e.amount), 0)
    const elapsed = dow + 1
    return elapsed > 0 ? (spent / elapsed) * 7 : 0
  }, [expenses, today])

  const monthForecast = useMemo(() => {
    const day = Number(today.slice(8))
    return day > 0 ? (monthTotal / day) * daysInMonth(today) : 0
  }, [monthTotal, today])

  // Rozbicie na kategorie — od razu widoczne, posortowane od najwiekszej.
  const byCategory = useMemo(() => {
    const map = new Map()
    for (const e of thisMonth) {
      const key = e.category || 'Bez kategorii'
      map.set(key, (map.get(key) ?? 0) + Number(e.amount))
    }
    return [...map.entries()]
      .map(([name, amount]) => ({
        name,
        amount,
        share: monthTotal > 0 ? amount / monthTotal : 0,
        limit: budgets.find((b) => b.category === name)?.limit_amount ?? null,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [thisMonth, monthTotal, budgets])

  const subscriptions = useMemo(() => expenses.filter((e) => e.type === 'subscription'), [expenses])
  const subsMonthly = subscriptions.reduce((s, e) => {
    const amt = Number(e.amount)
    const factor = { weekly: 4.33, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[e.subscription_cycle] ?? 1
    return s + amt * factor
  }, 0)

  const chartData = useMemo(() => {
    const days = 14
    const out = []
    for (let i = days - 1; i >= 0; i--) {
      const d = addDaysISO(today, -i)
      const sum = expenses.filter((e) => e.date === d).reduce((s, e) => s + Number(e.amount), 0)
      out.push({ label: d.slice(8), value: sum })
    }
    return out
  }, [expenses, today])

  const visible = useMemo(() => {
    let list = thisMonth
    if (filter === 'private') list = list.filter((e) => e.context === 'private')
    if (filter === 'work-self') list = list.filter((e) => e.context === 'work' && e.for_whom === 'self')
    if (filter === 'work-other') list = list.filter((e) => e.context === 'work' && e.for_whom === 'someone_else')
    if (filter === 'subs') list = list.filter((e) => e.type === 'subscription')
    if (category) list = list.filter((e) => e.category === category)
    return list
  }, [thisMonth, filter, category])

  const budgetTone = overallBudget
    ? monthTotal / Number(overallBudget.limit_amount) >= 1 ? 'danger'
      : monthTotal / Number(overallBudget.limit_amount) >= 0.8 ? 'warn' : 'accent'
    : 'accent'

  if (loading) return <div className="page-pad"><p className="page-lede">Wczytywanie…</p></div>

  return (
    <div className="page-pad">
      <div className="page-head">
        <h1 className="page-title">Wydatki</h1>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="action-bar">
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>Dodaj wydatek</button>
        <button className="btn btn-ghost" onClick={() => setImportOpen(true)}>Import CSV</button>
      </div>

      <Card>
        <CardHead
          title="Ten miesiąc"
          hint={overallBudget ? `Limit ${formatPLN(overallBudget.limit_amount)}` : 'Brak ustawionego limitu'}
          action={<button className="chip" onClick={() => setBudgetOpen(true)}>Budżet</button>}
        />
        <p className="big-number">{formatPLN(monthTotal)}</p>
        {hourlyRate && (
          <p className="muted" style={{ marginTop: '.3rem' }}>
            ≈ {formatHours(monthTotal / hourlyRate)} Twojej pracy
          </p>
        )}
        {overallBudget && (
          <div style={{ marginTop: '.8rem' }}>
            <ProgressBar value={monthTotal} max={Number(overallBudget.limit_amount)} tone={budgetTone} />
            <p className="muted" style={{ marginTop: '.4rem' }}>
              {monthTotal >= Number(overallBudget.limit_amount)
                ? `Limit przekroczony o ${formatPLN(monthTotal - Number(overallBudget.limit_amount))}`
                : `Zostało ${formatPLN(Number(overallBudget.limit_amount) - monthTotal)}`}
              {' · '}prognoza na koniec miesiąca {formatPLN(monthForecast, { short: true })}
            </p>
          </div>
        )}
        <div className="converter is-muted mt-1">
          Przy obecnym tempie w tym tygodniu wydasz ok. {formatPLN(weekForecast, { short: true })}
        </div>
      </Card>

      <StatRow
        items={[
          { label: 'prywatne', value: formatPLN(byContext.priv, { short: true }) },
          { label: 'praca / siebie', value: formatPLN(byContext.workSelf, { short: true }) },
          { label: 'praca / komuś', value: formatPLN(byContext.workOther, { short: true }) },
        ]}
      />

      <Card>
        <CardHead
          title="Na co idą pieniądze"
          hint="Ten miesiąc, od największej pozycji"
          action={<button className="chip" onClick={() => setBudgetOpen(true)}>Limity</button>}
        />
        {byCategory.length === 0 ? (
          <EmptyState>Dodaj pierwszy wydatek, a pokażę rozbicie.</EmptyState>
        ) : (
          <ul className="row-list">
            {byCategory.map((c) => {
              const ratio = c.limit ? c.amount / Number(c.limit) : null
              return (
                <li key={c.name}>
                  <div className="entry">
                    <div className="entry-head">
                      <span className="row-title">{c.name}</span>
                      <span className="row-value">{formatPLN(c.amount)}</span>
                    </div>
                    <div style={{ marginTop: '.5rem' }}>
                      <ProgressBar
                        value={c.amount}
                        max={c.limit ? Number(c.limit) : monthTotal}
                        tone={ratio == null ? 'accent' : ratio >= 1 ? 'danger' : ratio >= 0.8 ? 'warn' : 'accent'}
                      />
                    </div>
                    <p className="row-sub" style={{ marginTop: '.4rem' }}>
                      {Math.round(c.share * 100)}% wszystkich wydatków
                      {c.limit && ` · limit ${formatPLN(c.limit, { short: true })}`}
                      {hourlyRate && ` · ${formatHours(c.amount / hourlyRate)} pracy`}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHead title="Wydatki w czasie" hint="Ostatnie dwa tygodnie" />
        <BarChart data={chartData} height={90} format={(v) => formatPLN(v)} />
      </Card>

      {subscriptions.length > 0 && (
        <Card>
          <CardHead title="Subskrypcje" hint={`${formatPLN(subsMonthly)} miesięcznie`} />
          <ul className="row-list">
            {subscriptions.map((s) => (
              <li key={s.id}>
                <div className="row-item" style={{ cursor: 'default' }}>
                  <div className="row-main">
                    <span className="row-title">{s.description || 'Subskrypcja'}</span>
                    <span className="row-sub">
                      {{ weekly: 'tygodniowo', monthly: 'miesięcznie', quarterly: 'kwartalnie', yearly: 'rocznie' }[s.subscription_cycle]}
                    </span>
                  </div>
                  <span className="row-value">{formatPLN(s.amount)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <DebtsSection debts={debts} payments={payments} onChanged={load} />

      <Card>
        <CardHead title="Lista" hint={`${visible.length} pozycji`} />
        <div className="chip-row" style={{ marginBottom: '.75rem' }}>
          {[
            { v: 'all', l: 'Wszystkie' },
            { v: 'private', l: 'Prywatne' },
            { v: 'work-self', l: 'Praca / siebie' },
            { v: 'work-other', l: 'Praca / komuś' },
            { v: 'subs', l: 'Subskrypcje' },
          ].map((f) => (
            <button key={f.v} className={'chip' + (filter === f.v ? ' is-active' : '')}
              onClick={() => setFilter(f.v)}>{f.l}</button>
          ))}
        </div>
        <div className="chip-row" style={{ marginBottom: '.75rem' }}>
          <button className={'chip' + (!category ? ' is-active' : '')} onClick={() => setCategory('')}>Każda kategoria</button>
          {CATEGORIES.map((c) => (
            <button key={c} className={'chip' + (category === c ? ' is-active' : '')}
              onClick={() => setCategory(category === c ? '' : c)}>{c}</button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState>Brak wydatków dla tych filtrów.</EmptyState>
        ) : (
          <ul className="row-list">
            {visible.map((e) => (
              <ExpenseRow key={e.id} expense={e} hourlyRate={hourlyRate} onDeleted={load} />
            ))}
          </ul>
        )}
      </Card>

      <Sheet open={addOpen} title="Nowy wydatek" onClose={closeAdd}>
        <ExpenseForm hourlyRate={hourlyRate} onSaved={() => { closeAdd(); load() }} />
      </Sheet>

      <BudgetSheet
        open={budgetOpen}
        month={monthStart(today)}
        budgets={budgets}
        onClose={() => setBudgetOpen(false)}
        onDone={() => { setBudgetOpen(false); load() }}
      />

      <CsvImportSheet
        open={importOpen}
        existing={expenses}
        onClose={() => setImportOpen(false)}
        onDone={() => { setImportOpen(false); load() }}
      />
    </div>
  )
}

function ExpenseRow({ expense, hourlyRate, onDeleted }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState(null)

  async function openDetail() {
    setOpen(true)
    if (expense.receipt_url && !url) {
      try { setUrl(await receiptUrl(expense.receipt_url)) } catch { /* podglad opcjonalny */ }
    }
  }

  const label = { private: 'Prywatne', work: 'Praca' }[expense.context]
  const whom = expense.for_whom === 'self' ? 'dla siebie' : expense.for_whom === 'someone_else' ? 'dla kogoś' : null

  return (
    <>
      <li>
        <button className="row-item" onClick={openDetail}>
          <div className="row-main">
            <span className="row-title">{expense.description || expense.category || 'Wydatek'}</span>
            <span className="row-sub">
              {formatDatePl(expense.date)} · {label}{whom ? ` ${whom}` : ''}
              {expense.category ? ` · ${expense.category}` : ''}
              {expense.imported ? ' · import' : ''}
            </span>
          </div>
          <span className="row-value">{formatPLN(expense.amount)}</span>
        </button>
      </li>

      <Sheet open={open} title={expense.description || 'Wydatek'} onClose={() => setOpen(false)}>
        <div className="stack">
          <p className="big-number">{formatPLN(expense.amount)}</p>
          {hourlyRate && <div className="converter">≈ {formatHours(Number(expense.amount) / hourlyRate)} Twojej pracy</div>}
          <p className="muted">
            {formatDatePl(expense.date)}<br />
            {label}{whom ? ` · ${whom}` : ''}{expense.for_whom_note ? ` · ${expense.for_whom_note}` : ''}<br />
            {expense.category && `Kategoria: ${expense.category}`}
          </p>
          {url && <img src={url} alt="Paragon" style={{ width: '100%', borderRadius: 16 }} />}
          <button className="btn btn-ghost btn-block" style={{ color: 'var(--danger)' }}
            onClick={async () => { await deleteExpense(expense.id); setOpen(false); onDeleted() }}>
            Usuń wydatek
          </button>
        </div>
      </Sheet>
    </>
  )
}

function BudgetSheet({ open, month, budgets, onClose, onDone }) {
  const overall = budgets.find((b) => !b.category)
  const [limit, setLimit] = useState(overall ? String(overall.limit_amount) : '')
  const [catName, setCatName] = useState(CATEGORIES[0])
  const [catLimit, setCatLimit] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) setLimit(overall ? String(overall.limit_amount) : '')
  }, [open, overall])

  async function saveOverall(e) {
    e.preventDefault()
    const amt = parseAmount(limit)
    if (!amt || amt <= 0) return setError('Podaj limit.')
    try {
      await saveBudget({ month, limitAmount: amt, category: null })
      onDone()
    } catch (err) { setError(err.message) }
  }

  async function saveCategory(e) {
    e.preventDefault()
    const amt = parseAmount(catLimit)
    if (!amt || amt <= 0) return setError('Podaj limit kategorii.')
    try {
      await saveBudget({ month, limitAmount: amt, category: catName })
      setCatLimit('')
      onDone()
    } catch (err) { setError(err.message) }
  }

  return (
    <Sheet open={open} title="Budżet miesiąca" onClose={onClose}>
      <div className="stack">
        <form className="stack" onSubmit={saveOverall}>
          <label className="field">
            <span>Limit na cały miesiąc</span>
            <input type="text" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>
          <button className="btn btn-primary btn-block" type="submit">Zapisz limit</button>
        </form>

        <form className="stack" onSubmit={saveCategory}>
          <div className="field-grid">
            <label className="field">
              <span>Kategoria</span>
              <select value={catName} onChange={(e) => setCatName(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Limit</span>
              <input type="text" inputMode="decimal" value={catLimit} onChange={(e) => setCatLimit(e.target.value)} />
            </label>
          </div>
          <button className="btn btn-ghost btn-block" type="submit">Dodaj limit kategorii</button>
        </form>

        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  )
}
