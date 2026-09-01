import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePeriod } from '../period/PeriodContext'
import {
  fetchIncomeRange, totalIncome, incomeEvents, monthlyTotals, formatMonth,
} from './api'
import { addExtraIncome, deleteExtraIncome } from '../expenses/api'
import { formatPLN, formatHours, parseAmount } from '../../lib/money'
import { todayISO, formatDatePl } from '../../lib/date'
import { rangeDays } from '../../lib/period'
import {
  Card, CardHead, EmptyState, Sheet, SummaryRow, BarChart, Kebab,
} from '../../components/ui'
import { IconTrash } from '../../components/icons'
import { PageLoader } from '../../components/FullScreenSpinner'
import PeriodPicker from '../../components/PeriodPicker'
import CashOnHandCard from '../cash/CashOnHandCard'
import SavingsHistoryCard from '../savings/SavingsHistoryCard'

export default function IncomePage() {
  const { range, previous } = usePeriod()
  const [data, setData] = useState(null)
  const [prevData, setPrevData] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [current, before] = await Promise.all([
        fetchIncomeRange(range.from, range.to),
        // Poprzedni okres sluzy tylko do strzalki "wiecej/mniej"; gdy zakres to
        // "wszystko", porownywac nie ma z czym.
        previous ? fetchIncomeRange(previous.from, previous.to) : Promise.resolve(null),
      ])
      setData(current)
      setPrevData(before)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [range.from, range.to, previous])

  useEffect(() => { load() }, [load])

  const derived = useMemo(() => {
    if (!data) return null

    const totals = totalIncome(data)
    const events = incomeEvents(data)
    const prevTotals = prevData ? totalIncome(prevData) : null

    const workedDays = data.workDays.filter((d) => Number(d.pay_amount) > 0).length
    const hours = data.workDays.reduce((s, d) => s + Number(d.hours_worked ?? 0), 0)
    const pending = data.workDays
      .filter((d) => d.pay_status === 'pending')
      .reduce((s, d) => s + Number(d.pay_amount ?? 0), 0)

    const days = rangeDays(range)

    return {
      ...totals,
      events,
      workedDays,
      hours,
      pending,
      perDay: days > 0 ? totals.total / days : 0,
      perHour: hours > 0 ? totals.fromWork / hours : null,
      avgDaily: workedDays > 0 ? totals.fromWork / workedDays : 0,
      delta: prevTotals ? totals.total - prevTotals.total : null,
      prevTotal: prevTotals?.total ?? null,
      byMonth: monthlyTotals(events),
    }
  }, [data, prevData, range])

  if (loading) return <PageLoader />

  return (
    <div className="page-pad">
      <div className="page-head">
        <h1 className="page-title">Przychody</h1>
        <div className="page-head-tools">
          <PeriodPicker />
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>+ Dodaj wpływ</button>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <SummaryRow
        items={[
          {
            label: 'Zarobione łącznie',
            value: formatPLN(derived.total),
            delta: derived.delta,
            deltaGood: 'up',
            deltaLabel: derived.delta != null ? formatPLN(Math.abs(derived.delta), { short: true }) : '',
            deltaHint: derived.prevTotal != null
              ? `vs ${formatPLN(derived.prevTotal, { short: true })}`
              : '',
            hint: derived.delta == null ? 'Brak okresu do porównania' : undefined,
          },
          {
            label: 'Z dniówek',
            value: formatPLN(derived.fromWork),
            hint: `${derived.workedDays} ${derived.workedDays === 1 ? 'dzień' : 'dni'} pracy`,
          },
          {
            label: 'Dodatkowa kasa',
            value: formatPLN(derived.fromExtra),
            hint: `${data.extraIncome.length} ${data.extraIncome.length === 1 ? 'wpływ' : 'wpływów'}`,
          },
          {
            label: 'Średnio dziennie',
            value: formatPLN(derived.perDay, { short: true }),
            hint: `${rangeDays(range)} dni w okresie`,
          },
        ]}
      />

      {/* Gotowka w domu nie zalezy od wybranego okresu — to stan na teraz,
          nie suma z zakresu dat. */}
      <CashOnHandCard />

      {/* Odkladanie tez jest stanem, nie suma z okresu. */}
      <SavingsHistoryCard />

      <Card>
        <CardHead title="Jak to się rozkłada" hint="W wybranym okresie" />
        <table className="ledger">
          <tbody>
            <tr>
              <td className="ledger-main" data-label="Pozycja">
                <span className="ledger-name">Średnia dniówka</span>
                <span className="ledger-sub">Tylko dni, w których pracowałeś</span>
              </td>
              <td className="num" data-label="Wartość">
                {derived.workedDays > 0 ? formatPLN(derived.avgDaily) : '—'}
              </td>
            </tr>
            <tr>
              <td className="ledger-main" data-label="Pozycja">
                <span className="ledger-name">Realna stawka godzinowa</span>
                <span className="ledger-sub">Dniówki podzielone przez przepracowane godziny</span>
              </td>
              <td className="num" data-label="Wartość">
                {derived.perHour ? `${formatPLN(derived.perHour)}/h` : '—'}
              </td>
            </tr>
            <tr>
              <td className="ledger-main" data-label="Pozycja">
                <span className="ledger-name">Przepracowane godziny</span>
              </td>
              <td className="num" data-label="Wartość">
                {derived.hours > 0 ? formatHours(derived.hours) : '—'}
              </td>
            </tr>
            <tr>
              <td className="ledger-main" data-label="Pozycja">
                <span className="ledger-name">Czeka na wypłatę</span>
                <span className="ledger-sub">Dniówki jeszcze nierozliczone</span>
              </td>
              <td className={'num' + (derived.pending > 0 ? '' : '')} data-label="Wartość">
                {derived.pending > 0 ? formatPLN(derived.pending) : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      {derived.byMonth.length > 1 && (
        <Card>
          <CardHead title="Miesiąc po miesiącu" hint="Wszystko, co wpadło w wybranym okresie" />
          <BarChart
            data={[...derived.byMonth].reverse().map((m) => ({
              label: m.month.slice(5),
              value: m.total,
            }))}
            height={90}
            format={(v) => formatPLN(v)}
          />
          <table className="ledger mt-1">
            <thead>
              <tr>
                <th>Miesiąc</th>
                <th className="num">Dniówki</th>
                <th className="num">Dodatkowe</th>
                <th className="num">Razem</th>
              </tr>
            </thead>
            <tbody>
              {derived.byMonth.map((m) => (
                <tr key={m.month}>
                  <td className="ledger-main" data-label="Miesiąc">
                    <span className="ledger-name" style={{ textTransform: 'capitalize' }}>
                      {formatMonth(m.month)}
                    </span>
                  </td>
                  <td className="num" data-label="Dniówki">{formatPLN(m.work, { short: true })}</td>
                  <td className="num" data-label="Dodatkowe">{formatPLN(m.extra, { short: true })}</td>
                  <td className="num" data-label="Razem">{formatPLN(m.total, { short: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <CardHead
          title="Wszystkie wpływy"
          hint={`${derived.events.length} ${derived.events.length === 1 ? 'pozycja' : 'pozycji'}`}
        />
        {derived.events.length === 0 ? (
          <EmptyState>Nic nie wpadło w tym okresie.</EmptyState>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Źródło</th>
                <th>Data</th>
                <th>Typ</th>
                <th className="num">Kwota</th>
                <th className="ledger-actions" />
              </tr>
            </thead>
            <tbody>
              {derived.events.map((ev) => (
                <tr key={ev.id}>
                  <td className="ledger-main" data-label="Źródło">
                    <span className="ledger-name">{ev.label}</span>
                    {ev.hours != null && ev.hours > 0 && (
                      <span className="ledger-sub">{formatHours(ev.hours)}</span>
                    )}
                  </td>
                  <td data-label="Data">{formatDatePl(ev.date)}</td>
                  <td data-label="Typ">
                    <span className={'badge' + (ev.source === 'work' ? '' : ' is-accent')}>
                      {ev.source === 'work' ? 'Dniówka' : 'Dodatkowe'}
                    </span>
                    {ev.source === 'work' && !ev.settled && (
                      <span className="badge is-warn" style={{ marginLeft: '.3rem' }}>Czeka</span>
                    )}
                  </td>
                  <td className="num" data-label="Kwota">{formatPLN(ev.amount)}</td>
                  <td className="ledger-actions">
                    {ev.source === 'extra' && (
                      <Kebab items={[{
                        label: 'Usuń', icon: <IconTrash />, tone: 'danger',
                        onClick: async () => {
                          await deleteExtraIncome(ev.id.slice(2))
                          load()
                        },
                      }]} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Sheet open={addOpen} title="Dodatkowa kasa" onClose={() => setAddOpen(false)}>
        <ExtraIncomeForm onSaved={() => { setAddOpen(false); load() }} />
      </Sheet>
    </div>
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
      <p className="muted">
        Dniówki zapisujesz w Godzinach pracy. Tutaj dopisujesz to, co wpadło poza nimi —
        napiwek, sprzedane coś, prezent.
      </p>
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
