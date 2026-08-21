import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchEntries, createEntry, updateEntry, deleteEntry, drawReflectionPrompt,
  TYPE_LABEL, STATUS_LABEL, BUSINESS_TAG,
} from './api'
import { useSpeech } from './useSpeech'
import { formatDatePl } from '../../lib/date'
import { Card, CardHead, EmptyState, Sheet, Segmented } from '../../components/ui'
import { IconGratitude, IconMic } from '../../components/icons'

export default function JournalPage() {
  const [entries, setEntries] = useState([])
  const [addOpen, setAddOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setEntries(await fetchEntries()) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const tags = useMemo(
    () => [...new Set(entries.map((e) => e.tag).filter(Boolean))],
    [entries]
  )

  const archived = useMemo(() => entries.filter((e) => e.status === 'achieved'), [entries])

  const visible = useMemo(() => {
    let list = entries.filter((e) => e.status !== 'achieved')
    if (typeFilter !== 'all') list = list.filter((e) => e.type === typeFilter)
    if (tagFilter) list = list.filter((e) => e.tag === tagFilter)
    if (onlyFavorites) list = list.filter((e) => e.is_favorite)
    return list
  }, [entries, typeFilter, tagFilter, onlyFavorites])

  async function toggleFavorite(entry) {
    const next = !entry.is_favorite
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, is_favorite: next } : e)))
    try { await updateEntry(entry.id, { is_favorite: next }) }
    catch (err) { setError(err.message); load() }
  }

  if (loading) return <div className="page-pad"><p className="page-lede">Wczytywanie…</p></div>

  return (
    <div className="page-pad">
      <h1 className="page-title">Myśli i cele</h1>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="action-bar">
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>Nowy wpis</button>
        <button className="btn btn-ghost" onClick={() => setShowArchive(true)}>
          Archiwum ({archived.length})
        </button>
      </div>

      <Card>
        <CardHead
          title="Twoje wpisy"
          hint={`${visible.length} widocznych`}
          action={
            <button className={'chip' + (onlyFavorites ? ' is-active' : '')}
              onClick={() => setOnlyFavorites((v) => !v)} aria-pressed={onlyFavorites}>
              Ulubione
            </button>
          }
        />

        <div className="chip-row" style={{ marginBottom: '.6rem' }}>
          {[['all', 'Wszystko'], ['thought', 'Myśli'], ['goal', 'Cele'], ['past_link', 'Przeszłość']].map(([v, l]) => (
            <button key={v} className={'chip' + (typeFilter === v ? ' is-active' : '')}
              onClick={() => setTypeFilter(v)}>{l}</button>
          ))}
        </div>

        {tags.length > 0 && (
          <div className="chip-row" style={{ marginBottom: '.75rem' }}>
            <button className={'chip' + (!tagFilter ? ' is-active' : '')} onClick={() => setTagFilter('')}>Każdy tag</button>
            {tags.map((t) => (
              <button key={t} className={'chip' + (tagFilter === t ? ' is-active' : '')}
                onClick={() => setTagFilter(tagFilter === t ? '' : t)}>{t}</button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <EmptyState>Brak wpisów dla tych filtrów.</EmptyState>
        ) : (
          <ul className="entry-list">
            {visible.map((e) => (
              <li key={e.id} className="entry">
                <div className="entry-head">
                  <span className="entry-date">
                    <span className="badge">{TYPE_LABEL[e.type]}</span>
                    {e.tag && <span className="badge is-accent" style={{ marginLeft: '.3rem' }}>{e.tag}</span>}
                  </span>
                  <div className="entry-actions">
                    <button className={'favorite-toggle' + (e.is_favorite ? ' is-active' : '')}
                      onClick={() => toggleFavorite(e)} aria-pressed={e.is_favorite}
                      aria-label={e.is_favorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}>
                      <IconGratitude style={e.is_favorite ? { fill: 'currentColor' } : undefined} />
                    </button>
                  </div>
                </div>
                <button className="row-main" onClick={() => setDetail(e)}
                  style={{ background: 'none', border: 'none', padding: '.4rem 0 0', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit', width: '100%' }}>
                  {e.title && <span className="row-title">{e.title}</span>}
                  {e.content && <span className="row-sub" style={{ whiteSpace: 'pre-wrap' }}>
                    {e.content.length > 160 ? e.content.slice(0, 160) + '…' : e.content}
                  </span>}
                  <span className="row-sub">
                    {formatDatePl(e.created_at.slice(0, 10))}
                    {e.status && ` · ${STATUS_LABEL[e.status]}`}
                    {e.due_date && ` · termin ${formatDatePl(e.due_date)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <EntrySheet open={addOpen} onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); load() }} />

      <Sheet open={!!detail} title={detail?.title || TYPE_LABEL[detail?.type] || ''} onClose={() => setDetail(null)}>
        {detail && (
          <div className="stack">
            {detail.content && <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{detail.content}</p>}
            {detail.problem_solved && (
              <div><span className="field-label">Jaki problem rozwiązuje</span><p className="muted">{detail.problem_solved}</p></div>
            )}
            {detail.next_step && (
              <div><span className="field-label">Następny krok</span><p className="muted">{detail.next_step}</p></div>
            )}
            {detail.type === 'goal' && (
              <label className="field">
                <span>Status</span>
                <select value={detail.status} onChange={async (e) => {
                  const updated = await updateEntry(detail.id, { status: e.target.value })
                  setDetail(updated); load()
                }}>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            )}
            <button className="btn btn-ghost btn-block" style={{ color: 'var(--danger)' }}
              onClick={async () => { await deleteEntry(detail.id); setDetail(null); load() }}>
              Usuń wpis
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={showArchive} title="Archiwum osiągniętych celów" onClose={() => setShowArchive(false)}>
        {archived.length === 0 ? (
          <EmptyState>Nie masz jeszcze osiągniętych celów.</EmptyState>
        ) : (
          <ul className="entry-list">
            {archived.map((e) => (
              <li key={e.id} className="entry">
                <span className="row-title">{e.title}</span>
                <span className="row-sub">Osiągnięty {formatDatePl(e.updated_at.slice(0, 10))}</span>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  )
}

function EntrySheet({ open, onClose, onDone }) {
  const [type, setType] = useState('thought')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tag, setTag] = useState('')
  const [status, setStatus] = useState('in_progress')
  const [dueDate, setDueDate] = useState('')
  const [problem, setProblem] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [prompt, setPrompt] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const speech = useSpeech({ onText: setContent })

  function reset() {
    setType('thought'); setTitle(''); setContent(''); setTag('')
    setStatus('in_progress'); setDueDate(''); setProblem(''); setNextStep('')
    setPrompt(null); setError('')
  }

  async function handleDraw() {
    try {
      const p = await drawReflectionPrompt()
      if (p) setPrompt(p.text)
      else setError('Brak pytań w puli — dodaj je w Ustawieniach.')
    } catch (err) { setError(err.message) }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!title.trim() && !content.trim()) return setError('Wpisz tytuł albo treść.')
    if (type === 'goal' && !title.trim()) return setError('Cel musi mieć tytuł.')

    setSaving(true)
    try {
      await createEntry({
        type,
        title: title.trim() || null,
        content: content.trim() || null,
        tag: tag || null,
        status: type === 'goal' ? status : null,
        due_date: type === 'goal' && dueDate ? dueDate : null,
        problem_solved: tag === BUSINESS_TAG ? problem.trim() || null : null,
        next_step: tag === BUSINESS_TAG ? nextStep.trim() || null : null,
      })
      reset()
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title="Nowy wpis" onClose={() => { reset(); onClose() }}>
      <form className="stack" onSubmit={submit}>
        <Segmented
          ariaLabel="Typ wpisu"
          value={type}
          onChange={setType}
          options={[
            { value: 'thought', label: 'Myśl' },
            { value: 'goal', label: 'Cel' },
            { value: 'past_link', label: 'Przeszłość' },
          ]}
        />

        <label className="field">
          <span>{type === 'goal' ? 'Tytuł celu' : 'Tytuł (opcjonalnie)'}</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        {prompt && <div className="emotion-advice">{prompt}</div>}

        <label className="field">
          <span>Treść</span>
          <textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)}
            placeholder={speech.listening ? 'Słucham…' : 'Co Ci chodzi po głowie?'} />
        </label>

        <div className="chip-row">
          <button type="button" className="chip" onClick={handleDraw}>Nie wiem co napisać</button>
          {speech.supported && (
            <button
              type="button"
              className={'chip' + (speech.listening ? ' is-active' : '')}
              onClick={() => (speech.listening ? speech.stop() : speech.start(content))}
            >
              <IconMic style={{ width: 14, height: 14, verticalAlign: '-2px', marginRight: 4 }} />
              {speech.listening ? 'Zatrzymaj' : 'Mów'}
            </button>
          )}
        </div>
        {speech.error && <p className="muted">{speech.error}</p>}

        <label className="field">
          <span>Tag</span>
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">—</option>
            <option value={BUSINESS_TAG}>{BUSINESS_TAG}</option>
            <option value="Rodzina">Rodzina</option>
            <option value="Zdrowie">Zdrowie</option>
            <option value="Praca">Praca</option>
            <option value="Pieniądze">Pieniądze</option>
          </select>
        </label>

        {tag === BUSINESS_TAG && (
          <>
            <label className="field">
              <span>Jaki problem rozwiązuje</span>
              <textarea rows={2} value={problem} onChange={(e) => setProblem(e.target.value)} />
            </label>
            <label className="field">
              <span>Następny krok</span>
              <input type="text" value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
            </label>
          </>
        )}

        {type === 'goal' && (
          <div className="field-grid">
            <label className="field">
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Termin</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
          </div>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Zapisywanie…' : 'Zapisz'}
        </button>
      </form>
    </Sheet>
  )
}
