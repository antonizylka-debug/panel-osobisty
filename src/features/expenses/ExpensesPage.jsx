import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ExpenseForm from './ExpenseForm'
import DebtsSection from '../debts/DebtsSection'
import CsvImportSheet from './CsvImportSheet'
import {
  fetchExpenses, fetchBudgets, saveBudget, deleteExpense, receiptUrl,
  fetchExtraIncome, addExtraIncome, deleteExtraIncome,
} from './api'
import { fetchDebts, fetchPayments } from '../debts/api'
import { fetchRealHourlyRate, fetchRange } from '../work/api'
import { todayISO, addDaysISO, formatDatePl } from '../../lib/date'
import { formatPLN, formatHours, parseAmount } from '../../lib/money'
import { useCategories } from './useCategories'
import { rangeDays } from '../../lib/period'
import { usePeriod } from '../period/PeriodContext'
import PeriodPicker from '../../components/PeriodPicker'
import { Card, CardHead, ProgressBar, BarChart, PieChart, EmptyState, Sheet, StatRow, SummaryRow, Kebab } from '../../components/ui'
import { IconEdit, IconTrash } from '../../components/icons'
import { PageLoader } from '../../components/FullScreenSpinner'
import BudgetSplitCard from '../budget/BudgetSplitCard'

function monthStart(iso) { return iso.slice(0, 8) + '01' }
function daysInMonth(iso) {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export default function ExpensesPage() {
  const today = todayISO()
  const navigate = useNavigate()
  const location = useLocation()
  const { period, range, previous } = usePeriod()
  const categories = useCategories()

  const [expenses, setExpenses] = useState([])
  const [prevExpenses, setPrevExpenses] = useState([])
  const [budgets, setBudgets] = useState([])
  const [debts, setDebts] = useState([])
  const [payments, setPayments] = useState([])
  const [hourlyRate, setHourlyRate] = useState(null)
  const [workDays, setWorkDays] = useState([])
  const [extraIncome, setExtraIncome] = useState([])
  const [addOpen, setAddOpen] = useState(location.pathname.endsWith('/nowy'))
  const [extraOpen, setExtraOpen] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [category, setCategory] = useState('')
  const [visibleCount, setVisibleCount] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Wszystko pobierane w granicach wybranego okresu — zaden ekran nie tnie
  // juz danych po fakcie na "biezacy miesiac".
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [exp, prevExp, bud, dbt, pay, rate, days, extra] = await Promise.all([
        fetchExpenses({ from: range.from, to: range.to }),
        previous
          ? fetchExpenses({ from: previous.from, to: previous.to })
          : Promise.resolve([]),
        fetchBudgets(monthStart(today)),
        fetchDebts(),
        fetchPayments(),
        fetchRealHourlyRate(addDaysISO(today, -30)),
        fetchRange(range.from, range.to),
        fetchExtraIncome({ from: range.from, to: range.to }).catch(() => []),
      ])
      setExpenses(exp); setPrevExpenses(prevExp)
      setBudgets(bud); setDebts(dbt); setPayments(pay)
      setHourlyRate(rate); setWorkDays(days); setExtraIncome(extra)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [today, range.from, range.to, previous])

  useEffect(() => { load() }, [load])

  function closeAdd() {
    setAddOpen(false)
    if (location.pathname.endsWith('/nowy')) navigate('/wydatki', { replace: true })
  }

  // Pobrane juz w granicach okresu — nie ma czego dodatkowo filtrowac.
  const inRange = expenses
  const periodTotal = inRange.reduce((s, e) => s + Number(e.amount), 0)
  const prevTotal = prevExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const overallBudget = budgets.find((b) => !b.category)

  // Limit miesieczny ma sens tylko wtedy, gdy patrzysz na biezacy miesiac.
  // Przy dowolnym zakresie (np. 1-20 sierpnia) porownywanie z limitem
  // calego miesiaca wprowadzaloby w blad, wiec ta karta wtedy znika.
  const showBudgetCard = period.preset === 'month'

  const byContext = useMemo(() => {
    let priv = 0, workSelf = 0, workOther = 0
    for (const e of inRange) {
      const amt = Number(e.amount)
      if (e.context === 'private') priv += amt
      else if (e.for_whom === 'self') workSelf += amt
      else workOther += amt
    }
    return { priv, workSelf, workOther }
  }, [inRange])

  const monthForecast = useMemo(() => {
    const day = Number(today.slice(8))
    return day > 0 ? (periodTotal / day) * daysInMonth(today) : 0
  }, [periodTotal, today])

  // Rozbicie na kategorie — od razu widoczne, posortowane od najwiekszej.
  const byCategory = useMemo(() => {
    const map = new Map()
    for (const e of inRange) {
      const key = e.category || 'Bez kategorii'
      map.set(key, (map.get(key) ?? 0) + Number(e.amount))
    }
    return [...map.entries()]
      .map(([name, amount]) => ({
        name,
        amount,
        share: periodTotal > 0 ? amount / periodTotal : 0,
        limit: budgets.find((b) => b.category === name)?.limit_amount ?? null,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [inRange, periodTotal, budgets])

  const subscriptions = useMemo(() => expenses.filter((e) => e.type === 'subscription'), [expenses])
  const subsMonthly = subscriptions.reduce((s, e) => {
    const amt = Number(e.amount)
    const factor = { weekly: 4.33, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[e.subscription_cycle] ?? 1
    return s + amt * factor
  }, 0)

  // Wykres dzienny: dla krotkich okresow dzien po dniu, dla dlugich ostatnie
  // 30 dni okresu — 365 slupkow i tak nie da sie odczytac.
  const chartData = useMemo(() => {
    const span = Math.min(rangeDays(range), 30)
    const out = []
    for (let i = span - 1; i >= 0; i--) {
      const d = addDaysISO(range.to, -i)
      if (d < range.from) continue
      const sum = inRange.filter((e) => e.date === d).reduce((s, e) => s + Number(e.amount), 0)
      out.push({ label: d.slice(8), value: sum })
    }
    return out
  }, [inRange, range])

  const visible = useMemo(() => {
    let list = inRange
    if (filter === 'private') list = list.filter((e) => e.context === 'private')
    if (filter === 'work-self') list = list.filter((e) => e.context === 'work' && e.for_whom === 'self')
    if (filter === 'work-other') list = list.filter((e) => e.context === 'work' && e.for_whom === 'someone_else')
    if (filter === 'subs') list = list.filter((e) => e.type === 'subscription')
    if (category) list = list.filter((e) => e.category === category)
    return list
  }, [inRange, filter, category])

  // Liczniki przy zakladkach — licza sie z calego okresu bez kategorii, zeby
  // przelaczanie zakladek nie zmienialo liczb pod palcem.
  const filterCounts = useMemo(() => ({
    all: inRange.length,
    private: inRange.filter((e) => e.context === 'private').length,
    'work-self': inRange.filter((e) => e.context === 'work' && e.for_whom === 'self').length,
    'work-other': inRange.filter((e) => e.context === 'work' && e.for_whom === 'someone_else').length,
    subs: inRange.filter((e) => e.type === 'subscription').length,
  }), [inRange])

  useEffect(() => { setVisibleCount(20) }, [filter, category])

  const budgetTone = overallBudget
    ? periodTotal / Number(overallBudget.limit_amount) >= 1 ? 'danger'
      : periodTotal / Number(overallBudget.limit_amount) >= 0.8 ? 'warn' : 'accent'
    : 'accent'

  // Ile realnie zostalo z tego, co w tym okresie zarobiles.
  const left = useMemo(() => {
    const earned = workDays.reduce((s, d) => s + Number(d.pay_amount ?? 0), 0)
      + extraIncome.reduce((s, e) => s + Number(e.amount), 0)
    const installments = debts
      .filter((d) => d.active)
      .reduce((s, d) => s + Number(d.monthly_payment), 0)
    const remaining = earned - periodTotal - installments

    const day = Number(today.slice(8))
    const daysLeft = Math.max(1, daysInMonth(today) - day + 1)

    return {
      earned,
      installments,
      remaining,
      daysLeft,
      perDay: remaining > 0 ? remaining / daysLeft : 0,
    }
  }, [workDays, extraIncome, debts, periodTotal, today])

  if (loading) return <PageLoader />

  return (
    <div className="page-pad">
      <div className="page-head">
        <h1 className="page-title">Wydatki</h1>
        <div className="page-head-tools">
          <PeriodPicker />
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>+ Dodaj wydatek</button>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <SummaryRow
        items={[
          {
            label: 'Wydane w okresie',
            value: formatPLN(periodTotal),
            delta: previous ? periodTotal - prevTotal : null,
            deltaGood: 'down',
            deltaLabel: formatPLN(Math.abs(periodTotal - prevTotal), { short: true }),
            deltaHint: `vs ${formatPLN(prevTotal, { short: true })}`,
            hint: previous ? undefined : 'Brak okresu do porównania',
          },
          {
            label: 'Liczba wydatków',
            value: String(inRange.length),
            hint: `${rangeDays(range)} dni w okresie`,
          },
          {
            label: 'Średnio dziennie',
            value: formatPLN(periodTotal / Math.max(1, rangeDays(range)), { short: true }),
            hint: hourlyRate ? `≈ ${formatHours(periodTotal / hourlyRate)} pracy` : undefined,
          },
          {
            label: 'Zostało z zarobionego',
            value: formatPLN(left.remaining),
            tone: left.remaining < 0 ? 'negative' : undefined,
            hint: `Zarobione ${formatPLN(left.earned, { short: true })}`,
          },
        ]}
      />

      {showBudgetCard && (
        <Card>
          <CardHead
            title="Limit miesiąca"
            hint={overallBudget ? `Limit ${formatPLN(overallBudget.limit_amount)}` : 'Brak ustawionego limitu'}
            action={<button className="chip" onClick={() => setBudgetOpen(true)}>Budżet</button>}
          />
          {overallBudget ? (
            <>
              <ProgressBar value={periodTotal} max={Number(overallBudget.limit_amount)} tone={budgetTone} />
              <p className="muted" style={{ marginTop: '.4rem' }}>
                {periodTotal >= Number(overallBudget.limit_amount)
                  ? `Limit przekroczony o ${formatPLN(periodTotal - Number(overallBudget.limit_amount))}`
                  : `Zostało ${formatPLN(Number(overallBudget.limit_amount) - periodTotal)}`}
                {' · '}prognoza na koniec miesiąca {formatPLN(monthForecast, { short: true })}
              </p>
            </>
          ) : (
            <EmptyState>Ustaw limit, a pokażę ile z niego zostało.</EmptyState>
          )}
        </Card>
      )}

      <Card>
        <CardHead
          title="Zostało z zarobionego"
          hint={`Zarobione ${formatPLN(left.earned, { short: true })} · wydane ${formatPLN(periodTotal, { short: true })}${left.installments > 0 ? ` · raty ${formatPLN(left.installments, { short: true })}` : ''}`}
        />
        <p className={'big-number ' + (left.remaining >= 0 ? 'is-positive' : 'is-negative')}>
          {formatPLN(left.remaining)}
        </p>

        {left.earned > 0 && (
          <div style={{ marginTop: '.8rem' }}>
            <ProgressBar
              value={Math.min(periodTotal + left.installments, left.earned)}
              max={left.earned}
              tone={
                (periodTotal + left.installments) / left.earned >= 1 ? 'danger'
                  : (periodTotal + left.installments) / left.earned >= 0.8 ? 'warn' : 'accent'
              }
            />
            <p className="muted" style={{ marginTop: '.4rem' }}>
              Rozdysponowane {Math.round(((periodTotal + left.installments) / left.earned) * 100)}% zarobku
            </p>
          </div>
        )}

        {left.remaining > 0 ? (
          <div className="converter mt-1">
            Na co jeszcze możesz:
            <span style={{ display: 'block', fontWeight: 600, marginTop: '.35rem' }}>
              {formatPLN(left.perDay, { short: true })} dziennie przez {left.daysLeft} dni do końca miesiąca
              {hourlyRate && ` · to ${formatHours(left.remaining / hourlyRate)} Twojej pracy`}
            </span>
          </div>
        ) : left.earned > 0 ? (
          <div className="converter is-muted mt-1">
            Wydałeś więcej, niż zarobiłeś w tym miesiącu — brakuje {formatPLN(Math.abs(left.remaining))}.
          </div>
        ) : (
          <div className="converter is-muted mt-1">
            Zapisz dniówki w Godzinach pracy, a policzę, ile realnie Ci zostaje.
          </div>
        )}
      </Card>

      <Card>
        <CardHead
          title="Dodatkowa kasa"
          hint="Napiwek, znalezione, sprzedane coś — co dostałeś poza dniówką"
          action={<button className="chip is-active" onClick={() => setExtraOpen(true)}>+ Dodaj</button>}
        />
        {extraIncome.length === 0 ? (
          <EmptyState>Nic jeszcze nie dopisane w tym miesiącu.</EmptyState>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Skąd</th>
                <th>Data</th>
                <th className="num">Kwota</th>
                <th className="ledger-actions" />
              </tr>
            </thead>
            <tbody>
              {extraIncome.map((e) => (
                <ExtraIncomeRow key={e.id} entry={e} onDeleted={load} />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <BudgetSplitCard income={left.earned} expenses={inRange} />

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
          <>
          <PieChart
            data={byCategory.map((c) => ({ label: c.name, value: c.amount }))}
            format={(v) => formatPLN(v, { short: true })}
          />
          <table className="ledger mt-1">
            <thead>
              <tr>
                <th>Kategoria</th>
                <th className="num">Kwota</th>
                <th className="num">Udział</th>
                <th className="num">Limit</th>
                {hourlyRate && <th className="num">Czas pracy</th>}
              </tr>
            </thead>
            <tbody>
              {byCategory.map((c) => {
                const ratio = c.limit ? c.amount / Number(c.limit) : null
                return (
                  <tr key={c.name}>
                    <td className="ledger-main" data-label="Kategoria">
                      <span className="ledger-name">{c.name}</span>
                      <div className="ledger-bar">
                        <ProgressBar
                          value={c.amount}
                          max={c.limit ? Number(c.limit) : periodTotal}
                          tone={ratio == null ? 'accent' : ratio >= 1 ? 'danger' : ratio >= 0.8 ? 'warn' : 'accent'}
                        />
                      </div>
                    </td>
                    <td className="num" data-label="Kwota">{formatPLN(c.amount)}</td>
                    <td className="num" data-label="Udział">{Math.round(c.share * 100)}%</td>
                    <td className={'num' + (ratio != null && ratio >= 1 ? ' is-negative' : '')} data-label="Limit">
                      {c.limit ? formatPLN(c.limit, { short: true }) : '—'}
                    </td>
                    {hourlyRate && (
                      <td className="num" data-label="Czas pracy">{formatHours(c.amount / hourlyRate)}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          </>
        )}
      </Card>

      <Card>
        <CardHead title="Wydatki w czasie" hint="Ostatnie dwa tygodnie" />
        <BarChart data={chartData} height={90} format={(v) => formatPLN(v)} />
      </Card>

      {subscriptions.length > 0 && (
        <Card>
          <CardHead title="Subskrypcje" hint={`${formatPLN(subsMonthly)} miesięcznie`} />
          <table className="ledger">
            <thead>
              <tr>
                <th>Subskrypcja</th>
                <th>Cykl</th>
                <th className="num">Kwota</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id}>
                  <td className="ledger-main" data-label="Subskrypcja">
                    <span className="ledger-name">{s.description || 'Subskrypcja'}</span>
                  </td>
                  <td data-label="Cykl">
                    {{ weekly: 'tygodniowo', monthly: 'miesięcznie', quarterly: 'kwartalnie', yearly: 'rocznie' }[s.subscription_cycle]}
                  </td>
                  <td className="num" data-label="Kwota">{formatPLN(s.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <DebtsSection debts={debts} payments={payments} onChanged={load} />

      <Card>
        <CardHead
          title="Lista"
          hint={`${visible.length} pozycji`}
          action={<button className="chip" onClick={() => setImportOpen(true)}>Import CSV</button>}
        />
        <div className="tab-row" style={{ marginBottom: '.9rem' }}>
          {[
            { v: 'all', l: 'Wszystkie' },
            { v: 'private', l: 'Prywatne' },
            { v: 'work-self', l: 'Praca / siebie' },
            { v: 'work-other', l: 'Praca / komuś' },
            { v: 'subs', l: 'Subskrypcje' },
          ].map((f) => (
            <button key={f.v} className={'tab-item' + (filter === f.v ? ' is-active' : '')}
              onClick={() => setFilter(f.v)}>
              {f.l}
              <span className="tab-item-count">{filterCounts[f.v]}</span>
            </button>
          ))}
        </div>
        <div className="chip-row" style={{ marginBottom: '.75rem' }}>
          <button className={'chip' + (!category ? ' is-active' : '')} onClick={() => setCategory('')}>Każda kategoria</button>
          {categories.map((c) => (
            <button key={c} className={'chip' + (category === c ? ' is-active' : '')}
              onClick={() => setCategory(category === c ? '' : c)}>{c}</button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState>Brak wydatków dla tych filtrów.</EmptyState>
        ) : (
          <>
            <table className="ledger">
              <thead>
                <tr>
                  <th>Opis</th>
                  <th>Data</th>
                  <th>Kategoria</th>
                  <th className="num">Kwota</th>
                  <th className="ledger-actions" />
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, visibleCount).map((e) => (
                  <ExpenseRow key={e.id} expense={e} hourlyRate={hourlyRate} onDeleted={load} />
                ))}
              </tbody>
            </table>
            {visible.length > visibleCount && (
              <button className="chip mt-1" onClick={() => setVisibleCount((n) => n + 20)}>
                Załaduj więcej ({visible.length - visibleCount})
              </button>
            )}
          </>
        )}
      </Card>

      <Sheet open={addOpen} title="Nowy wydatek" onClose={closeAdd}>
        <ExpenseForm hourlyRate={hourlyRate} onSaved={() => { closeAdd(); load() }} />
      </Sheet>

      <Sheet open={extraOpen} title="Dodatkowa kasa" onClose={() => setExtraOpen(false)}>
        <ExtraIncomeForm onSaved={() => { setExtraOpen(false); load() }} />
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
      <tr>
        <td className="ledger-main" data-label="Opis">
          <button className="ledger-link" onClick={openDetail}>
            {expense.description || expense.category || 'Wydatek'}
          </button>
          <span className="ledger-sub">
            {label}{whom ? ` ${whom}` : ''}{expense.imported ? ' · import' : ''}
          </span>
        </td>
        <td data-label="Data">{formatDatePl(expense.date)}</td>
        <td data-label="Kategoria">
          {expense.category || '—'}
          {expense.payment_method === 'cash' && (
            <span className="badge" style={{ marginLeft: '.35rem' }}>Gotówka</span>
          )}
        </td>
        <td className="num" data-label="Kwota">{formatPLN(expense.amount)}</td>
        <td className="ledger-actions">
          <Kebab items={[
            { label: 'Edytuj', icon: <IconEdit />, onClick: openDetail },
            { label: 'Usuń', icon: <IconTrash />, tone: 'danger', onClick: async () => { await deleteExpense(expense.id); onDeleted() } },
          ]} />
        </td>
      </tr>

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

function ExtraIncomeRow({ entry, onDeleted }) {
  return (
    <tr>
      <td className="ledger-main" data-label="Skąd">
        <span className="ledger-name">{entry.note || 'Dodatkowa kasa'}</span>
      </td>
      <td data-label="Data">{formatDatePl(entry.date)}</td>
      <td className="num" data-label="Kwota">{formatPLN(entry.amount)}</td>
      <td className="ledger-actions">
        <Kebab items={[
          {
            label: 'Usuń', icon: <IconTrash />, tone: 'danger',
            onClick: async () => { await deleteExtraIncome(entry.id); onDeleted() },
          },
        ]} />
      </td>
    </tr>
  )
}

function ExtraIncomeForm({ onSaved }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const amt = parseAmount(amount)
    if (!amt || amt <= 0) return setError('Podaj kwotę.')
    setBusy(true)
    try {
      await addExtraIncome({ date, amount: amt, note })
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
        <span>Ile dostałeś</span>
        <input type="text" inputMode="decimal" autoFocus value={amount}
          onChange={(e) => setAmount(e.target.value)} placeholder="np. 50" />
      </label>
      <label className="field">
        <span>Skąd (opcjonalnie)</span>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="np. napiwek" />
      </label>
      <label className="field">
        <span>Data</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
        {busy ? 'Zapisywanie…' : 'Zapisz'}
      </button>
    </form>
  )
}

function BudgetSheet({ open, month, budgets, onClose, onDone }) {
  const categories = useCategories()
  const overall = budgets.find((b) => !b.category)
  const [limit, setLimit] = useState(overall ? String(overall.limit_amount) : '')
  const [catName, setCatName] = useState('')
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
    // Pusta kategoria to w budgets limit CALEGO miesiaca (category is null),
    // wiec zapis bez wyboru cichcem nadpisalby limit ogolny.
    if (!catName) return setError('Wybierz kategorię.')
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
                <option value="">— wybierz —</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
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
