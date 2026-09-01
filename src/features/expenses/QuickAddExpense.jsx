import { useEffect, useState } from 'react'
import { createExpense } from './api'
import { fetchCategories, DEFAULT_CATEGORIES } from './categoriesApi'
import { PAYMENT_METHODS } from './paymentMethods'
import { formatPLN, parseAmount } from '../../lib/money'
import { todayISO } from '../../lib/date'

/**
 * Dopisanie wydatku w trzech dotknieciach, prosto z Pulpitu.
 *
 * Pelny formularz (paragon, subskrypcja, kontekst pracy, kwota dla kogos)
 * zostaje na Wydatkach — tutaj tylko to, co trzeba wpisac stojac przy kasie:
 * kwota, kategoria, czym zaplacone.
 */
export default function QuickAddExpense({ onAdded }) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [method, setMethod] = useState('cash')
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(null)

  useEffect(() => {
    fetchCategories()
      .then((rows) => { if (rows.length) setCategories(rows.map((c) => c.name)) })
      .catch(() => { /* brak migracji 0018 — zostaja domyslne */ })
  }, [])

  async function submit(e) {
    e.preventDefault()
    setError('')
    const amt = parseAmount(amount)
    if (!amt || amt <= 0) return setError('Podaj kwotę.')

    setBusy(true)
    try {
      await createExpense({
        amount: amt,
        date: todayISO(),
        category: category || null,
        context: 'private',
        type: 'receipt',
        // payment_method wymaga migracji 0020; przy jej braku Supabase
        // odrzucilby cala wstawke, wiec pole leci tylko gdy jest wybrane.
        ...(method ? { payment_method: method } : {}),
      })
      setSaved(amt)
      setAmount('')
      setCategory('')
      setTimeout(() => setSaved(null), 2500)
      onAdded?.()
    } catch (err) {
      // Najczestsza przyczyna: kolumna payment_method jeszcze nie istnieje.
      if (/payment_method/.test(err.message)) {
        setError('Zapis bez metody płatności wymaga migracji 0020_payment_method.sql.')
      } else {
        setError(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="quick-expense" onSubmit={submit}>
      <div className="quick-expense-row">
        <label className="field quick-expense-amount">
          <span>Kwota</span>
          <input type="text" inputMode="decimal" value={amount} placeholder="0,00"
            onChange={(e) => setAmount(e.target.value)} />
        </label>

        <label className="field quick-expense-cat">
          <span>Kategoria</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">— bez kategorii —</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      <div className="quick-expense-row">
        <div className="field" style={{ flex: 1 }}>
          <span>Czym</span>
          <div className="segmented" role="group" aria-label="Metoda płatności">
            {PAYMENT_METHODS.map((m) => (
              <button key={m.value} type="button"
                className={'segmented-item' + (method === m.value ? ' is-active' : '')}
                onClick={() => setMethod(m.value)}>{m.label}</button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {saved != null && (
        <p className="muted">Zapisane: {formatPLN(saved)} · dzisiaj</p>
      )}

      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
        {busy ? 'Zapisywanie…' : 'Dopisz wydatek'}
      </button>
    </form>
  )
}
