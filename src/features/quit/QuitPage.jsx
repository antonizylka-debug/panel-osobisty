import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchTrackers, fetchSlips, createTracker, updateTracker, deleteTracker,
  addSlip, deleteSlip, trackerStats, isMissingTable,
} from './api'
import { todayISO, formatDatePl } from '../../lib/date'
import { Card, CardHead, EmptyState, Sheet, ProgressBar, Kebab } from '../../components/ui'
import { IconEdit, IconTrash } from '../../components/icons'
import { PageLoader } from '../../components/FullScreenSpinner'

export default function QuitPage() {
  const [trackers, setTrackers] = useState([])
  const [slips, setSlips] = useState([])
  const [addOpen, setAddOpen] = useState(false)
  const [slipFor, setSlipFor] = useState(null)
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([fetchTrackers(), fetchSlips()])
      setTrackers(t); setSlips(s); setMissing(false)
    } catch (err) {
      if (isMissingTable(err)) setMissing(true)
      else setError(err.message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const rows = useMemo(
    () => trackers.map((t) => ({ tracker: t, stats: trackerStats(t, slips) })),
    [trackers, slips]
  )

  if (loading) return <PageLoader />

  if (missing) {
    return (
      <div className="page-pad">
        <h1 className="page-title">Bez nałogu</h1>
        <Card>
          <div className="converter is-muted">
            Ta zakładka wymaga migracji <strong>0025_quit_trackers.sql</strong> —
            wklej ją w Supabase → SQL Editor i odśwież stronę.
          </div>
        </Card>
      </div>
    )
  }

  const active = rows.filter((r) => r.tracker.active)
  const stopped = rows.filter((r) => !r.tracker.active)

  return (
    <div className="page-pad">
      <div className="page-head">
        <h1 className="page-title">Bez nałogu</h1>
        <div className="page-head-tools">
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>+ Nowy licznik</button>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {active.length === 0 ? (
        <Card>
          <EmptyState>
            Nie liczysz jeszcze niczego. Dodaj licznik — data startu może być
            wsteczna, jeśli nie bierzesz już od jakiegoś czasu.
          </EmptyState>
        </Card>
      ) : (
        active.map(({ tracker, stats }) => (
          <Card key={tracker.id}>
            <CardHead
              title={tracker.name}
              hint={stats.slipCount === 0
                ? `Od ${formatDatePl(tracker.started_at)}, bez wpadki`
                : `${stats.slipCount} ${stats.slipCount === 1 ? 'wpadka' : 'wpadek'} · rekord ${stats.best} dni`}
              action={
                <div className="chip-row">
                  <button className="chip" onClick={() => setSlipFor(tracker)}>Zdarzyło się</button>
                  <Kebab items={[
                    {
                      label: 'Zatrzymaj licznik', icon: <IconEdit />,
                      onClick: async () => { await updateTracker(tracker.id, { active: false }); load() },
                    },
                    {
                      label: 'Usuń', icon: <IconTrash />, tone: 'danger',
                      onClick: async () => { await deleteTracker(tracker.id); load() },
                    },
                  ]} />
                </div>
              }
            />

            <p className="big-number">
              {stats.current} {stats.current === 1 ? 'dzień' : 'dni'}
            </p>
            <p className="muted" style={{ marginTop: '.3rem' }}>
              {stats.lastSlip
                ? `Od ostatniego razu: ${formatDatePl(stats.lastSlip)}`
                : `Od początku: ${formatDatePl(tracker.started_at)}`}
            </p>

            {/* Pasek pokazuje biezaca serie na tle rekordu — widac, czy
                to podejscie jest juz lepsze od najlepszego dotad. */}
            {stats.best > 0 && (
              <div style={{ marginTop: '.7rem' }}>
                <ProgressBar
                  value={Math.min(stats.current, stats.best)}
                  max={stats.best}
                  tone={stats.current >= stats.best ? 'accent' : 'warn'}
                />
                <p className="muted" style={{ marginTop: '.4rem' }}>
                  {stats.current >= stats.best && stats.slipCount > 0
                    ? 'To Twoje najdłuższe podejście.'
                    : `Rekord: ${stats.best} dni · zostało ${stats.best - stats.current}`}
                </p>
              </div>
            )}

            <SlipList
              trackerId={tracker.id}
              slips={slips.filter((s) => s.tracker_id === tracker.id)}
              onChanged={load}
            />
          </Card>
        ))
      )}

      {stopped.length > 0 && (
        <Card>
          <CardHead title="Zatrzymane" hint={`${stopped.length}`} />
          <table className="ledger">
            <tbody>
              {stopped.map(({ tracker, stats }) => (
                <tr key={tracker.id}>
                  <td className="ledger-main" data-label="Licznik">
                    <span className="ledger-name">{tracker.name}</span>
                    <span className="ledger-sub">rekord {stats.best} dni</span>
                  </td>
                  <td className="ledger-actions">
                    <Kebab items={[
                      {
                        label: 'Wznów', icon: <IconEdit />,
                        onClick: async () => {
                          await updateTracker(tracker.id, { active: true })
                          load()
                        },
                      },
                      {
                        label: 'Usuń', icon: <IconTrash />, tone: 'danger',
                        onClick: async () => { await deleteTracker(tracker.id); load() },
                      },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <TrackerSheet open={addOpen} onClose={() => setAddOpen(false)}
        onSaved={() => { setAddOpen(false); load() }} />

      <SlipSheet tracker={slipFor} onClose={() => setSlipFor(null)}
        onSaved={() => { setSlipFor(null); load() }} />
    </div>
  )
}

function SlipList({ slips, onChanged }) {
  if (slips.length === 0) return null
  return (
    <table className="ledger mt-1">
      <thead>
        <tr>
          <th>Wpadki</th>
          <th className="ledger-actions" />
        </tr>
      </thead>
      <tbody>
        {slips.slice(0, 6).map((s) => (
          <tr key={s.id}>
            <td className="ledger-main" data-label="Kiedy">
              <span className="ledger-name">{formatDatePl(s.date)}</span>
              {s.note && <span className="ledger-sub">{s.note}</span>}
            </td>
            <td className="ledger-actions">
              <Kebab items={[{
                label: 'Usuń wpis', icon: <IconTrash />, tone: 'danger',
                onClick: async () => { await deleteSlip(s.id); onChanged() },
              }]} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TrackerSheet({ open, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [startedAt, setStartedAt] = useState(todayISO())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) { setName(''); setStartedAt(todayISO()); setError('') }
  }, [open])

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Podaj nazwę.')
    setBusy(true)
    try {
      await createTracker({ name: name.trim(), started_at: startedAt })
      onSaved()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} title="Nowy licznik" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Bez czego</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="np. papierosy, alkohol, scrollowanie" autoFocus maxLength={80} />
        </label>
        <label className="field">
          <span>Od kiedy</span>
          <input type="date" value={startedAt} max={todayISO()}
            onChange={(e) => setStartedAt(e.target.value)} />
        </label>
        <p className="muted">
          Możesz wpisać datę wsteczną — licznik od razu pokaże, ile dni już masz.
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Zapisywanie…' : 'Dodaj'}
        </button>
      </form>
    </Sheet>
  )
}

function SlipSheet({ tracker, onClose, onSaved }) {
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (tracker) { setDate(todayISO()); setNote(''); setError('') }
  }, [tracker])

  if (!tracker) return null

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await addSlip({ trackerId: tracker.id, date, note })
      onSaved()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <Sheet open title={tracker.name} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted">
          Licznik wraca do zera, ale rekord i historia zostają — po to, żeby
          było widać, czy kolejne podejścia są dłuższe.
        </p>
        <label className="field">
          <span>Kiedy</span>
          <input type="date" value={date} max={todayISO()}
            onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Co się stało (opcjonalnie)</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="np. stresujący dzień" />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Zapisywanie…' : 'Zapisz'}
        </button>
      </form>
    </Sheet>
  )
}
