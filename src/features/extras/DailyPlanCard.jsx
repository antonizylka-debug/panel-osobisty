import { useEffect, useState } from 'react'
import { saveDailyPlan } from './api'
import { Card, CardHead, EmptyState, Sheet } from '../../components/ui'
import { IconCheck } from '../../components/icons'

export default function DailyPlanCard({ plan, date, onChanged }) {
  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState([''])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editOpen) setDraft(plan?.items?.length ? [...plan.items] : [''])
  }, [editOpen, plan])

  const items = plan?.items ?? []
  const completed = plan?.completed ?? []
  const doneCount = completed.filter(Boolean).length

  async function toggleItem(i) {
    const next = [...completed]
    next[i] = !next[i]
    await saveDailyPlan({ date, items, completed: next })
    onChanged()
  }

  async function saveDraft(e) {
    e.preventDefault()
    setError('')
    const clean = draft.map((d) => d.trim()).filter(Boolean)
    if (clean.length === 0) return setError('Wpisz przynajmniej jedną rzecz.')
    if (clean.length > 5) return setError('Maksymalnie 5 rzeczy — to ma być plan, nie lista zadań.')

    setSaving(true)
    try {
      // Zachowaj odhaczenia dla pozycji, ktore sie nie zmienily.
      const nextCompleted = clean.map((text) => {
        const oldIndex = items.indexOf(text)
        return oldIndex >= 0 ? !!completed[oldIndex] : false
      })
      await saveDailyPlan({ date, items: clean, completed: nextCompleted })
      setEditOpen(false)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card>
        <CardHead
          title="Plan dnia"
          hint={items.length ? `${doneCount} z ${items.length}` : '3–5 najważniejszych rzeczy'}
          action={<button className="chip" onClick={() => setEditOpen(true)}>
            {items.length ? 'Zmień' : 'Ustaw'}
          </button>}
        />
        {items.length === 0 ? (
          <EmptyState>Nie masz jeszcze planu na dziś.</EmptyState>
        ) : (
          <ul className="row-list">
            {items.map((text, i) => (
              <li key={i}>
                <button className={'habit-row' + (completed[i] ? ' is-done' : '')}
                  onClick={() => toggleItem(i)} aria-pressed={!!completed[i]}>
                  <span className="habit-check"><IconCheck /></span>
                  <div className="row-main"><span className="row-title">{text}</span></div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Sheet open={editOpen} title="Plan dnia" onClose={() => setEditOpen(false)}>
        <form className="stack" onSubmit={saveDraft}>
          <p className="muted">Od 3 do 5 rzeczy, które naprawdę mają się dziś wydarzyć.</p>
          <div className="gratitude-items">
            {draft.map((value, i) => (
              <div className="gratitude-item-row" key={i}>
                <input type="text" value={value} placeholder={`${i + 1}.`}
                  onChange={(e) => setDraft((d) => d.map((v, idx) => (idx === i ? e.target.value : v)))} />
                {draft.length > 1 && (
                  <button type="button" className="gratitude-item-remove" aria-label="Usuń"
                    onClick={() => setDraft((d) => d.filter((_, idx) => idx !== i))}>×</button>
                )}
              </div>
            ))}
            {draft.length < 5 && (
              <button type="button" className="gratitude-add" onClick={() => setDraft((d) => [...d, ''])}>
                + Dodaj kolejny
              </button>
            )}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
            {saving ? 'Zapisywanie…' : 'Zapisz plan'}
          </button>
        </form>
      </Sheet>
    </>
  )
}
