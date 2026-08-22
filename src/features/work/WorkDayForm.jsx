import { useEffect, useMemo, useState } from 'react'
import { diffHours, doorToDoorHours, saveDay } from './api'
import { formatPLN, formatHours, parseAmount } from '../../lib/money'
import { Segmented } from '../../components/ui'

const DAY_TYPES = [
  { value: 'work', label: 'Praca' },
  { value: 'off', label: 'Wolne' },
  { value: 'vacation', label: 'Urlop' },
  { value: 'sick', label: 'L4' },
]

const empty = {
  wake_time: '', left_home_time: '', left_base_time: '', return_time: '',
  hours_worked: '', pay_amount: '', business_hours: '', personal_hours: '',
  day_type: 'work', pay_status: 'pending', pay_date: '',
}

function fromEntry(entry) {
  if (!entry) return { ...empty }
  return {
    wake_time: entry.wake_time?.slice(0, 5) ?? '',
    left_home_time: entry.left_home_time?.slice(0, 5) ?? '',
    left_base_time: entry.left_base_time?.slice(0, 5) ?? '',
    return_time: entry.return_time?.slice(0, 5) ?? '',
    hours_worked: entry.hours_worked ?? '',
    pay_amount: entry.pay_amount ?? '',
    business_hours: entry.business_hours ?? '',
    personal_hours: entry.personal_hours ?? '',
    day_type: entry.day_type ?? 'work',
    pay_status: entry.pay_status ?? 'pending',
    pay_date: entry.pay_date ?? '',
  }
}

export default function WorkDayForm({ date, entry, onSaved }) {
  const [form, setForm] = useState(() => fromEntry(entry))
  const [manualHours, setManualHours] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    setForm(fromEntry(entry))
    setManualHours(false)
  }, [entry])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Godziny liczone automatycznie: wyjazd z bazy -> powrot.
  // Gdy danego dnia nie bylo bazy, liczymy od wyjazdu z domu. Edytowalne.
  const hoursFrom = form.left_base_time || form.left_home_time
  const countedFromBase = !!form.left_base_time

  const autoHours = useMemo(
    () => diffHours(hoursFrom, form.return_time),
    [hoursFrom, form.return_time]
  )
  const effectiveHours = manualHours && form.hours_worked !== '' ? Number(form.hours_worked) : autoHours

  const doorToDoor = useMemo(
    () => doorToDoorHours(form.left_home_time, form.return_time),
    [form.left_home_time, form.return_time]
  )

  const pay = parseAmount(form.pay_amount)
  const nominalRate = pay && effectiveHours > 0 ? pay / effectiveHours : null
  const realRate = pay && doorToDoor > 0 ? pay / doorToDoor : null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const saved = await saveDay({
        date,
        wake_time: form.wake_time || null,
        left_home_time: form.left_home_time || null,
        left_base_time: form.left_base_time || null,
        return_time: form.return_time || null,
        hours_worked: effectiveHours ?? null,
        pay_amount: pay,
        business_hours: form.business_hours === '' ? null : Number(form.business_hours),
        personal_hours: form.personal_hours === '' ? null : Number(form.personal_hours),
        day_type: form.day_type,
        pay_status: form.pay_status,
        pay_date: form.pay_status === 'paid' ? (form.pay_date || date) : null,
      })
      onSaved(saved)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const isWorkDay = form.day_type === 'work'

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <Segmented
        ariaLabel="Rodzaj dnia"
        options={DAY_TYPES}
        value={form.day_type}
        onChange={(v) => setForm((f) => ({ ...f, day_type: v }))}
      />

      {isWorkDay && (
        <>
          <div className="field-grid">
            <label className="field">
              <span>Pobudka</span>
              <input type="time" lang="pl" step="60" value={form.wake_time} onChange={set('wake_time')} />
            </label>
            <label className="field">
              <span>Wyjazd z domu</span>
              <input type="time" lang="pl" step="60" value={form.left_home_time} onChange={set('left_home_time')} />
            </label>
            <label className="field">
              <span>Wyjazd z bazy</span>
              <input type="time" lang="pl" step="60" value={form.left_base_time} onChange={set('left_base_time')}
                placeholder="jeśli byłeś na bazie" />
            </label>
            <label className="field">
              <span>Powrót</span>
              <input type="time" lang="pl" step="60" value={form.return_time} onChange={set('return_time')} />
            </label>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Przepracowane godziny</span>
              <input
                type="number"
                step="any"
                min="0"
                max="24"
                placeholder={autoHours != null ? String(autoHours) : '—'}
                value={manualHours ? form.hours_worked : (autoHours ?? '')}
                onChange={(e) => { setManualHours(true); set('hours_worked')(e) }}
              />
              {autoHours != null && !manualHours && (
                <span className="muted" style={{ fontWeight: 500 }}>
                  Liczone od {countedFromBase ? 'wyjazdu z bazy' : 'wyjazdu z domu'} do powrotu
                </span>
              )}
            </label>
            <label className="field">
              <span>Dniówka</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="np. 350"
                value={form.pay_amount}
                onChange={set('pay_amount')}
              />
            </label>
          </div>

          <label className="field">
            <span>Wypłata</span>
            <Segmented
              ariaLabel="Status wypłaty"
              value={form.pay_status}
              onChange={(v) => setForm((f) => ({ ...f, pay_status: v }))}
              options={[
                { value: 'pending', label: 'Czeka' },
                { value: 'paid', label: 'Rozliczone' },
              ]}
            />
          </label>

          {form.pay_status === 'paid' && (
            <label className="field">
              <span>Data wypłaty</span>
              <input type="date" value={form.pay_date || date}
                onChange={set('pay_date')} />
            </label>
          )}

          {realRate != null && (
            <div className="converter">
              Realna stawka {formatPLN(realRate)}/h
              {nominalRate != null && (
                <span style={{ display: 'block', fontWeight: 600, opacity: .85, marginTop: '.2rem' }}>
                  Nominalnie {formatPLN(nominalRate)}/h · od wyjazdu do powrotu {formatHours(doorToDoor)}
                </span>
              )}
            </div>
          )}

          <div className="field-grid">
            <label className="field">
              <span>Nad biznesem (h)</span>
              <input type="number" step="any" min="0" max="24" placeholder="0"
                value={form.business_hours} onChange={set('business_hours')} />
            </label>
            <label className="field">
              <span>Dla siebie (h)</span>
              <input type="number" step="any" min="0" max="24" placeholder="0"
                value={form.personal_hours} onChange={set('personal_hours')} />
            </label>
          </div>
        </>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
        {saving ? 'Zapisywanie…' : justSaved ? 'Zapisano ✓' : entry ? 'Zapisz zmiany' : 'Zapisz'}
      </button>
    </form>
  )
}
