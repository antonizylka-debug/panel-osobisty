import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import WorkDayForm from './WorkDayForm'
import { fetchDay, fetchRange, fetchPending, settlePayment, doorToDoorHours } from './api'
import { fetchBlocksRange } from './blocksApi'
import { categoryLabel } from './TimeBlocks'
import { todayISO, addDaysISO, isoDate, formatDatePl } from '../../lib/date'
import { formatPLN, formatHours, parseAmount } from '../../lib/money'
import { Card, CardHead, BarChart, EmptyState, StatRow, Sheet, Segmented } from '../../components/ui'

const DAY_TYPE_LABEL = { work: 'Praca', off: 'Wolne', vacation: 'Urlop', sick: 'L4' }

function monthStart(iso) {
  return iso.slice(0, 8) + '01'
}

export default function WorkPage() {
  const today = todayISO()
  const [params, setParams] = useSearchParams()
  const [date, setDate] = useState(params.get('data') ?? today)
  const [entry, setEntry] = useState(null)
  const [month, setMonth] = useState([])
  const [pending, setPending] = useState([])
  const [blocks, setBlocks] = useState([])
  const [range, setRange] = useState('week')
  const [settleOpen, setSettleOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [day, days, pend, blks] = await Promise.all([
        fetchDay(date),
        fetchRange(addDaysISO(today, -60), today),
        fetchPending(),
        fetchBlocksRange(addDaysISO(today, -60), today).catch(() => []),
      ])
      setEntry(day)
      setMonth(days)
      setPending(pend)
      setBlocks(blks)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [date, today])

  useEffect(() => { load() }, [load])

  function changeDate(next) {
    setDate(next)
    setParams(next === today ? {} : { data: next }, { replace: true })
  }

  function handleSaved(saved) {
    setEntry(saved)
    setMonth((prev) => [saved, ...prev.filter((d) => d.date !== saved.date)].sort((a, b) => (a.date < b.date ? 1 : -1)))
    fetchPending().then(setPending).catch(() => {})
  }

  const thisMonth = useMemo(() => month.filter((d) => d.date >= monthStart(today)), [month, today])
  const thisWeek = useMemo(() => {
    const now = new Date()
    const dow = (now.getDay() + 6) % 7
    const monday = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow))
    return month.filter((d) => d.date >= monday)
  }, [month])

  const scope = range === 'week' ? thisWeek : thisMonth

  // Poczatek wybranego zakresu — potrzebny osobno, bo bloki czasu
  // filtrujemy po dacie, a nie po liscie dni z work_days.
  const scopeFrom = useMemo(() => {
    if (range === 'month') return monthStart(today)
    const now = new Date()
    const dow = (now.getDay() + 6) % 7
    return isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow))
  }, [range, today])

  const totals = useMemo(() => {
    let hours = 0, pay = 0, workDays = 0, offDays = 0
    for (const d of scope) {
      hours += Number(d.hours_worked ?? 0)
      pay += Number(d.pay_amount ?? 0)
      if (d.day_type === 'work') workDays++
      else offDays++
    }

    // Godziny poza dniowka biora sie z blokow czasu, nie z pol na work_days.
    // Liczymy po dacie, nie po tym, czy dzien ma wpis w work_days — blok moze
    // istniec w dniu, w ktorym nie bylo zadnej dniowki.
    const byCategory = {}
    for (const b of blocks) {
      if (b.date < scopeFrom) continue
      byCategory[b.category] = (byCategory[b.category] ?? 0) + Number(b.hours ?? 0)
    }

    return { hours, pay, workDays, offDays, byCategory }
  }, [scope, blocks, scopeFrom])

  const realRate = useMemo(() => {
    let pay = 0, span = 0
    for (const d of scope) {
      const s = doorToDoorHours(d.left_home_time, d.return_time) ?? Number(d.hours_worked ?? 0)
      if (s > 0 && d.pay_amount != null) { pay += Number(d.pay_amount); span += s }
    }
    return span > 0 ? pay / span : null
  }, [scope])

  const chartData = useMemo(
    () => [...scope].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-14)
      .map((d) => ({ label: d.date.slice(8), value: Number(d.hours_worked ?? 0) })),
    [scope]
  )

  // Srednia liczona tylko z dni, w ktorych faktycznie byly godziny —
  // dzielenie przez 7 czy 30 zanizaloby ja o dni wolne.
  const averages = useMemo(() => {
    const now = new Date()
    const dow = (now.getDay() + 6) % 7
    const monday = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow))

    function avgSince(from, label) {
      const days = month.filter((d) => d.date >= from && Number(d.hours_worked ?? 0) > 0)
      const total = days.reduce((s, d) => s + Number(d.hours_worked), 0)
      return { label, days: days.length, total, avg: days.length ? total / days.length : 0 }
    }

    return [
      avgSince(monday, 'Ten tydzień'),
      avgSince(addDaysISO(today, -13), 'Ostatnie 2 tygodnie'),
      avgSince(monthStart(today), 'Ten miesiąc'),
    ]
  }, [month, today])

  const pendingTotal = pending.reduce((s, d) => s + Number(d.pay_amount ?? 0), 0)

  if (loading) return <div className="page-pad"><p className="page-lede">Wczytywanie…</p></div>

  return (
    <div className="page-pad">
      <h1 className="page-title">Godziny pracy</h1>
      {error && <p className="form-error" role="alert">{error}</p>}

      <Card>
        <CardHead
          title={date === today ? 'Dzisiaj' : formatDatePl(date)}
          hint={entry ? `Zapisane · ${DAY_TYPE_LABEL[entry.day_type]}` : 'Brak wpisu na ten dzień'}
          action={
            <input
              type="date"
              className="chip"
              value={date}
              max={today}
              onChange={(e) => changeDate(e.target.value)}
              style={{ padding: '.4rem .7rem' }}
            />
          }
        />
        <WorkDayForm date={date} entry={entry} onSaved={handleSaved} />
      </Card>

      <Segmented
        ariaLabel="Zakres"
        value={range}
        onChange={setRange}
        options={[{ value: 'week', label: 'Ten tydzień' }, { value: 'month', label: 'Ten miesiąc' }]}
      />

      <div style={{ height: '1rem' }} />

      <StatRow
        items={[
          { label: 'godzin', value: Math.round(totals.hours) },
          { label: 'dniówki', value: formatPLN(totals.pay, { short: true }) },
          { label: 'dni pracy', value: totals.workDays },
        ]}
      />

      <Card>
        <CardHead title="Na co szedł czas" hint={range === 'week' ? 'Ten tydzień' : 'Ten miesiąc'} />
        <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
          {formatHours(totals.hours)} za pieniądze
          {Object.entries(totals.byCategory).map(([cat, h]) => (
            <span key={cat}> · {formatHours(h)} {categoryLabel(cat).toLowerCase()}</span>
          ))}
        </p>
        {Object.keys(totals.byCategory).length === 0 && (
          <p className="muted" style={{ marginTop: '.4rem' }}>
            Poza dniówką nic nie dopisane. Dopisujesz to przy wpisie dnia.
          </p>
        )}
        {realRate != null && (
          <div className="converter mt-1">Realna stawka w tym okresie: {formatPLN(realRate)}/h</div>
        )}
        <p className="muted mt-1">Dni wolnych, urlopu i L4: {totals.offDays}</p>
      </Card>

      <Card>
        <CardHead title="Średnia godzin" hint="Tylko dni, w których pracowałeś" />
        <ul className="row-list">
          {averages.map((a) => (
            <li key={a.label}>
              <div className="row-item" style={{ cursor: 'default' }}>
                <div className="row-main">
                  <span className="row-title">{a.label}</span>
                  <span className="row-sub">
                    {a.days > 0
                      ? `${a.days} ${a.days === 1 ? 'dzień' : 'dni'} · łącznie ${formatHours(a.total)}`
                      : 'brak dni pracujących'}
                  </span>
                </div>
                <span className="row-value">{a.days > 0 ? formatHours(a.avg) : '—'}</span>
              </div>
            </li>
          ))}
        </ul>
        {averages[0].days > 0 && averages[2].days > 0 && (
          <div className="converter mt-1">
            {averages[0].avg > averages[2].avg
              ? `W tym tygodniu robisz o ${formatHours(averages[0].avg - averages[2].avg)} dziennie więcej niż średnio w miesiącu.`
              : averages[0].avg < averages[2].avg
                ? `W tym tygodniu robisz o ${formatHours(averages[2].avg - averages[0].avg)} dziennie mniej niż średnio w miesiącu.`
                : 'Trzymasz równe tempo względem miesiąca.'}
          </div>
        )}
      </Card>

      <Card>
        <CardHead title="Godziny dzień po dniu" hint="Ostatnie dwa tygodnie z zakresu" />
        <BarChart data={chartData} height={90} format={formatHours} />
      </Card>

      <Card>
        <CardHead
          title="Czeka na wypłatę"
          hint={pending.length ? `${pending.length} dni · ${formatPLN(pendingTotal)}` : 'Wszystko rozliczone'}
          action={pending.length > 0 && (
            <button className="chip is-active" onClick={() => setSettleOpen(true)}>Rozlicz</button>
          )}
        />
        {pending.length === 0 ? (
          <EmptyState>Nie masz nierozliczonych dniówek.</EmptyState>
        ) : (
          <ul className="row-list">
            {pending.map((d) => (
              <li key={d.id}>
                <div className="row-item" style={{ cursor: 'default' }}>
                  <div className="row-main">
                    <span className="row-title">{formatDatePl(d.date)}</span>
                    <span className="row-sub">{formatHours(d.hours_worked)}</span>
                  </div>
                  <span className="row-value">{formatPLN(d.pay_amount)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SettleSheet
        open={settleOpen}
        pending={pending}
        onClose={() => setSettleOpen(false)}
        onDone={() => { setSettleOpen(false); load() }}
      />
    </div>
  )
}

function SettleSheet({ open, pending, onClose, onDone }) {
  const [selected, setSelected] = useState([])
  const [amount, setAmount] = useState('')
  const [payDate, setPayDate] = useState(todayISO())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setSelected(pending.map((d) => d.date))
      setAmount(String(pending.reduce((s, d) => s + Number(d.pay_amount ?? 0), 0)))
      setError('')
    }
  }, [open, pending])

  function toggle(date) {
    setSelected((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    const total = parseAmount(amount)
    if (!selected.length) return setError('Zaznacz przynajmniej jeden dzień.')
    if (total == null || total <= 0) return setError('Podaj łączną kwotę wypłaty.')

    setSaving(true)
    try {
      await settlePayment({ dates: selected, totalAmount: total, payDate })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title="Rozlicz wypłatę" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted">Zaznacz dni objęte tą wypłatą i wpisz łączną kwotę.</p>

        <ul className="row-list">
          {pending.map((d) => (
            <li key={d.date}>
              <button
                type="button"
                className={'habit-row' + (selected.includes(d.date) ? ' is-done' : '')}
                onClick={() => toggle(d.date)}
              >
                <span className="habit-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="4 12.5 9.5 18 20 6.5" />
                  </svg>
                </span>
                <div className="row-main">
                  <span className="row-title">{formatDatePl(d.date)}</span>
                  <span className="row-sub">{formatHours(d.hours_worked)}</span>
                </div>
                <span className="row-value">{formatPLN(d.pay_amount)}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="field-grid">
          <label className="field">
            <span>Łączna kwota</span>
            <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="field">
            <span>Data wypłaty</span>
            <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </label>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Zapisywanie…' : `Rozlicz ${selected.length} dni`}
        </button>
      </form>
    </Sheet>
  )
}
