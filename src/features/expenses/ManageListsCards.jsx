import { useCallback, useEffect, useState } from 'react'
import {
  fetchCategories, createCategory, renameCategory,
  deactivateCategory, reactivateCategory, isMissingTable as noCategories,
} from './categoriesApi'
import {
  fetchRecurring, createRecurring, updateRecurring, deleteRecurring,
  CYCLES, CYCLE_LABEL, nextDue, isMissingTable as noRecurring,
} from './recurringApi'
import { PAYMENT_METHODS } from './paymentMethods'
import { formatPLN, parseAmount } from '../../lib/money'
import { todayISO, formatDatePl } from '../../lib/date'
import { Card, CardHead, EmptyState, Sheet, Kebab } from '../../components/ui'
import { IconEdit, IconTrash } from '../../components/icons'

function MigrationNotice({ file }) {
  return (
    <div className="converter is-muted">
      Wymaga migracji <strong>{file}</strong> — wklej ją w Supabase → SQL Editor
      i odśwież stronę.
    </div>
  )
}

/* ==========================================================================
   KATEGORIE WYDATKOW
   ========================================================================== */
export function CategoriesCard() {
  const [rows, setRows] = useState([])
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(null)
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setRows(await fetchCategories({ includeInactive: true }))
      setMissing(false)
    } catch (err) {
      if (noCategories(err)) setMissing(true)
      else setError(err.message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function add(e) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    try { await createCategory(name); setName(''); load() }
    catch (err) {
      setError(/duplicate|unique/i.test(err.message) ? 'Taka kategoria już istnieje.' : err.message)
    }
  }

  if (loading) return null

  return (
    <>
      <Card>
        <CardHead
          title="Kategorie wydatków"
          hint={missing ? undefined : `${rows.filter((r) => r.active).length} aktywnych`}
        />

        {missing ? <MigrationNotice file="0018_expense_categories.sql" /> : (
          <>
            <form className="quick-add" onSubmit={add}>
              <input type="text" value={name} maxLength={40} placeholder="Nowa kategoria…"
                onChange={(e) => setName(e.target.value)} />
              <button className="btn btn-primary" type="submit" disabled={!name.trim()}>Dodaj</button>
            </form>

            {error && <p className="form-error" role="alert">{error}</p>}

            {rows.length === 0 ? (
              <EmptyState>Brak kategorii.</EmptyState>
            ) : (
              <table className="ledger">
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td className="ledger-main" data-label="Kategoria">
                        <span className="ledger-name" style={{ opacity: c.active ? 1 : .5 }}>
                          {c.name}
                        </span>
                        {!c.active && <span className="ledger-sub">wyłączona</span>}
                      </td>
                      <td className="ledger-actions">
                        <Kebab items={[
                          { label: 'Zmień nazwę', icon: <IconEdit />, onClick: () => setEditing(c) },
                          c.active
                            ? {
                                label: 'Wyłącz', icon: <IconTrash />, tone: 'danger',
                                onClick: async () => { await deactivateCategory(c.id); load() },
                              }
                            : {
                                label: 'Włącz z powrotem', icon: <IconEdit />,
                                onClick: async () => { await reactivateCategory(c.id); load() },
                              },
                        ]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="muted mt-1">
              Wyłączenie nie rusza historii — stare wydatki dalej pokazują swoją
              kategorię, przestaje się tylko podpowiadać przy nowych.
            </p>
          </>
        )}
      </Card>

      <RenameSheet
        category={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load() }}
      />
    </>
  )
}

function RenameSheet({ category, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { if (category) { setName(category.name); setError('') } }, [category])
  if (!category) return null

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Podaj nazwę.')
    try { await renameCategory(category.id, name); onSaved() }
    catch (err) { setError(err.message) }
  }

  return (
    <Sheet open title="Zmień nazwę kategorii" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted">
          Zmiana nazwy nie przepisuje historycznych wydatków — te zachowają
          starą nazwę.
        </p>
        <label className="field">
          <span>Nazwa</span>
          <input type="text" value={name} maxLength={40} autoFocus
            onChange={(e) => setName(e.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit">Zapisz</button>
      </form>
    </Sheet>
  )
}

/* ==========================================================================
   WYDATKI CYKLICZNE
   ========================================================================== */
export function RecurringCard() {
  const [rows, setRows] = useState([])
  const [categories, setCategories] = useState([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setRows(await fetchRecurring({ includeInactive: true }))
      setMissing(false)
    } catch (err) {
      if (noRecurring(err)) setMissing(true)
      else setError(err.message)
    } finally { setLoading(false) }

    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return null

  const monthlyTotal = rows
    .filter((r) => r.active)
    .reduce((s, r) => {
      const factor = { weekly: 4.33, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[r.cycle] ?? 1
      return s + Number(r.amount) * factor
    }, 0)

  return (
    <>
      <Card>
        <CardHead
          title="Wydatki cykliczne"
          hint={missing ? undefined : `${formatPLN(monthlyTotal)} miesięcznie`}
          action={!missing && (
            <button className="chip is-active" onClick={() => setSheetOpen(true)}>+ Dodaj</button>
          )}
        />

        {missing ? <MigrationNotice file="0019_recurring_expenses.sql" /> : (
          <>
            {error && <p className="form-error" role="alert">{error}</p>}

            {rows.length === 0 ? (
              <EmptyState>
                Nic cyklicznego. Dopisz abonament albo rachunek, a apka będzie
                dodawać go sama.
              </EmptyState>
            ) : (
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Co</th>
                    <th>Cykl</th>
                    <th>Następny</th>
                    <th className="num">Kwota</th>
                    <th className="ledger-actions" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ opacity: r.active ? 1 : .5 }}>
                      <td className="ledger-main" data-label="Co">
                        <span className="ledger-name">{r.description}</span>
                        <span className="ledger-sub">
                          {r.category || 'bez kategorii'}{!r.active && ' · wstrzymany'}
                        </span>
                      </td>
                      <td data-label="Cykl">{CYCLE_LABEL[r.cycle]}</td>
                      <td data-label="Następny">{r.active ? formatDatePl(r.next_due) : '—'}</td>
                      <td className="num" data-label="Kwota">{formatPLN(r.amount)}</td>
                      <td className="ledger-actions">
                        <Kebab items={[
                          r.active
                            ? {
                                label: 'Wstrzymaj', icon: <IconEdit />,
                                onClick: async () => { await updateRecurring(r.id, { active: false }); load() },
                              }
                            : {
                                label: 'Wznów', icon: <IconEdit />,
                                onClick: async () => {
                                  await updateRecurring(r.id, { active: true, next_due: todayISO() })
                                  load()
                                },
                              },
                          {
                            label: 'Usuń', icon: <IconTrash />, tone: 'danger',
                            onClick: async () => { await deleteRecurring(r.id); load() },
                          },
                        ]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="muted mt-1">
              Zaległe wystąpienia dopisują się przy wejściu na Pulpit — także
              wtedy, gdy apka nie była otwierana przez kilka miesięcy.
            </p>
          </>
        )}
      </Card>

      <RecurringSheet
        open={sheetOpen}
        categories={categories}
        onClose={() => setSheetOpen(false)}
        onSaved={() => { setSheetOpen(false); load() }}
      />
    </>
  )
}

function RecurringSheet({ open, categories, onClose, onSaved }) {
  const [form, setForm] = useState({
    description: '', amount: '', category: '', cycle: 'monthly', next_due: todayISO(),
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    if (open) {
      setForm({ description: '', amount: '', category: '', cycle: 'monthly', next_due: todayISO() })
      setError('')
    }
  }, [open])

  async function submit(e) {
    e.preventDefault()
    setError('')
    const amt = parseAmount(form.amount)
    if (!form.description.trim()) return setError('Podaj nazwę.')
    if (!amt || amt <= 0) return setError('Podaj kwotę.')

    setBusy(true)
    try {
      await createRecurring({
        description: form.description.trim(),
        amount: amt,
        category: form.category || null,
        cycle: form.cycle,
        next_due: form.next_due,
        context: 'private',
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} title="Nowy wydatek cykliczny" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Co to jest</span>
          <input type="text" value={form.description} onChange={set('description')}
            placeholder="np. Netflix" autoFocus maxLength={120} />
        </label>

        <div className="field-grid">
          <label className="field">
            <span>Kwota</span>
            <input type="text" inputMode="decimal" value={form.amount} onChange={set('amount')} />
          </label>
          <label className="field">
            <span>Jak często</span>
            <select value={form.cycle} onChange={set('cycle')}>
              {CYCLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Kategoria</span>
            <select value={form.category} onChange={set('category')}>
              <option value="">— bez kategorii —</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Pierwsze wystąpienie</span>
            <input type="date" value={form.next_due} onChange={set('next_due')} />
          </label>
        </div>

        <div className="converter is-muted">
          Kolejne po nim: {formatDatePl(nextDue(form.next_due, form.cycle))}
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Zapisywanie…' : 'Dodaj'}
        </button>
      </form>
    </Sheet>
  )
}
