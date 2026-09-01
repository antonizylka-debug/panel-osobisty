import { useCallback, useEffect, useState } from 'react'
import {
  fetchCashHistory, saveCashCount, deleteCashCount, fetchCashSpentSince,
  currentCash, lastChange, isMissingTable,
} from './api'
import { formatPLN, parseAmount } from '../../lib/money'
import { todayISO, formatDatePl } from '../../lib/date'
import { Card, CardHead, EmptyState, Sheet, Kebab } from '../../components/ui'
import { IconTrash } from '../../components/icons'

/**
 * Ile fizycznej gotowki lezy w domu.
 *
 * Zapisuje sie STAN ("mam teraz tyle"), a nie ruchy — gotowka rozchodzi sie
 * bez sladu, wiec sumowanie wplat i wyplat po miesiacu i tak by sie rozjechalo.
 * Przyciski "Dokładam" / "Wyjmuję" sa tylko skrotem: licza nowy stan i zapisuja
 * go jako kolejny spis.
 */
export default function CashOnHandCard({ refreshKey = 0 }) {
  const [history, setHistory] = useState([])
  const [spentSince, setSpentSince] = useState(0)
  const [sheetMode, setSheetMode] = useState(null) // 'count' | 'add' | 'take'
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const rows = await fetchCashHistory()
      setHistory(rows)
      setSpentSince(rows.length ? await fetchCashSpentSince(rows[0]) : 0)
      setNeedsMigration(false)
      setError('')
    } catch (err) {
      if (isMissingTable(err)) setNeedsMigration(true)
      else setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // refreshKey pozwala rodzicowi (Pulpit) przeladowac karte po dopisaniu
  // wydatku gotowka, zeby stan nie byl przez chwile nieaktualny.
  useEffect(() => { load() }, [load, refreshKey])

  if (loading) return null

  if (needsMigration) {
    return (
      <Card>
        <CardHead title="Gotówka w domu" />
        <div className="converter is-muted">
          Ta sekcja wymaga migracji <strong>0017_cash_on_hand.sql</strong> —
          wklej ją w Supabase → SQL Editor i odśwież stronę.
        </div>
      </Card>
    )
  }

  const counted = currentCash(history)
  const change = lastChange(history)
  const last = history[0]
  // Stan "na teraz" = ostatni spis minus gotowka wydana od tego spisu.
  const current = counted == null ? null : Math.max(0, counted - spentSince)

  return (
    <>
      <Card>
        <CardHead
          title="Gotówka w domu"
          hint={last ? `Ostatnio liczone ${formatDatePl(last.date)}` : 'Jeszcze nie liczone'}
          action={
            <div className="chip-row">
              <button className="chip" onClick={() => setSheetMode('take')}>− Wyjmuję</button>
              <button className="chip" onClick={() => setSheetMode('add')}>+ Dokładam</button>
              <button className="chip is-active" onClick={() => setSheetMode('count')}>Przeliczam</button>
            </div>
          }
        />

        {error && <p className="form-error" role="alert">{error}</p>}

        {current == null ? (
          <EmptyState>
            Przelicz gotówkę i zapisz stan — potem wystarczy dokładać i wyjmować.
          </EmptyState>
        ) : (
          <>
            <p className="big-number">{formatPLN(current)}</p>
            {spentSince > 0 ? (
              <p className="muted" style={{ marginTop: '.3rem' }}>
                Spisane {formatPLN(counted)} · {formatPLN(spentSince)} wydane gotówką od tamtej pory
              </p>
            ) : change != null && Math.abs(change) >= 0.01 ? (
              <p className="muted" style={{ marginTop: '.3rem' }}>
                {change > 0 ? '▲ ' : '▼ '}
                {formatPLN(Math.abs(change))} od poprzedniego spisu
              </p>
            ) : null}

            {history.length > 1 && (
              <p className="muted" style={{ marginTop: '.5rem', fontSize: '.8rem' }}>
                Liczysz od {formatDatePl(history[history.length - 1].date)} ·{' '}
                {history.length} {history.length === 1 ? 'spis' : history.length < 5 ? 'spisy' : 'spisów'}
              </p>
            )}

            {history.length > 1 && (
              <table className="ledger mt-1">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Opis</th>
                    <th className="num">Stan</th>
                    <th className="ledger-actions" />
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 8).map((row, i) => {
                    const prev = history[i + 1]
                    const diff = prev ? Number(row.amount) - Number(prev.amount) : null
                    return (
                      <tr key={row.id}>
                        <td className="ledger-main" data-label="Data">
                          <span className="ledger-name">{formatDatePl(row.date)}</span>
                          {diff != null && Math.abs(diff) >= 0.01 && (
                            <span className="ledger-sub">
                              {diff > 0 ? '+' : '−'}{formatPLN(Math.abs(diff), { short: true })}
                            </span>
                          )}
                        </td>
                        <td data-label="Opis">{row.note || '—'}</td>
                        <td className="num" data-label="Stan">{formatPLN(row.amount)}</td>
                        <td className="ledger-actions">
                          <Kebab items={[{
                            label: 'Usuń', icon: <IconTrash />, tone: 'danger',
                            onClick: async () => { await deleteCashCount(row.id); load() },
                          }]} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </Card>

      <CashSheet
        mode={sheetMode}
        current={current ?? 0}
        onClose={() => setSheetMode(null)}
        onSaved={() => { setSheetMode(null); load() }}
      />
    </>
  )
}

const MODE_TITLE = {
  count: 'Przelicz gotówkę',
  add: 'Dokładam do gotówki',
  take: 'Wyjmuję z gotówki',
}

function CashSheet({ mode, current, onClose, onSaved }) {
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!mode) return
    // Przy przeliczeniu podpowiadamy ostatni znany stan — zwykle poprawia sie
    // go o kilka zlotych, a nie wpisuje od zera.
    setValue(mode === 'count' && current > 0 ? String(current) : '')
    setNote('')
    setDate(todayISO())
    setError('')
  }, [mode, current])

  if (!mode) return null

  const amount = parseAmount(value)
  const nextTotal = mode === 'count' ? amount
    : mode === 'add' ? current + (amount ?? 0)
    : current - (amount ?? 0)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (amount == null || !(amount > 0)) return setError('Podaj kwotę większą od zera.')
    if (nextTotal < 0) return setError(`Nie możesz wyjąć więcej, niż masz (${formatPLN(current)}).`)

    setBusy(true)
    try {
      await saveCashCount({ date, amount: nextTotal, note })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open title={MODE_TITLE[mode]} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        {mode !== 'count' && (
          <p className="muted">
            Teraz w domu: <strong>{formatPLN(current)}</strong>
          </p>
        )}

        <label className="field">
          <span>
            {mode === 'count' ? 'Ile masz teraz łącznie'
              : mode === 'add' ? 'Ile dokładasz'
              : 'Ile wyjmujesz'}
          </span>
          <input type="text" inputMode="decimal" autoFocus value={value}
            onChange={(e) => setValue(e.target.value)} placeholder="np. 500" />
        </label>

        {mode !== 'count' && amount > 0 && (
          <div className="converter">
            Po zmianie zostanie: <strong>{formatPLN(nextTotal)}</strong>
          </div>
        )}

        <label className="field">
          <span>Notatka (opcjonalnie)</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={mode === 'take' ? 'np. zakupy' : 'np. wypłata z bankomatu'} />
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
