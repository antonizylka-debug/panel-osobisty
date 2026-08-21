import { useState } from 'react'
import { toggleHabit, habitStreak, createHabit, deactivateHabit } from './api'
import { Card, CardHead, EmptyState, Sheet } from '../../components/ui'
import { IconCheck } from '../../components/icons'

export default function HabitsCard({ habits, logs, today, onChanged }) {
  const [manageOpen, setManageOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(null)

  const doneToday = new Set(
    logs.filter((l) => l.date === today && l.done).map((l) => l.habit_id)
  )

  async function toggle(habit) {
    setBusy(habit.id)
    try {
      await toggleHabit({ habitId: habit.id, date: today, done: !doneToday.has(habit.id) })
      onChanged()
    } finally { setBusy(null) }
  }

  return (
    <>
      <Card>
        <CardHead
          title="Małe nawyki"
          hint={`${doneToday.size} z ${habits.length} dziś`}
          action={<button className="chip" onClick={() => setManageOpen(true)}>Edytuj</button>}
        />
        {habits.length === 0 ? (
          <EmptyState>Brak nawyków — dodaj je przyciskiem Edytuj.</EmptyState>
        ) : (
          <ul className="row-list">
            {habits.map((h) => {
              const done = doneToday.has(h.id)
              const streak = habitStreak(h.id, logs, today)
              return (
                <li key={h.id}>
                  <button
                    className={'habit-row' + (done ? ' is-done' : '')}
                    onClick={() => toggle(h)}
                    disabled={busy === h.id}
                    aria-pressed={done}
                  >
                    <span className="habit-check"><IconCheck /></span>
                    <div className="row-main">
                      <span className="row-title">{h.name}</span>
                    </div>
                    {streak > 0 && <span className="habit-streak">{streak} dni</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Sheet open={manageOpen} title="Nawyki" onClose={() => setManageOpen(false)}>
        <div className="stack">
          <form className="stack" onSubmit={async (e) => {
            e.preventDefault()
            if (!newName.trim()) return
            await createHabit(newName.trim())
            setNewName('')
            onChanged()
          }}>
            <label className="field">
              <span>Nowy nawyk</span>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="np. 20 pompek" />
            </label>
            <button className="btn btn-primary btn-block" type="submit">Dodaj</button>
          </form>

          <ul className="row-list">
            {habits.map((h) => (
              <li key={h.id}>
                <div className="row-item" style={{ cursor: 'default' }}>
                  <div className="row-main"><span className="row-title">{h.name}</span></div>
                  <button className="chip" style={{ color: 'var(--danger)' }}
                    onClick={async () => { await deactivateHabit(h.id); onChanged() }}>
                    Usuń
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </>
  )
}
