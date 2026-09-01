import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import WorkDayForm from './WorkDayForm'
import { fetchDay, fetchRange, fetchPending, settlePayment, doorToDoorHours } from './api'
import { fetchBlocksRange } from './blocksApi'
import { categoryLabel } from './TimeBlocks'
import { todayISO, formatDatePl } from '../../lib/date'
import { formatPLN, formatHours, parseAmount } from '../../lib/money'
import { rangeDays } from '../../lib/period'
import { usePeriod } from '../period/PeriodContext'
import PeriodPicker from '../../components/PeriodPicker'
import { Card, CardHead, BarChart, EmptyState, SummaryRow, Sheet } from '../../components/ui'
import { PageLoader } from '../../components/FullScreenSpinner'

const DAY_TYPE_LABEL = { work: 'Praca', off: 'Wolne', vacation: 'Urlop', sick: 'L4' }

export default function WorkPage() {
  const today = todayISO()
  const { range: periodRange, previous } = usePeriod()
  const [params, setParams] = useSearchParams()
  const [date, setDate] = useState(params.get('data') ?? today)
  const [entry, setEntry] = useState(null)
  const [days, setDays] = useState([])
  const [prevDays, setPrevDays] = useState([])
  const [pending, setPending] = useState([])
  const [blocks, setBlocks] = useState([])
  const [settleOpen, setSettleOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [day, inRange, before, pend, blks] = await Promise.all([
        fetchDay(date),
        fetchRange(periodRange.from, periodRange.to),
        previous ? fetchRange(previous.from, previous.to) : Promise.resolve([]),
        fetchPending(),
        fetchBlocksRange(periodRange.from, periodRange.to).catch(() => []),
      ])
      setEntry(day)
      setDays(inRange)
      setPrevDays(before)
      setPending(pend)
      setBlocks(blks)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [date, periodRange.from, periodRange.to, previous])

  useEffect(() => { load() }, [load])

  function changeDate(next) {
    setDate(next)
    setParams(next === today ? {} : { data: next }, { replace: true })
  }

  function handleSaved(saved) {
    setEntry(saved)
    setDays((prev) => [saved, ...prev.filter((d) => d.date !== saved.date)].sort((a, b) => (a.date < b.date ? 1 : -1)))
    fetchPending().then(setPending).catch(() => {})
  }

  // Pobrane juz w granicach wybranego okresu.
  const scope = days

  const totals = useMemo(() => {
    let hours = 0, pay = 0, workDays = 0, offDays = 0
    for (const d of scope) {
      hours += Number(d.hours_worked ?? 0)
      pay += Number(d.pay_amount ?? 0)
      if (d.day_type === 'work') workDays++
      else offDays++
    }

    // Godziny poza dniowka biora sie z blokow czasu, nie z pol na work_days.
    // Bloki sa juz pobrane w tym samym zakresie, wiec nie trzeba ich ciac.
    const byCategory = {}
    for (const b of blocks) {
      byCategory[b.category] = (byCategory[b.category] ?? 0) + Number(b.hours ?? 0)
    }

    return { hours, pay, workDays, offDays, byCategory }
  }, [scope, blocks])

  // Poprzedni odcinek tej samej dlugosci — zeby porownanie bylo uczciwe.
  const prevTotals = useMemo(() => {
    let hours = 0, pay = 0
    for (const d of prevDays) { hours += Number(d.hours_worked ?? 0); pay += Number(d.pay_amount ?? 0) }
    return { hours, pay }
  }, [prevDays])

  const realRate = useMemo(() => {
    let pay = 0, span = 0
    for (const d of scope) {
      const s = doorToDoorHours(d.left_home_time, d.return_time) ?? Number(d.hours_worked ?? 0)
      if (s > 0 && d.pay_amount != null) { pay += Number(d.pay_amount); span += s }
    }
    return span > 0 ? pay / span : null
  }, [scope])

  const chartData = useMemo(
    () => [...scope].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-30)
      .map((d) => ({ label: d.date.slice(8), value: Number(d.hours_worked ?? 0) })),
    [scope]
  )

  // Srednia liczona tylko z dni, w ktorych faktycznie byly godziny —
  // dzielenie przez wszystkie dni okresu zanizaloby ja o dni wolne.
  const averages = useMemo(() => {
    const worked = scope.filter((d) => Number(d.hours_worked ?? 0) > 0)
    const total = worked.reduce((s, d) => s + Number(d.hours_worked), 0)
    const pay = worked.reduce((s, d) => s + Number(d.pay_amount ?? 0), 0)
    const weeks = rangeDays(periodRange) / 7

    return [{
      label: 'Wybrany okres',
      days: worked.length,
      total,
      avg: worked.length ? total / worked.length : 0,
      pay,
      avgPerWeek: weeks > 0 ? pay / weeks : 0,
    }]
  }, [scope, periodRange])

  const pendingTotal = pending.reduce((s, d) => s + Number(d.pay_amount ?? 0), 0)

  if (loading) return <PageLoader />

  return (
    <div className="page-pad">
      <div className="page-head">
        <h1 className="page-title">Godziny pracy</h1>
        <div className="page-head-tools">
          <PeriodPicker />
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <SummaryRow
        items={[
          {
            label: 'Przepracowane godziny',
            value: formatHours(totals.hours),
            delta: previous ? totals.hours - prevTotals.hours : null,
            deltaGood: 'up',
            deltaLabel: formatHours(Math.abs(totals.hours - prevTotals.hours)),
            deltaHint: `vs ${formatHours(prevTotals.hours)}`,
            hint: previous ? undefined : 'Brak okresu do porównania',
          },
          {
            label: 'Zarobione',
            value: formatPLN(totals.pay),
            delta: previous ? totals.pay - prevTotals.pay : null,
            deltaGood: 'up',
            deltaLabel: formatPLN(Math.abs(totals.pay - prevTotals.pay), { short: true }),
            deltaHint: `vs ${formatPLN(prevTotals.pay, { short: true })}`,
          },
          {
            label: 'Dni pracy',
            value: String(totals.workDays),
            hint: `${rangeDays(periodRange)} dni w okresie`,
          },
          {
            label: 'Realna stawka',
            value: realRate != null ? `${formatPLN(realRate)}/h` : '—',
            hint: 'Od wyjazdu do powrotu',
          },
        ]}
      />

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

      <Card>
        <CardHead title="Na co szedł czas" hint="W wybranym okresie" />
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
        <table className="ledger">
          <thead>
            <tr>
              <th>Okres</th>
              <th className="num">Dni</th>
              <th className="num">Łącznie</th>
              <th className="num">Śr. dziennie</th>
              <th className="num">Śr. / tydzień</th>
            </tr>
          </thead>
          <tbody>
            {averages.map((a) => (
              <tr key={a.label}>
                <td className="ledger-main" data-label="Okres">
                  <span className="ledger-name">{a.label}</span>
                </td>
                <td className="num" data-label="Dni">{a.days > 0 ? a.days : '—'}</td>
                <td className="num" data-label="Łącznie">{a.days > 0 ? formatHours(a.total) : '—'}</td>
                <td className="num" data-label="Śr. dziennie">{a.days > 0 ? formatHours(a.avg) : '—'}</td>
                <td className="num" data-label="Śr. / tydzień">
                  {a.days > 0 ? formatPLN(a.avgPerWeek, { short: true }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHead title="Godziny dzień po dniu" hint="W wybranym okresie" />
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
          <table className="ledger">
            <thead>
              <tr>
                <th>Dzień</th>
                <th className="num">Godziny</th>
                <th className="num">Dniówka</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((d) => (
                <tr key={d.id}>
                  <td className="ledger-main" data-label="Dzień">
                    <span className="ledger-name">{formatDatePl(d.date)}</span>
                  </td>
                  <td className="num" data-label="Godziny">{formatHours(d.hours_worked)}</td>
                  <td className="num" data-label="Dniówka">{formatPLN(d.pay_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
