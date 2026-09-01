import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchSessions, saveSession, deleteSession, stats,
  TECHNIQUES, TECHNIQUE_LABEL, DURATIONS,
  formatDuration, formatTotal, isMissingTable,
} from './api'
import SessionOverlay from './SessionOverlay'
import { todayISO, formatDatePl, addDaysISO } from '../../lib/date'
import {
  Card, CardHead, EmptyState, Sheet, SummaryRow, BarChart, Kebab,
} from '../../components/ui'
import { IconTrash } from '../../components/icons'
import { PageLoader } from '../../components/FullScreenSpinner'

const MOODS = [1, 2, 3, 4, 5]

export default function MeditationPage() {
  const [sessions, setSessions] = useState([])
  const [technique, setTechnique] = useState(TECHNIQUES[1])
  const [minutes, setMinutes] = useState(10)
  const [running, setRunning] = useState(false)
  const [finishing, setFinishing] = useState(null) // { seconds }
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setSessions(await fetchSessions())
      setMissing(false)
    } catch (err) {
      if (isMissingTable(err)) setMissing(true)
      else setError(err.message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const s = useMemo(() => stats(sessions), [sessions])

  // Ostatnie 14 dni — minuty dziennie.
  const chart = useMemo(() => {
    const today = todayISO()
    const out = []
    for (let i = 13; i >= 0; i--) {
      const d = addDaysISO(today, -i)
      const secs = sessions
        .filter((x) => x.date === d)
        .reduce((acc, x) => acc + Number(x.duration_seconds), 0)
      out.push({ label: d.slice(8), value: Math.round(secs / 60) })
    }
    return out
  }, [sessions])

  function endSession(seconds) {
    setRunning(false)
    // Ponizej 20 sekund to raczej pomylka niz sesja — nie zasmiecamy historii.
    if (seconds >= 20) setFinishing({ seconds })
  }

  if (loading) return <PageLoader />

  if (missing) {
    return (
      <div className="page-pad">
        <h1 className="page-title">Medytacja</h1>
        <Card>
          <div className="converter is-muted">
            Ta zakładka wymaga migracji <strong>0023_meditation.sql</strong> —
            wklej ją w Supabase → SQL Editor i odśwież stronę.
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-pad">
      <h1 className="page-title">Medytacja</h1>

      {error && <p className="form-error" role="alert">{error}</p>}

      <SummaryRow
        items={[
          {
            label: 'Seria',
            value: s.streak > 0 ? `${s.streak} ${s.streak === 1 ? 'dzień' : 'dni'}` : '—',
            hint: s.streak > 0 ? 'dni pod rząd' : 'Zacznij dziś',
          },
          {
            label: 'Ten tydzień',
            value: formatTotal(s.weekSeconds),
            hint: `${s.weekCount} ${s.weekCount === 1 ? 'sesja' : 'sesji'}`,
          },
          {
            label: 'Łącznie',
            value: formatTotal(s.totalSeconds),
            hint: `${s.count} ${s.count === 1 ? 'sesja' : 'sesji'}`,
          },
          {
            label: 'Średnia sesja',
            value: s.count ? formatDuration(s.avgSeconds) : '—',
            hint: s.moodGain != null
              ? `Nastrój ${s.moodGain >= 0 ? '+' : ''}${s.moodGain.toFixed(1)} po sesji`
              : undefined,
          },
        ]}
      />

      <Card>
        <CardHead title="Zacznij" hint="Wybierz technikę i czas" />

        <span className="mini-stats-label">Technika</span>
        <div className="meditation-techniques">
          {TECHNIQUES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={'meditation-tech' + (technique.value === t.value ? ' is-active' : '')}
              onClick={() => setTechnique(t)}
            >
              <span className="meditation-tech-name">{t.label}</span>
              <span className="meditation-tech-hint">{t.hint}</span>
            </button>
          ))}
        </div>

        <span className="mini-stats-label" style={{ marginTop: '1rem' }}>Ile minut</span>
        <div className="chip-row">
          {DURATIONS.map((m) => (
            <button
              key={m}
              className={'chip' + (minutes === m ? ' is-active' : '')}
              onClick={() => setMinutes(m)}
            >{m} min</button>
          ))}
        </div>

        <button className="btn btn-primary btn-block mt-1" onClick={() => setRunning(true)}>
          Start · {minutes} min · {technique.label}
        </button>
      </Card>

      {sessions.length > 0 && (
        <Card>
          <CardHead title="Ostatnie dwa tygodnie" hint="Minuty dziennie" />
          <BarChart data={chart} height={90} format={(v) => `${v} min`} />
        </Card>
      )}

      <Card>
        <CardHead title="Historia" hint={`${sessions.length} ${sessions.length === 1 ? 'sesja' : 'sesji'}`} />
        {sessions.length === 0 ? (
          <EmptyState>Jeszcze nie medytowałeś. Pierwsza sesja może mieć 3 minuty.</EmptyState>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Data</th>
                <th>Technika</th>
                <th className="num">Czas</th>
                <th className="num">Nastrój</th>
                <th className="ledger-actions" />
              </tr>
            </thead>
            <tbody>
              {sessions.slice(0, 20).map((x) => (
                <tr key={x.id}>
                  <td className="ledger-main" data-label="Data">
                    <span className="ledger-name">{formatDatePl(x.date)}</span>
                    {x.note && <span className="ledger-sub">{x.note}</span>}
                  </td>
                  <td data-label="Technika">{TECHNIQUE_LABEL[x.technique] ?? x.technique}</td>
                  <td className="num" data-label="Czas">{formatDuration(x.duration_seconds)}</td>
                  <td className="num" data-label="Nastrój">
                    {x.mood_before != null && x.mood_after != null
                      ? `${x.mood_before} → ${x.mood_after}`
                      : '—'}
                  </td>
                  <td className="ledger-actions">
                    <Kebab items={[{
                      label: 'Usuń', icon: <IconTrash />, tone: 'danger',
                      onClick: async () => { await deleteSession(x.id); load() },
                    }]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {running && (
        <SessionOverlay
          technique={technique}
          plannedSeconds={minutes * 60}
          onFinish={endSession}
          onCancel={endSession}
        />
      )}

      <AfterSheet
        data={finishing}
        technique={technique}
        plannedSeconds={minutes * 60}
        onClose={() => setFinishing(null)}
        onSaved={() => { setFinishing(null); load() }}
      />
    </div>
  )
}

function AfterSheet({ data, technique, plannedSeconds, onClose, onSaved }) {
  const [moodBefore, setMoodBefore] = useState(null)
  const [moodAfter, setMoodAfter] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (data) { setMoodBefore(null); setMoodAfter(null); setNote(''); setError('') }
  }, [data])

  if (!data) return null

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await saveSession({
        date: todayISO(),
        duration_seconds: data.seconds,
        planned_seconds: plannedSeconds,
        technique: technique.value,
        mood_before: moodBefore,
        mood_after: moodAfter,
        note: note.trim() || null,
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  return (
    <Sheet open title="Sesja zakończona" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="big-number">{formatDuration(data.seconds)}</p>
        <p className="muted">
          {technique.label}
          {data.seconds < plannedSeconds && ` · z zaplanowanych ${Math.round(plannedSeconds / 60)} min`}
        </p>

        <div>
          <span className="mini-stats-label">Jak było przed?</span>
          <div className="mood-picker-row">
            {MOODS.map((m) => (
              <button key={m} type="button"
                className={'mood-dot' + (moodBefore === m ? ' is-selected' : '')}
                onClick={() => setMoodBefore(moodBefore === m ? null : m)}>{m}</button>
            ))}
          </div>
        </div>

        <div>
          <span className="mini-stats-label">A jak teraz?</span>
          <div className="mood-picker-row">
            {MOODS.map((m) => (
              <button key={m} type="button"
                className={'mood-dot' + (moodAfter === m ? ' is-selected' : '')}
                onClick={() => setMoodAfter(moodAfter === m ? null : m)}>{m}</button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Notatka (opcjonalnie)</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="np. dużo myśli, ale wróciłem do oddechu" />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Zapisywanie…' : 'Zapisz sesję'}
        </button>
      </form>
    </Sheet>
  )
}
