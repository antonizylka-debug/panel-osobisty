import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchWishes, createWish, updateWish, deleteWish,
  affordability, savedByDeciding,
  WISH_STATUS_LABEL, PRIORITIES, PRIORITY_LABEL, isMissingTable,
} from './api'
import { fetchRealHourlyRate, fetchRange } from '../work/api'
import { fetchExpenses, fetchExtraIncome } from '../expenses/api'
import { fetchDebts } from '../debts/api'
import { formatPLN, formatHours, parseAmount } from '../../lib/money'
import { todayISO, addDaysISO, formatDatePl } from '../../lib/date'
import { Card, CardHead, EmptyState, Sheet, SummaryRow, Kebab } from '../../components/ui'
import { IconEdit, IconTrash } from '../../components/icons'
import { PageLoader } from '../../components/FullScreenSpinner'

function monthStart(iso) { return iso.slice(0, 8) + '01' }

export default function WishlistPage() {
  const [wishes, setWishes] = useState([])
  const [hourlyRate, setHourlyRate] = useState(null)
  const [monthlyRate, setMonthlyRate] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const today = todayISO()
    try {
      const [w, rate, days, exp, extra, debts] = await Promise.all([
        fetchWishes(),
        fetchRealHourlyRate(addDaysISO(today, -30)).catch(() => null),
        fetchRange(monthStart(today), today).catch(() => []),
        fetchExpenses({ from: monthStart(today), to: today }).catch(() => []),
        fetchExtraIncome({ from: monthStart(today), to: today }).catch(() => []),
        fetchDebts().catch(() => []),
      ])
      setWishes(w)
      setHourlyRate(rate)

      // Tempo odkladania = realny bilans miesiaca, nie deklaracja.
      const earned = days.reduce((s, d) => s + Number(d.pay_amount ?? 0), 0)
        + extra.reduce((s, e) => s + Number(e.amount), 0)
      const spent = exp.reduce((s, e) => s + Number(e.amount), 0)
      const installments = debts.filter((d) => d.active)
        .reduce((s, d) => s + Number(d.monthly_payment), 0)
      setMonthlyRate(earned - spent - installments)

      setMissing(false)
    } catch (err) {
      if (isMissingTable(err)) setMissing(true)
      else setError(err.message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const wanted = useMemo(() => wishes.filter((w) => w.status === 'chce'), [wishes])
  const decided = useMemo(() => wishes.filter((w) => w.status !== 'chce'), [wishes])
  const wantedTotal = wanted.reduce((s, w) => s + Number(w.price), 0)
  const saved = savedByDeciding(wishes)

  if (loading) return <PageLoader />

  if (missing) {
    return (
      <div className="page-pad">
        <h1 className="page-title">Lista rzeczy</h1>
        <Card>
          <div className="converter is-muted">
            Ta zakładka wymaga migracji <strong>0026_wishlist.sql</strong> —
            wklej ją w Supabase → SQL Editor i odśwież stronę.
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-pad">
      <div className="page-head">
        <h1 className="page-title">Lista rzeczy</h1>
        <div className="page-head-tools">
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>+ Dodaj rzecz</button>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <SummaryRow
        items={[
          { label: 'Na liście', value: String(wanted.length), hint: 'rzeczy, na które zbierasz' },
          { label: 'Razem kosztują', value: formatPLN(wantedTotal), hint: hourlyRate ? `${formatHours(wantedTotal / hourlyRate)} pracy` : undefined },
          {
            label: 'Tempo odkładania',
            value: monthlyRate > 0 ? `${formatPLN(monthlyRate, { short: true })}/mies.` : '—',
            hint: monthlyRate > 0 ? 'bilans tego miesiąca' : 'w tym miesiącu nic nie zostaje',
          },
          {
            label: 'Odpuszczone',
            value: formatPLN(saved),
            hint: 'tyle nie wydałeś dzięki liście',
          },
        ]}
      />

      <Card>
        <CardHead
          title="Chcę"
          hint={hourlyRate
            ? `Przy stawce ${formatPLN(hourlyRate)}/h`
            : 'Zapisz dniówki, a policzę to w godzinach pracy'}
        />
        {wanted.length === 0 ? (
          <EmptyState>
            Pusto. Wpisz rzecz, którą chcesz kupić — pokażę, ile to jest w
            godzinach Twojej pracy i kiedy Cię na nią stać.
          </EmptyState>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Rzecz</th>
                <th className="num">Cena</th>
                <th className="num">Godzin pracy</th>
                <th className="num">Kiedy Cię stać</th>
                <th className="ledger-actions" />
              </tr>
            </thead>
            <tbody>
              {wanted.map((w) => {
                const a = affordability({
                  price: w.price, hourlyRate, monthlyRate,
                })
                return (
                  <tr key={w.id}>
                    <td className="ledger-main" data-label="Rzecz">
                      <span className="ledger-name">{w.name}</span>
                      <span className="ledger-sub">
                        {PRIORITY_LABEL[w.priority]}
                        {w.note && ` · ${w.note}`}
                      </span>
                    </td>
                    <td className="num" data-label="Cena">{formatPLN(w.price)}</td>
                    <td className="num" data-label="Godzin pracy">
                      {a.hours != null ? formatHours(a.hours) : '—'}
                    </td>
                    <td className="num" data-label="Kiedy Cię stać">
                      {a.neverAtThisRate
                        ? 'nie przy tym tempie'
                        : a.weeks <= 1 ? 'w tym tygodniu'
                        : a.weeks < 8 ? `za ${Math.ceil(a.weeks)} tyg.`
                        : `za ${Math.ceil(a.months)} mies.`}
                    </td>
                    <td className="ledger-actions">
                      <Kebab items={[
                        { label: 'Zmień', icon: <IconEdit />, onClick: () => setEditing(w) },
                        {
                          label: 'Kupione', icon: <IconEdit />,
                          onClick: async () => {
                            await updateWish(w.id, { status: 'kupione', decided_at: todayISO() })
                            load()
                          },
                        },
                        {
                          label: 'Odpuszczam', icon: <IconEdit />,
                          onClick: async () => {
                            await updateWish(w.id, { status: 'odpuszczam', decided_at: todayISO() })
                            load()
                          },
                        },
                        {
                          label: 'Usuń', icon: <IconTrash />, tone: 'danger',
                          onClick: async () => { await deleteWish(w.id); load() },
                        },
                      ]} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {decided.length > 0 && (
        <Card>
          <CardHead title="Rozstrzygnięte" hint={`${decided.length}`} />
          <table className="ledger">
            <tbody>
              {decided.map((w) => (
                <tr key={w.id}>
                  <td className="ledger-main" data-label="Rzecz">
                    <span className="ledger-name">{w.name}</span>
                    <span className="ledger-sub">
                      {WISH_STATUS_LABEL[w.status]}
                      {w.decided_at && ` · ${formatDatePl(w.decided_at)}`}
                    </span>
                  </td>
                  <td className="num" data-label="Cena">{formatPLN(w.price)}</td>
                  <td className="ledger-actions">
                    <Kebab items={[
                      {
                        label: 'Wróć na listę', icon: <IconEdit />,
                        onClick: async () => {
                          await updateWish(w.id, { status: 'chce', decided_at: null })
                          load()
                        },
                      },
                      {
                        label: 'Usuń', icon: <IconTrash />, tone: 'danger',
                        onClick: async () => { await deleteWish(w.id); load() },
                      },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <WishSheet
        open={addOpen}
        wish={null}
        hourlyRate={hourlyRate}
        onClose={() => setAddOpen(false)}
        onSaved={() => { setAddOpen(false); load() }}
      />
      <WishSheet
        open={!!editing}
        wish={editing}
        hourlyRate={hourlyRate}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load() }}
      />
    </div>
  )
}

function WishSheet({ open, wish, hourlyRate, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', price: '', priority: 2, note: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    if (!open) return
    setForm({
      name: wish?.name ?? '',
      price: wish?.price != null ? String(wish.price) : '',
      priority: wish?.priority ?? 2,
      note: wish?.note ?? '',
    })
    setError('')
  }, [open, wish])

  if (!open) return null

  const price = parseAmount(form.price)
  const hours = price && hourlyRate ? price / hourlyRate : null

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Podaj nazwę.')
    if (!price || price <= 0) return setError('Podaj cenę.')

    setBusy(true)
    try {
      const payload = {
        name: form.name.trim(),
        price,
        priority: Number(form.priority),
        note: form.note.trim() || null,
      }
      if (wish) await updateWish(wish.id, payload)
      else await createWish(payload)
      onSaved()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <Sheet open title={wish ? 'Zmień rzecz' : 'Nowa rzecz'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Co to jest</span>
          <input type="text" value={form.name} onChange={set('name')} autoFocus maxLength={160}
            placeholder="np. nowe buty robocze" />
        </label>
        <div className="field-grid">
          <label className="field">
            <span>Cena</span>
            <input type="text" inputMode="decimal" value={form.price} onChange={set('price')} />
          </label>
          <label className="field">
            <span>Jak bardzo</span>
            <select value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
        </div>

        {hours != null && (
          <div className="converter">
            To {formatHours(hours)} Twojej pracy.
          </div>
        )}

        <label className="field">
          <span>Notatka (opcjonalnie)</span>
          <input type="text" value={form.note} onChange={set('note')} />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Zapisywanie…' : wish ? 'Zapisz' : 'Dodaj'}
        </button>
      </form>
    </Sheet>
  )
}
