import { useEffect, useState } from 'react'
import { saveSavingsGoal } from '../start/api'
import { parseAmount } from '../../lib/money'
import { Sheet } from '../../components/ui'

/**
 * Edycja celu oszczednosciowego (nazwa, uzbierane, potrzebne, termin).
 * Wspoldzielona miedzy karta "Cele" na Starcie i kopertom "Oszczednosci"
 * w Podziale przychodu — obie edytuja ten sam wiersz savings_goal.
 */
export default function SavingsGoalSheet({ open, savings, onClose, onDone }) {
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [current, setCurrent] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(savings?.title ?? '')
    setTarget(savings?.target_amount != null ? String(savings.target_amount) : '')
    setCurrent(savings?.current_amount != null ? String(savings.current_amount) : '')
    setTargetDate(savings?.target_date ?? '')
    setError('')
  }, [open, savings])

  async function submit(e) {
    e.preventDefault()
    const t = parseAmount(target)
    if (!title.trim()) return setError('Podaj nazwę celu.')
    if (!t || t <= 0) return setError('Podaj kwotę do uzbierania.')
    try {
      await saveSavingsGoal({
        title: title.trim(),
        targetAmount: t,
        currentAmount: parseAmount(current) ?? 0,
        targetDate: targetDate || null,
      })
      onDone()
    } catch (err) { setError(err.message) }
  }

  return (
    <Sheet open={open} title="Cel oszczędnościowy" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Na co zbierasz</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="np. Start biznesu" />
        </label>
        <div className="field-grid">
          <label className="field">
            <span>Uzbierane</span>
            <input type="text" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className="field">
            <span>Potrzebne</span>
            <input type="text" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Termin (opcjonalnie)</span>
          <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit">Zapisz</button>
      </form>
    </Sheet>
  )
}
