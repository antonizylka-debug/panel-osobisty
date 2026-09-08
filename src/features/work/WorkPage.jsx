import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import WorkDayForm from './WorkDayForm'
import {
  fetchDay, fetchRange, fetchPending, settlePayment, setPayStatus, doorToDoorHours,
} from './api'
import { fetchBlocks, fetchBlocksRange } from './blocksApi'
import { categoryLabel } from './TimeBlocks'
import { todayISO, formatDatePl } from '../../lib/date'
import { formatPLN, formatHours, parseAmount } from '../../lib/money'
import { rangeDays } from '../../lib/period'
import { usePeriod } from '../period/PeriodContext'
import PeriodPicker from '../../components/PeriodPicker'
import { Card, CardHead, BarChart, EmptyState, SummaryRow, Segmented, Sheet } from '../../components/ui'
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
  // Dzien otwarty do podejrzenia — null gdy arkusz zamkniety.
  const [peekDate, setPeekDate] = useState(null)
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

  // Status poprawiony w podgladzie dnia. Podmieniamy wiersz w miejscu zamiast
  // przeladowywac strone — inaczej otwarty arkusz mrugnalby na spinner.
  // Pule "czeka na wyplate" trzeba pobrac na nowo, bo dzien z niej wypada.
  function handleDayPatched(saved) {
    setDays((prev) => prev.map((d) => (d.date === saved.date ? saved : d)))
    if (saved.date === date) setEntry(saved)
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
          title="Zapisane dni"
          hint="Kliknij dzień, żeby zobaczyć wpis i poprawić wypłatę"
        />
        {scope.length === 0 ? (
          <EmptyState>W tym okresie nie masz zapisanego żadnego dnia.</EmptyState>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Dzień</th>
                <th className="num">Godziny</th>
                <th className="num">Dniówka</th>
                <th className="status">Wypłata</th>
              </tr>
            </thead>
            <tbody>
              {scope.map((d) => (
                <tr
                  key={d.id ?? d.date}
                  className="is-clickable"
                  role="button"
                  tabIndex={0}
                  aria-label={daySummary(d)}
                  onClick={() => setPeekDate(d.date)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPeekDate(d.date) }
                  }}
                >
                  <td className="ledger-main" data-label="Dzień">
                    <span className="ledger-name">{formatDatePl(d.date)}</span>
                    <span className="ledger-sub">{DAY_TYPE_LABEL[d.day_type]}</span>
                    <DayTip day={d} />
                  </td>
                  <td className="num" data-label="Godziny">
                    {Number(d.hours_worked ?? 0) > 0 ? formatHours(d.hours_worked) : '—'}
                  </td>
                  <td className="num" data-label="Dniówka">
                    {d.pay_amount != null ? formatPLN(d.pay_amount) : '—'}
                  </td>
                  <td className="status" data-label="Wypłata"><PayBadge day={d} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
                <tr
                  key={d.id}
                  className="is-clickable"
                  role="button"
                  tabIndex={0}
                  aria-label={daySummary(d)}
                  onClick={() => setPeekDate(d.date)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPeekDate(d.date) }
                  }}
                >
                  <td className="ledger-main" data-label="Dzień">
                    <span className="ledger-name">{formatDatePl(d.date)}</span>
                    <DayTip day={d} />
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

      {peekDate && (
        <DayPeekSheet
          date={peekDate}
          onClose={() => setPeekDate(null)}
          onChanged={handleDayPatched}
          onEdit={(d) => { setPeekDate(null); changeDate(d) }}
        />
      )}
    </div>
  )
}

function PayBadge({ day }) {
  if (day.day_type !== 'work' || day.pay_amount == null) return <span className="muted">—</span>
  return day.pay_status === 'paid'
    ? <span className="badge is-success">Rozliczone</span>
    : <span className="badge is-warn">Czeka</span>
}

/** To samo streszczenie dla czytnika ekranu — dymek jest tylko wizualny. */
function daySummary(d) {
  const parts = [formatDatePl(d.date), DAY_TYPE_LABEL[d.day_type]]
  if (d.left_home_time && d.return_time) {
    parts.push(`${hhmm(d.left_home_time)}–${hhmm(d.return_time)}`)
  }
  if (Number(d.hours_worked ?? 0) > 0) parts.push(formatHours(d.hours_worked))
  if (d.pay_amount != null) {
    parts.push(`${formatPLN(d.pay_amount)}, ${d.pay_status === 'paid' ? 'rozliczone' : 'czeka na wypłatę'}`)
  }
  return `${parts.join(', ')}. Otwórz, żeby poprawić.`
}

/**
 * Dymek z pelnym wpisem, pokazywany po najechaniu na wiersz.
 *
 * Pomija pola, ktorych nie ma — pusta linia "Pobudka —" zajmuje miejsce
 * i nic nie mowi, a dymek ma sie czytac jednym rzutem oka.
 */
function DayTip({ day }) {
  const span = doorToDoorHours(day.left_home_time, day.return_time)
  const rows = [
    ['Rodzaj dnia', DAY_TYPE_LABEL[day.day_type]],
    day.wake_time && ['Pobudka', hhmm(day.wake_time)],
    (day.left_home_time || day.return_time)
      && ['Wyjazd → powrót', `${hhmm(day.left_home_time)} → ${hhmm(day.return_time)}`],
    day.left_base_time && ['Wyjazd z bazy', hhmm(day.left_base_time)],
    Number(day.hours_worked ?? 0) > 0 && ['Godziny', formatHours(day.hours_worked)],
    span > 0 && ['Od wyjazdu do powrotu', formatHours(span)],
    day.pay_amount != null && ['Dniówka', formatPLN(day.pay_amount)],
    day.pay_amount != null && ['Wypłata', day.pay_status === 'paid'
      ? (day.pay_date ? `Rozliczone · ${formatDatePl(day.pay_date)}` : 'Rozliczone')
      : 'Czeka'],
  ].filter(Boolean)

  return (
    <span className="daytip" aria-hidden="true">
      <span className="daytip-head">{formatDatePl(day.date)}</span>
      {rows.map(([label, value]) => (
        <span className="daytip-row" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </span>
      ))}
      <span className="daytip-foot">Kliknij, żeby poprawić wypłatę</span>
    </span>
  )
}

const hhmm = (t) => (t ? t.slice(0, 5) : '—')

/**
 * Podglad jednego dnia: co dokladnie bylo wpisane + przelacznik wyplaty.
 *
 * Dociaga dzien osobno zamiast dostac gotowy wiersz z listy, bo i tak trzeba
 * pobrac bloki czasu (siedza w innej tabeli), a przy okazji arkusz pokazuje
 * stan z bazy, nie ze stanu strony.
 */
function DayPeekSheet({ date, onClose, onChanged, onEdit }) {
  const [day, setDay] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    Promise.all([fetchDay(date), fetchBlocks(date).catch(() => [])])
      .then(([d, b]) => { if (alive) { setDay(d); setBlocks(b) } })
      .catch((err) => { if (alive) setError(err.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [date])

  async function changeStatus(next) {
    if (!day || next === day.pay_status) return
    setSaving(true)
    setError('')
    try {
      const saved = await setPayStatus({ date, status: next })
      setDay(saved)
      onChanged(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const span = day ? doorToDoorHours(day.left_home_time, day.return_time) : null
  const rows = day ? [
    ['Rodzaj dnia', DAY_TYPE_LABEL[day.day_type]],
    ['Pobudka', hhmm(day.wake_time)],
    ['Wyjazd z domu', hhmm(day.left_home_time)],
    ['Wyjazd z bazy', hhmm(day.left_base_time)],
    ['Powrót', hhmm(day.return_time)],
    ['Przepracowane godziny', Number(day.hours_worked ?? 0) > 0 ? formatHours(day.hours_worked) : '—'],
    ['Od wyjazdu do powrotu', span ? formatHours(span) : '—'],
    ['Dniówka', day.pay_amount != null ? formatPLN(day.pay_amount) : '—'],
    ['Data wypłaty', day.pay_date ? formatDatePl(day.pay_date) : '—'],
  ] : []

  // Dzien rozliczony w paczce z innymi — bez tego kwota na dniu wyglada
  // na wyssana z palca, bo to wyplata podzielona przez liczbe dni.
  if (day?.paid_for_dates?.length > 1) {
    rows.push(['Rozliczone razem z', `${day.paid_for_dates.length} dniami`])
  }

  return (
    <Sheet open title={formatDatePl(date)} onClose={onClose}>
      {loading ? (
        <p className="muted">Wczytywanie…</p>
      ) : !day ? (
        <EmptyState>Na ten dzień nic nie jest zapisane.</EmptyState>
      ) : (
        <div className="stack">
          {day.day_type === 'work' && day.pay_amount != null && (
            <label className="field">
              <span>Wypłata</span>
              <Segmented
                ariaLabel="Status wypłaty"
                value={day.pay_status}
                onChange={changeStatus}
                options={[
                  { value: 'pending', label: 'Czeka' },
                  { value: 'paid', label: 'Rozliczone' },
                ]}
              />
              <span className="muted" style={{ fontWeight: 500 }}>
                {saving ? 'Zapisywanie…' : 'Zmiana zapisuje się od razu'}
              </span>
            </label>
          )}

          <table className="ledger">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <td className="ledger-main" data-label="Pole">
                    <span className="ledger-name">{label}</span>
                  </td>
                  <td className="num" data-label="Wpisane">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {blocks.length > 0 && (
            <>
              <p className="muted">Poza dniówką</p>
              <table className="ledger">
                <tbody>
                  {blocks.map((b) => (
                    <tr key={b.id}>
                      <td className="ledger-main" data-label="Co">
                        <span className="ledger-name">{b.label || categoryLabel(b.category)}</span>
                        <span className="ledger-sub">{categoryLabel(b.category)}</span>
                      </td>
                      <td className="num" data-label="Czas">{formatHours(b.hours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="btn btn-block" type="button" onClick={() => onEdit(date)}>
            Otwórz do edycji
          </button>
        </div>
      )}
    </Sheet>
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
