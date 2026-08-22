import { useEffect, useState } from 'react'
import { fetchBlocks, createBlock, deleteBlock, fetchCategories } from './blocksApi'
import TimeInput from '../../components/TimeInput'
import DurationInput from '../../components/DurationInput'
import { EmptyState } from '../../components/ui'
import { formatHours } from '../../lib/money'

export const BUILT_IN = [
  { value: 'business', label: 'Nad własnym biznesem', hint: 'nauka, szukanie zleceń, ogarnianie firmy' },
  { value: 'personal', label: 'Dla siebie', hint: 'siłownia, rodzina, odpoczynek' },
]

export function categoryLabel(value, custom = []) {
  return BUILT_IN.find((c) => c.value === value)?.label
    ?? custom.find((c) => c === value)
    ?? value
}

/**
 * Bloki czasu poza dniowka. Zamiast wpisywac sama liczbe godzin,
 * dodajesz co robiles i od ktorej do ktorej.
 */
export default function TimeBlocks({ date, onChanged }) {
  const [blocks, setBlocks] = useState([])
  const [customCats, setCustomCats] = useState([])
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const [b, c] = await Promise.all([fetchBlocks(date), fetchCategories()])
      setBlocks(b)
      setCustomCats(c)
      setError('')
    } catch (err) {
      setError(/time_blocks/.test(err.message ?? '')
        ? 'Bloki czasu wymagają migracji 0011_time_blocks.sql — reszta wpisu działa normalnie.'
        : err.message)
    }
  }

  useEffect(() => { load() }, [date])

  async function remove(id) {
    setBusy(true)
    try {
      await deleteBlock(id)
      await load()
      onChanged?.()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const total = blocks.reduce((s, b) => s + Number(b.hours ?? 0), 0)

  const byCategory = blocks.reduce((acc, b) => {
    acc[b.category] = (acc[b.category] ?? 0) + Number(b.hours ?? 0)
    return acc
  }, {})

  return (
    <div className="stack">
      <div>
        <span className="field-label" style={{ display: 'block', marginBottom: '.2rem' }}>
          Poza dniówką (opcjonalnie)
        </span>
        <p className="muted" style={{ margin: 0 }}>
          Godziny powyżej to praca za pieniądze. Tutaj dopisujesz, co robiłeś poza nią
          i ile to zajęło — po tygodniu widać, czy Twój cel dostaje realny czas.
        </p>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {blocks.length === 0 ? (
        <EmptyState>Nic nie dopisane na ten dzień.</EmptyState>
      ) : (
        <ul className="row-list">
          {blocks.map((b) => (
            <li key={b.id}>
              <div className="row-item" style={{ cursor: 'default' }}>
                <div className="row-main">
                  <span className="row-title">{b.label || categoryLabel(b.category, customCats)}</span>
                  <span className="row-sub">
                    {categoryLabel(b.category, customCats)}
                    {b.start_time && b.end_time &&
                      ` · ${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)}`}
                  </span>
                </div>
                <span className="row-value">{formatHours(b.hours)}</span>
                <button type="button" className="chip" style={{ color: 'var(--danger)' }}
                  disabled={busy} onClick={() => remove(b.id)}>
                  Usuń
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {blocks.length > 0 && (
        <div className="converter">
          Razem poza dniówką: {formatHours(total)}
          <span style={{ display: 'block', fontWeight: 600, marginTop: '.25rem' }}>
            {Object.entries(byCategory)
              .map(([cat, h]) => `${categoryLabel(cat, customCats)}: ${formatHours(h)}`)
              .join(' · ')}
          </span>
        </div>
      )}

      {adding ? (
        <BlockForm
          date={date}
          customCats={customCats}
          onCancel={() => setAdding(false)}
          onSaved={async () => { setAdding(false); await load(); onChanged?.() }}
        />
      ) : (
        <button type="button" className="btn btn-ghost btn-block" onClick={() => setAdding(true)}>
          + Dopisz co robiłeś
        </button>
      )}
    </div>
  )
}

function BlockForm({ date, customCats, onCancel, onSaved }) {
  const [category, setCategory] = useState('business')
  const [newCategory, setNewCategory] = useState('')
  const [label, setLabel] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [hours, setHours] = useState('')
  const [mode, setMode] = useState('span')   // span = od-do, duration = sam czas
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isNew = category === '__new__'
  const hint = BUILT_IN.find((c) => c.value === category)?.hint

  async function submit(e) {
    e.preventDefault()
    e.stopPropagation()
    setError('')

    const finalCategory = isNew ? newCategory.trim() : category
    if (!finalCategory) return setError('Podaj nazwę kategorii.')

    if (mode === 'span') {
      if (!start || !end) return setError('Podaj godzinę początku i końca.')
    } else if (hours === '' || hours == null || Number(hours) <= 0) {
      return setError('Podaj, ile to zajęło.')
    }

    setBusy(true)
    try {
      await createBlock({
        date,
        category: finalCategory,
        label: label.trim() || null,
        startTime: mode === 'span' ? start : null,
        endTime: mode === 'span' ? end : null,
        hours: mode === 'duration' ? Number(hours) : null,
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 0, background: 'var(--surface-2)', boxShadow: 'none' }}>
      <div className="stack">
        <label className="field">
          <span>Kategoria</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {BUILT_IN.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            {customCats
              .filter((c) => !BUILT_IN.some((b) => b.value === c))
              .map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__new__">+ Własna kategoria…</option>
          </select>
          {hint && <span className="muted" style={{ fontWeight: 500 }}>{hint}</span>}
        </label>

        {isNew && (
          <label className="field">
            <span>Nazwa kategorii</span>
            <input type="text" value={newCategory} placeholder="np. Nauka angielskiego"
              onChange={(e) => setNewCategory(e.target.value)} />
          </label>
        )}

        <label className="field">
          <span>Co robiłeś</span>
          <input type="text" value={label} placeholder="np. robienie strony"
            onChange={(e) => setLabel(e.target.value)} />
        </label>

        <div className="segmented" role="group" aria-label="Sposób podania czasu">
          <button type="button" className={'segmented-item' + (mode === 'span' ? ' is-active' : '')}
            onClick={() => setMode('span')}>Od–do</button>
          <button type="button" className={'segmented-item' + (mode === 'duration' ? ' is-active' : '')}
            onClick={() => setMode('duration')}>Ile zajęło</button>
        </div>

        {mode === 'span' ? (
          <div className="field-grid">
            <label className="field">
              <span>Od</span>
              <TimeInput value={start} onChange={setStart} ariaLabel="Początek bloku" />
            </label>
            <label className="field">
              <span>Do</span>
              <TimeInput value={end} onChange={setEnd} ariaLabel="Koniec bloku" />
            </label>
          </div>
        ) : (
          <label className="field">
            <span>Ile zajęło</span>
            <DurationInput value={hours} onChange={setHours} ariaLabel="Czas trwania" />
          </label>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="onboard-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Anuluj</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Zapisywanie…' : 'Dodaj'}
          </button>
        </div>
      </div>
    </div>
  )
}
