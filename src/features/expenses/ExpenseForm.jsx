import { useEffect, useState } from 'react'
import { createExpense, uploadReceipt } from './api'
import { fetchCategories, DEFAULT_CATEGORIES } from './categoriesApi'
import { PAYMENT_METHODS } from './paymentMethods'
import { parseAmount, formatPLN, formatHours } from '../../lib/money'
import { todayISO } from '../../lib/date'
import { useAuth } from '../../auth/AuthContext'
import { Segmented } from '../../components/ui'

export default function ExpenseForm({ hourlyRate, onSaved }) {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [type, setType] = useState('receipt')
  const [cycle, setCycle] = useState('monthly')
  const [context, setContext] = useState('private')
  const [forWhom, setForWhom] = useState('self')
  const [forWhomNote, setForWhomNote] = useState('')
  const [category, setCategory] = useState('')
  const [method, setMethod] = useState('card')
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Lista kategorii z konta; bez migracji 0018 zostaja wbudowane domyslne.
  useEffect(() => {
    fetchCategories()
      .then((rows) => { if (rows.length) setCategories(rows.map((c) => c.name)) })
      .catch(() => {})
  }, [])

  const parsed = parseAmount(amount)
  // Przelicznik widoczny od razu przy wpisywaniu kwoty — nie schowany.
  const hours = parsed != null && hourlyRate ? parsed / hourlyRate : null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (parsed == null || parsed < 0) return setError('Podaj kwotę.')

    setSaving(true)
    try {
      let receiptPath = null
      if (file) receiptPath = await uploadReceipt(user.id, file)

      const saved = await createExpense({
        amount: parsed,
        date,
        description: description.trim() || null,
        type,
        subscription_cycle: type === 'subscription' ? cycle : null,
        context,
        for_whom: context === 'work' ? forWhom : null,
        for_whom_note: context === 'work' && forWhom === 'someone_else' ? forWhomNote.trim() || null : null,
        category: category || null,
        receipt_url: receiptPath,
        // payment_method wymaga migracji 0020 — bez niej pole pomijamy,
        // zeby caly zapis nie leciał na błąd nieznanej kolumny.
        ...(method ? { payment_method: method } : {}),
      })
      onSaved(saved)
      setAmount(''); setDescription(''); setFile(null); setForWhomNote('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <label className="field">
        <span>Kwota</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
          style={{ fontSize: '1.5rem', fontWeight: 800 }}
        />
      </label>

      {parsed != null && parsed > 0 && (
        hours != null ? (
          <div className="converter">
            {formatPLN(parsed)} ≈ {formatHours(hours)} Twojej pracy
          </div>
        ) : (
          <div className="converter is-muted">
            Zapisz kilka dniówek w Godzinach pracy, a pokażę, ilu godzinom odpowiada ta kwota.
          </div>
        )
      )}

      <div className="field-grid">
        <label className="field">
          <span>Data</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Kategoria</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">—</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      <div className="field">
        <span>Czym zapłacone</span>
        <div className="segmented" role="group" aria-label="Metoda płatności">
          {PAYMENT_METHODS.map((m) => (
            <button key={m.value} type="button"
              className={'segmented-item' + (method === m.value ? ' is-active' : '')}
              onClick={() => setMethod(m.value)}>{m.label}</button>
          ))}
        </div>
        {method === 'cash' && (
          <p className="muted" style={{ marginTop: '.4rem' }}>
            Odejmie się od gotówki w domu.
          </p>
        )}
      </div>

      <label className="field">
        <span>Opis</span>
        <input type="text" placeholder="np. zakupy Biedronka" value={description}
          onChange={(e) => setDescription(e.target.value)} />
      </label>

      <label className="field">
        <span>Typ</span>
        <Segmented
          ariaLabel="Typ wydatku"
          value={type}
          onChange={setType}
          options={[{ value: 'receipt', label: 'Paragon' }, { value: 'subscription', label: 'Subskrypcja' }]}
        />
      </label>

      {type === 'subscription' && (
        <label className="field">
          <span>Cykl</span>
          <select value={cycle} onChange={(e) => setCycle(e.target.value)}>
            <option value="weekly">Tygodniowo</option>
            <option value="monthly">Miesięcznie</option>
            <option value="quarterly">Kwartalnie</option>
            <option value="yearly">Rocznie</option>
          </select>
        </label>
      )}

      <label className="field">
        <span>Kontekst</span>
        <Segmented
          ariaLabel="Kontekst"
          value={context}
          onChange={setContext}
          options={[{ value: 'private', label: 'Prywatne' }, { value: 'work', label: 'Praca' }]}
        />
      </label>

      {context === 'work' && (
        <>
          <label className="field">
            <span>Dla kogo</span>
            <Segmented
              ariaLabel="Dla kogo"
              value={forWhom}
              onChange={setForWhom}
              options={[{ value: 'self', label: 'Dla siebie' }, { value: 'someone_else', label: 'Dla kogoś' }]}
            />
          </label>
          {forWhom === 'someone_else' && (
            <label className="field">
              <span>Notatka</span>
              <input type="text" placeholder="dla kogo, po co" value={forWhomNote}
                onChange={(e) => setForWhomNote(e.target.value)} />
            </label>
          )}
        </>
      )}

      <label className="field">
        <span>Zdjęcie paragonu (opcjonalnie)</span>
        <input type="file" accept="image/*" capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file && <span className="muted">Zostanie skompresowane do ~200 KB</span>}
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
        {saving ? 'Zapisywanie…' : 'Dodaj wydatek'}
      </button>
    </form>
  )
}
