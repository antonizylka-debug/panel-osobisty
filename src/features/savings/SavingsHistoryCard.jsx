import { useCallback, useEffect, useState } from 'react'
import {
  fetchDeposits, addDeposit, deleteDeposit, depositStats, setHeldIn, setCurrentAmount,
  SOURCES, SOURCE_LABEL, isMissingTable,
} from './api'
import { fetchSavingsGoal } from '../start/api'
import { fetchCashHistory, fetchCashSpentSince, currentCash } from '../cash/api'
import { formatPLN, parseAmount } from '../../lib/money'
import { todayISO, formatDatePl, daysBetweenISO } from '../../lib/date'
import { Card, CardHead, EmptyState, Sheet, ProgressBar, Kebab } from '../../components/ui'
import { IconTrash } from '../../components/icons'

/**
 * Odkladanie na cel: od kiedy, jak dlugo, skad i w jakim tempie.
 */
export default function SavingsHistoryCard() {
  const [deposits, setDeposits] = useState([])
  const [goal, setGoal] = useState(null)
  const [cashNow, setCashNow] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [fixOpen, setFixOpen] = useState(false)
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [rows, g] = await Promise.all([fetchDeposits(), fetchSavingsGoal()])
      setDeposits(rows)
      setGoal(g)
      setMissing(false)
    } catch (err) {
      if (isMissingTable(err)) setMissing(true)
      else setError(err.message)
    } finally { setLoading(false) }

    // Realny stan gotowki — podpowiedz przy poprawianiu kwoty. Brak tabeli
    // (migracja 0017) po prostu wylacza podpowiedz, nie psuje karty.
    try {
      const history = await fetchCashHistory()
      if (history.length) {
        const spent = await fetchCashSpentSince(history[0])
        setCashNow(Math.max(0, currentCash(history) - spent))
      }
    } catch { /* brak gotowki — trudno */ }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return null

  if (missing) {
    return (
      <Card>
        <CardHead title="Odkładanie" />
        <div className="converter is-muted">
          Historia odkładania wymaga migracji <strong>0021_savings_deposits.sql</strong> —
          wklej ją w Supabase → SQL Editor i odśwież stronę.
        </div>
      </Card>
    )
  }

  const stats = depositStats(deposits)
  const current = Number(goal?.current_amount ?? 0)
  const target = Number(goal?.target_amount ?? 0)
  const daysToTarget = goal?.target_date ? daysBetweenISO(todayISO(), goal.target_date) : null

  return (
    <>
      <Card>
        <CardHead
          title="Odkładanie"
          hint={goal ? `Cel: ${goal.title}` : 'Nie masz ustawionego celu'}
          action={goal && (
            <div className="chip-row">
              <button className="chip" onClick={() => setFixOpen(true)}>Popraw kwotę</button>
              <button className="chip is-active" onClick={() => setAddOpen(true)}>+ Odłożyłem</button>
            </div>
          )}
        />

        {error && <p className="form-error" role="alert">{error}</p>}

        {!goal ? (
          <EmptyState>Ustaw cel oszczędnościowy, żeby śledzić odkładanie.</EmptyState>
        ) : (
          <>
            <p className="big-number">{formatPLN(current)}</p>
            <p className="muted" style={{ marginTop: '.3rem' }}>
              z {formatPLN(target)}
              {target > 0 && ` · ${Math.round((current / target) * 100)}%`}
              {daysToTarget != null && daysToTarget >= 0 && ` · ${daysToTarget} dni do terminu`}
              {daysToTarget != null && daysToTarget < 0 && ' · termin minął'}
            </p>
            {target > 0 && (
              <div style={{ marginTop: '.6rem' }}>
                <ProgressBar value={current} max={target} />
              </div>
            )}

            {/* Decyduje, czy wartosc netto doliczy odlozone osobno, czy uzna
                je za czesc gotowki w domu — inaczej ta sama kwota liczy sie
                dwa razy. */}
            <div style={{ marginTop: '1rem' }}>
              <span className="mini-stats-label">Gdzie je trzymasz</span>
              <div className="segmented" role="group" aria-label="Gdzie trzymasz odłożone">
                {[
                  { value: 'cash', label: 'W gotówce w domu' },
                  { value: 'separate', label: 'Osobno' },
                ].map((o) => (
                  <button key={o.value} type="button"
                    className={'segmented-item' + ((goal.held_in ?? 'cash') === o.value ? ' is-active' : '')}
                    onClick={async () => {
                      try { await setHeldIn(o.value); load() }
                      catch (err) {
                        setError(/held_in/.test(err.message)
                          ? 'Wymaga migracji 0022_savings_held_in.sql.'
                          : err.message)
                      }
                    }}>{o.label}</button>
                ))}
              </div>
              <p className="muted" style={{ marginTop: '.4rem', fontSize: '.8rem' }}>
                {(goal.held_in ?? 'cash') === 'cash'
                  ? 'Odłożone to część gotówki w domu — wartość netto nie liczy ich drugi raz.'
                  : 'Odłożone leżą poza gotówką (konto, lokata) — wartość netto dolicza je osobno.'}
              </p>
            </div>

            {stats ? (
              <table className="ledger mt-1">
                <tbody>
                  <tr>
                    <td className="ledger-main" data-label="Pozycja">
                      <span className="ledger-name">Odkładasz od</span>
                      <span className="ledger-sub">{stats.days} dni temu</span>
                    </td>
                    <td className="num" data-label="Wartość">{formatDatePl(stats.firstDate)}</td>
                  </tr>
                  <tr>
                    <td className="ledger-main" data-label="Pozycja">
                      <span className="ledger-name">Wpłaty</span>
                      <span className="ledger-sub">w {stats.distinctDays} różnych dniach</span>
                    </td>
                    <td className="num" data-label="Wartość">{stats.count}</td>
                  </tr>
                  <tr>
                    <td className="ledger-main" data-label="Pozycja">
                      <span className="ledger-name">Tempo</span>
                      <span className="ledger-sub">średnio od pierwszej wpłaty</span>
                    </td>
                    <td className="num" data-label="Wartość">
                      {formatPLN(stats.perMonth, { short: true })}/mies.
                    </td>
                  </tr>
                  <tr>
                    <td className="ledger-main" data-label="Pozycja">
                      <span className="ledger-name">Ostatnia wpłata</span>
                    </td>
                    <td className="num" data-label="Wartość">
                      {stats.daysSinceLast === 0 ? 'dzisiaj'
                        : stats.daysSinceLast === 1 ? 'wczoraj'
                        : `${stats.daysSinceLast} dni temu`}
                    </td>
                  </tr>
                  {stats.withdrawn > 0 && (
                    <tr>
                      <td className="ledger-main" data-label="Pozycja">
                        <span className="ledger-name">Wyjęte z odłożonych</span>
                      </td>
                      <td className="num is-negative" data-label="Wartość">
                        {formatPLN(stats.withdrawn)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <EmptyState>
                Brak historii wpłat. Kliknij „Odłożyłem”, żeby zacząć ją zbierać.
              </EmptyState>
            )}

            {stats && stats.bySource.length > 0 && (
              <>
                <span className="mini-stats-label" style={{ marginTop: '1rem' }}>Skąd to się bierze</span>
                <table className="ledger">
                  <tbody>
                    {stats.bySource.map((s) => (
                      <tr key={s.source}>
                        <td className="ledger-main" data-label="Źródło">
                          <span className="ledger-name">{SOURCE_LABEL[s.source] ?? s.source}</span>
                        </td>
                        <td className="num" data-label="Udział">{Math.round(s.share * 100)}%</td>
                        <td className="num" data-label="Kwota">{formatPLN(s.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {deposits.length > 0 && (
              <>
                <span className="mini-stats-label" style={{ marginTop: '1rem' }}>Historia</span>
                <table className="ledger">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Skąd</th>
                      <th className="num">Kwota</th>
                      <th className="ledger-actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.slice(0, 12).map((d) => (
                      <tr key={d.id}>
                        <td className="ledger-main" data-label="Data">
                          <span className="ledger-name">{formatDatePl(d.date)}</span>
                          {d.note && <span className="ledger-sub">{d.note}</span>}
                        </td>
                        <td data-label="Skąd">{SOURCE_LABEL[d.source] ?? d.source}</td>
                        <td className={'num' + (Number(d.amount) < 0 ? ' is-negative' : '')}
                          data-label="Kwota">
                          {Number(d.amount) < 0 ? '− ' : ''}{formatPLN(Math.abs(Number(d.amount)))}
                        </td>
                        <td className="ledger-actions">
                          <Kebab items={[{
                            label: 'Usuń', icon: <IconTrash />, tone: 'danger',
                            onClick: async () => {
                              await deleteDeposit({ id: d.id, amount: d.amount, currentAmount: current })
                              load()
                            },
                          }]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </Card>

      <DepositSheet
        open={addOpen}
        currentAmount={current}
        onClose={() => setAddOpen(false)}
        onSaved={() => { setAddOpen(false); load() }}
      />

      <FixAmountSheet
        open={fixOpen}
        currentAmount={current}
        cashNow={cashNow}
        onClose={() => setFixOpen(false)}
        onSaved={() => { setFixOpen(false); load() }}
      />
    </>
  )
}

/**
 * Sprostowanie kwoty odlozonych — gdy liczba w apce rozjechala sie z tym,
 * co faktycznie masz. To nie jest wplata, wiec nie trafia do historii.
 */
function FixAmountSheet({ open, currentAmount, cashNow, onClose, onSaved }) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) { setAmount(String(currentAmount ?? '')); setError('') }
  }, [open, currentAmount])

  if (!open) return null

  async function submit(e) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (value == null || value < 0) return setError('Podaj kwotę.')

    setBusy(true)
    try {
      await setCurrentAmount(value)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  return (
    <Sheet open title="Popraw odłożoną kwotę" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted">
          Wpisz, ile <strong>naprawdę</strong> masz odłożone. To korekta liczby,
          a nie wpłata — nie trafi do historii i nie zmieni wyliczonego tempa.
        </p>

        {cashNow != null && (
          <div className="converter">
            Gotówka w domu na teraz: <strong>{formatPLN(cashNow)}</strong>
            <button type="button" className="chip" style={{ marginLeft: '.6rem' }}
              onClick={() => setAmount(String(cashNow))}>
              Wstaw tę kwotę
            </button>
          </div>
        )}

        <label className="field">
          <span>Odłożone</span>
          <input type="text" inputMode="decimal" autoFocus value={amount}
            onChange={(e) => setAmount(e.target.value)} />
        </label>

        <p className="muted">
          Teraz w apce: {formatPLN(currentAmount)}
        </p>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Zapisywanie…' : 'Zapisz kwotę'}
        </button>
      </form>
    </Sheet>
  )
}

function DepositSheet({ open, currentAmount, onClose, onSaved }) {
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState('dniowka')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayISO())
  const [withdraw, setWithdraw] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount(''); setSource('dniowka'); setNote('')
      setDate(todayISO()); setWithdraw(false); setError('')
    }
  }, [open])

  async function submit(e) {
    e.preventDefault()
    setError('')
    const amt = parseAmount(amount)
    if (!amt || amt <= 0) return setError('Podaj kwotę.')
    if (withdraw && amt > currentAmount) {
      return setError(`Nie możesz wyjąć więcej, niż jest odłożone (${formatPLN(currentAmount)}).`)
    }

    setBusy(true)
    try {
      await addDeposit({
        date,
        amount: withdraw ? -amt : amt,
        source,
        note,
        currentAmount,
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} title={withdraw ? 'Wyjmuję z odłożonych' : 'Odkładam na cel'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="segmented" role="group" aria-label="Kierunek">
          <button type="button" className={'segmented-item' + (!withdraw ? ' is-active' : '')}
            onClick={() => setWithdraw(false)}>Odkładam</button>
          <button type="button" className={'segmented-item' + (withdraw ? ' is-active' : '')}
            onClick={() => setWithdraw(true)}>Wyjmuję</button>
        </div>

        <p className="muted">
          Odłożone teraz: <strong>{formatPLN(currentAmount)}</strong>
        </p>

        <label className="field">
          <span>Kwota</span>
          <input type="text" inputMode="decimal" autoFocus value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="np. 500" />
        </label>

        {!withdraw && (
          <label className="field">
            <span>Skąd te pieniądze</span>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        )}

        <label className="field">
          <span>Notatka (opcjonalnie)</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <label className="field">
          <span>Data</span>
          <input type="date" value={date} max={todayISO()}
            onChange={(e) => setDate(e.target.value)} />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Zapisywanie…' : 'Zapisz'}
        </button>
      </form>
    </Sheet>
  )
}
