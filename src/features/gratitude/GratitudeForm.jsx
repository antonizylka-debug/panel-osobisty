import { useEffect, useState } from 'react'
import MoodPicker from './MoodPicker'
import { saveTodayEntry, setFavorite } from './api'
import { IconGratitude } from '../../components/icons'

function itemsFromEntry(entry) {
  if (entry?.items?.length) return entry.items
  return ['']
}

export default function GratitudeForm({ date, entry, onSaved }) {
  const [items, setItems] = useState(itemsFromEntry(entry))
  const [reflection, setReflection] = useState(entry?.reflection ?? '')
  const [mood, setMood] = useState(entry?.mood ?? null)
  const [favorite, setFavoriteState] = useState(entry?.is_favorite ?? false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    setItems(itemsFromEntry(entry))
    setReflection(entry?.reflection ?? '')
    setMood(entry?.mood ?? null)
    setFavoriteState(entry?.is_favorite ?? false)
  }, [entry])

  function updateItem(i, value) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? value : it)))
  }
  function addItem() {
    setItems((prev) => (prev.length < 5 ? [...prev, ''] : prev))
  }
  function removeItem(i) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
  }

  async function handleFavoriteToggle() {
    if (!entry) return
    const next = !favorite
    setFavoriteState(next)
    try {
      await setFavorite(entry.id, next)
    } catch (err) {
      setFavoriteState(!next)
      setError(err.message)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const cleanItems = items.map((it) => it.trim()).filter(Boolean)
    if (cleanItems.length === 0) {
      setError('Wpisz przynajmniej jedną rzecz, za którą jesteś wdzięczny.')
      return
    }
    if (!mood) {
      setError('Wybierz nastrój dnia.')
      return
    }

    setSaving(true)
    try {
      const saved = await saveTodayEntry({ date, items: cleanItems, reflection, mood })
      setFavoriteState(saved.is_favorite)
      onSaved(saved)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="gratitude-form" onSubmit={handleSubmit}>
      <div className="gratitude-form-head">
        <span className="field-label">Za co jestem dziś wdzięczny?</span>
        {entry && (
          <button
            type="button"
            className={'favorite-toggle' + (favorite ? ' is-active' : '')}
            onClick={handleFavoriteToggle}
            aria-pressed={favorite}
            aria-label={favorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          >
            <IconGratitude style={favorite ? { fill: 'currentColor' } : undefined} />
          </button>
        )}
      </div>

      <div className="gratitude-items">
        {items.map((value, i) => (
          <div className="gratitude-item-row" key={i}>
            <input
              type="text"
              value={value}
              maxLength={140}
              placeholder={`${i + 1}.`}
              onChange={(e) => updateItem(i, e.target.value)}
            />
            {items.length > 1 && (
              <button
                type="button"
                className="gratitude-item-remove"
                onClick={() => removeItem(i)}
                aria-label="Usuń"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {items.length < 5 && (
          <button type="button" className="gratitude-add" onClick={addItem}>
            + Dodaj kolejny
          </button>
        )}
      </div>

      <label className="field">
        <span>Refleksja (opcjonalnie)</span>
        <textarea
          rows={2}
          placeholder="Kilka słów więcej, jeśli masz ochotę"
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Nastrój dnia</span>
        <MoodPicker value={mood} onChange={setMood} />
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
        {saving ? 'Zapisywanie…' : justSaved ? 'Zapisano ✓' : entry ? 'Zapisz zmiany' : 'Zapisz'}
      </button>
    </form>
  )
}
