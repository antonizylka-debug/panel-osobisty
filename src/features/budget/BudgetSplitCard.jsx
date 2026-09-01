import { useEffect, useMemo, useState } from 'react'
import {
  PRESETS, fetchBuckets, fetchCategoryMap, saveBuckets, assignCategory, bucketSummary,
} from './api'
import { fetchSavingsGoal } from '../start/api'
import SavingsGoalSheet from './SavingsGoalSheet'
import { useCategories } from '../expenses/useCategories'
import { formatPLN } from '../../lib/money'
import { todayISO, formatDatePl } from '../../lib/date'
import { savingsProjection } from '../../lib/savings'
import { Card, CardHead, ProgressBar, EmptyState, Sheet } from '../../components/ui'

/**
 * Podzial przychodu na koperty procentowe (50/30/20 i odmiany).
 * Przychod bierze sie z dniowek, wydatki z kategorii przypisanych do kopert.
 *
 * Koperta oszczednosciowa dodatkowo liczy sie w strone celu oszczednosciowego
 * (savings_goal) — ile jeszcze potrzeba, czy przy tym tempie sie uda i do kiedy.
 */
export default function BudgetSplitCard({ income, expenses }) {
  const [buckets, setBuckets] = useState([])
  const [categoryMap, setCategoryMap] = useState([])
  const [savings, setSavings] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [savingsOpen, setSavingsOpen] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  async function load() {
    try {
      const [b, m, s] = await Promise.all([fetchBuckets(), fetchCategoryMap(), fetchSavingsGoal()])
      setBuckets(b)
      setCategoryMap(m)
      setSavings(s)
      setError('')
    } catch (err) {
      setError(/budget_bucket/.test(err.message ?? '')
        ? 'Podział procentowy wymaga migracji 0013_budget_buckets.sql.'
        : err.message)
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => { load() }, [])

  const summary = useMemo(
    () => bucketSummary({ buckets, categoryMap, expenses, income }),
    [buckets, categoryMap, expenses, income]
  )

  if (!loaded) return null

  return (
    <>
      <Card>
        <CardHead
          title="Podział przychodu"
          hint={buckets.length
            ? buckets.map((b) => `${Math.round(b.percent)}%`).join(' / ')
            : 'Nie ustawiony'}
          action={
            <div className="chip-row">
              <button className="chip" onClick={() => setMapOpen(true)}>Kategorie</button>
              <button className="chip is-active" onClick={() => setEditOpen(true)}>Zmień</button>
            </div>
          }
        />

        {error && <p className="form-error" role="alert">{error}</p>}

        {!error && income <= 0 && (
          <EmptyState>
            Zapisz dniówki w Godzinach pracy — bez przychodu nie ma czego dzielić.
          </EmptyState>
        )}

        {!error && income > 0 && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Z {formatPLN(income)} zarobionych w tym miesiącu:
            </p>

            <table className="ledger mt-1">
              <thead>
                <tr>
                  <th>Koperta</th>
                  <th className="num">Plan</th>
                  <th className="num">Wydane</th>
                  <th className="num">Zostało</th>
                  <th className="status">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((b) => {
                  const over = !b.is_savings && b.left < 0
                  const status = b.is_savings
                    ? b.spent >= b.planned
                      ? { label: 'Zrealizowany', tone: ' is-success' }
                      : { label: 'W trakcie', tone: '' }
                    : b.ratio >= 1
                      ? { label: 'Przekroczono', tone: ' is-danger' }
                      : b.ratio >= 0.8
                        ? { label: 'Blisko limitu', tone: ' is-warn' }
                        : { label: 'W budżecie', tone: ' is-success' }

                  return (
                    <tr key={b.id}>
                      <td className="ledger-main" data-label="Koperta">
                        <span className="ledger-name">{b.name}</span>
                        <span className="ledger-sub">{Math.round(b.percent)}% przychodu</span>
                        <div className="ledger-bar">
                          <ProgressBar
                            value={Math.min(b.spent, b.planned)}
                            max={b.planned || 1}
                            tone={
                              b.is_savings
                                ? b.ratio >= 1 ? 'accent' : b.ratio >= 0.6 ? 'warn' : 'danger'
                                : b.ratio >= 1 ? 'danger' : b.ratio >= 0.8 ? 'warn' : 'accent'
                            }
                          />
                        </div>
                      </td>
                      <td className="num" data-label="Plan">{formatPLN(b.planned, { short: true })}</td>
                      <td className="num" data-label={b.is_savings ? 'Odłożone' : 'Wydane'}>
                        {formatPLN(b.spent, { short: true })}
                      </td>
                      <td className={'num' + (over ? ' is-negative' : '')}
                        data-label={b.is_savings ? 'Brakuje' : over ? 'Przekroczono' : 'Zostało'}>
                        {b.is_savings
                          ? formatPLN(Math.max(0, b.planned - b.spent), { short: true })
                          : formatPLN(Math.abs(b.left), { short: true })}
                      </td>
                      <td className="status" data-label="Status">
                        <span className={'badge' + status.tone}>{status.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {summary.rows.some((b) => b.is_savings) && (
              <SavingsGoalBlock
                savings={savings}
                monthlyRate={summary.rows.find((b) => b.is_savings)?.spent ?? 0}
                onEdit={() => setSavingsOpen(true)}
              />
            )}

            {summary.unassigned > 0 && (
              <div className="converter is-muted mt-1">
                {formatPLN(summary.unassigned)} w wydatkach bez przypisanej koperty —
                przypisz kategorie, żeby liczyło się do podziału.
              </div>
            )}
          </>
        )}
      </Card>

      <EditSheet
        open={editOpen}
        buckets={buckets}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); load() }}
      />

      <MapSheet
        open={mapOpen}
        buckets={buckets}
        categoryMap={categoryMap}
        onClose={() => setMapOpen(false)}
        onChanged={load}
      />

      <SavingsGoalSheet
        open={savingsOpen}
        savings={savings}
        onClose={() => setSavingsOpen(false)}
        onDone={() => { setSavingsOpen(false); load() }}
      />
    </>
  )
}

function EditSheet({ open, buckets, onClose, onSaved }) {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setRows(buckets.length
      ? buckets.map((b) => ({ name: b.name, percent: Number(b.percent), is_savings: b.is_savings }))
      : PRESETS[0].buckets.map((b) => ({ ...b })))
    setError('')
  }, [open, buckets])

  const sum = rows.reduce((s, r) => s + (Number(r.percent) || 0), 0)

  function update(i, patch) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')

    if (rows.some((r) => !r.name.trim())) return setError('Każda koperta musi mieć nazwę.')
    if (Math.round(sum) !== 100) return setError(`Procenty muszą sumować się do 100 — teraz jest ${Math.round(sum)}%.`)

    setBusy(true)
    try {
      await saveBuckets(rows)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} title="Podział przychodu" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <span className="field-label">Gotowe podziały</span>
        <div className="stack" style={{ gap: '.5rem' }}>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className="row-item"
              onClick={() => setRows(p.buckets.map((b) => ({ ...b })))}
            >
              <div className="row-main">
                <span className="row-title">{p.label}</span>
                <span className="row-sub">{p.hint}</span>
              </div>
            </button>
          ))}
        </div>

        <span className="field-label" style={{ marginTop: '.5rem' }}>Albo ustaw po swojemu</span>

        {rows.map((r, i) => (
          <div className="field-grid" key={i} style={{ gridTemplateColumns: '1fr 90px' }}>
            <label className="field">
              <span>Nazwa</span>
              <input type="text" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
            </label>
            <label className="field">
              <span>Procent</span>
              <input type="text" inputMode="decimal" value={r.percent}
                onChange={(e) => update(i, { percent: Number(String(e.target.value).replace(',', '.')) || 0 })} />
            </label>
          </div>
        ))}

        <div className={'converter' + (Math.round(sum) === 100 ? '' : ' is-muted')}>
          Razem: {Math.round(sum)}%
          {Math.round(sum) !== 100 && ` — musi wyjść 100%`}
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Zapisywanie…' : 'Zapisz podział'}
        </button>
      </form>
    </Sheet>
  )
}

function MapSheet({ open, buckets, categoryMap, onClose, onChanged }) {
  const categories = useCategories()
  const current = new Map(categoryMap.map((m) => [m.category, m.bucket_id]))
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  async function set(category, bucketId) {
    setBusy(category)
    setError('')
    try {
      await assignCategory(category, bucketId || null)
      await onChanged()
    } catch (err) {
      setError(`Nie zapisano „${category}": ${err.message}`)
    } finally { setBusy(null) }
  }

  return (
    <Sheet open={open} title="Kategorie w kopertach" onClose={onClose}>
      <div className="stack">
        <p className="muted">
          Z której koperty schodzi dany wydatek. Kategorie bez przypisania nie
          liczą się do podziału.
        </p>

        {error && <p className="form-error" role="alert">{error}</p>}

        {categories.map((c) => (
          <label className="field" key={c}>
            <span>{c}</span>
            <select
              value={current.get(c) ?? ''}
              disabled={busy === c}
              onChange={(e) => set(c, e.target.value)}
            >
              <option value="">— nieprzypisana —</option>
              {buckets.filter((b) => !b.is_savings).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </Sheet>
  )
}

/**
 * Ile z tego, co ta koperta faktycznie odklada co miesiac (monthlyRate),
 * przybliza do konkretnego celu z kwota i (opcjonalnie) terminem.
 */
function SavingsGoalBlock({ savings, monthlyRate, onEdit }) {
  const projection = savingsProjection(savings, monthlyRate, todayISO())

  if (!savings) {
    return (
      <div className="converter is-muted mt-1">
        Nie masz ustawionego celu (kwoty i terminu) dla tej koperty.{' '}
        <button className="chip" onClick={onEdit}>Ustaw cel</button>
      </div>
    )
  }

  return (
    <div className="converter mt-1">
      <div className="entry-head">
        <strong>{savings.title}</strong>
        <button className="chip" onClick={onEdit}>Zmień</button>
      </div>
      <p style={{ margin: '.3rem 0 0' }}>
        {formatPLN(savings.current_amount)} z {formatPLN(savings.target_amount)}
        {savings.target_date && <> · termin {formatDatePl(savings.target_date)}</>}
      </p>

      {projection?.done && <p style={{ margin: '.3rem 0 0' }}>Cel osiągnięty.</p>}

      {projection && !projection.done && (
        <p style={{ margin: '.3rem 0 0' }}>
          {projection.monthlyRate <= 0 ? (
            'W tym miesiącu nic nie odkładasz — na razie nie da się przewidzieć terminu.'
          ) : projection.targetDate ? (
            projection.onTrack ? (
              <>W tempie {formatPLN(projection.monthlyRate, { short: true })}/mies. uzbierasz to już{' '}
                {formatDatePl(projection.projectedDate)} — przed terminem ({formatDatePl(projection.targetDate)}).</>
            ) : (
              <>W tym tempie zdążysz dopiero {formatDatePl(projection.projectedDate)}.
                Żeby zdążyć do {formatDatePl(projection.targetDate)}, musisz odkładać{' '}
                {formatPLN(projection.requiredPerMonth, { short: true })}/mies.
                (teraz {formatPLN(projection.monthlyRate, { short: true })}/mies.)</>
            )
          ) : (
            <>W tempie {formatPLN(projection.monthlyRate, { short: true })}/mies. uzbierasz to{' '}
              {formatDatePl(projection.projectedDate)}.</>
          )}
        </p>
      )}
    </div>
  )
}
