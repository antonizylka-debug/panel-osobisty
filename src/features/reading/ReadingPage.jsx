import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchBooks, fetchLog, createBook, updateBook, deleteBook,
  logPages, readingStats, STATUSES, STATUS_LABEL, isMissingTable,
} from './api'
import { todayISO, addDaysISO, formatDatePl } from '../../lib/date'
import {
  Card, CardHead, EmptyState, Sheet, SummaryRow, ProgressBar, BarChart, Kebab,
} from '../../components/ui'
import { IconEdit, IconTrash } from '../../components/icons'
import { PageLoader } from '../../components/FullScreenSpinner'

export default function ReadingPage() {
  const [books, setBooks] = useState([])
  const [log, setLog] = useState([])
  const [addOpen, setAddOpen] = useState(false)
  const [logging, setLogging] = useState(null)   // ksiazka, do ktorej dopisujemy strony
  const [rating, setRating] = useState(null)     // ksiazka do oceny po skonczeniu
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [b, l] = await Promise.all([fetchBooks(), fetchLog(addDaysISO(todayISO(), -90))])
      setBooks(b); setLog(l); setMissing(false)
    } catch (err) {
      if (isMissingTable(err)) setMissing(true)
      else setError(err.message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const s = useMemo(() => readingStats(books, log), [books, log])

  const chart = useMemo(() => {
    const today = todayISO()
    const out = []
    for (let i = 13; i >= 0; i--) {
      const d = addDaysISO(today, -i)
      out.push({
        label: d.slice(8),
        value: log.filter((l) => l.date === d).reduce((acc, l) => acc + Number(l.pages), 0),
      })
    }
    return out
  }, [log])

  if (loading) return <PageLoader />

  if (missing) {
    return (
      <div className="page-pad">
        <h1 className="page-title">Czytanie</h1>
        <Card>
          <div className="converter is-muted">
            Ta zakładka wymaga migracji <strong>0024_reading.sql</strong> —
            wklej ją w Supabase → SQL Editor i odśwież stronę.
          </div>
        </Card>
      </div>
    )
  }

  const reading = books.filter((b) => b.status === 'czytam')
  const others = books.filter((b) => b.status !== 'czytam')

  return (
    <div className="page-pad">
      <div className="page-head">
        <h1 className="page-title">Czytanie</h1>
        <div className="page-head-tools">
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>+ Dodaj książkę</button>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <SummaryRow
        items={[
          {
            label: 'Seria',
            value: s.streak > 0 ? `${s.streak} ${s.streak === 1 ? 'dzień' : 'dni'}` : '—',
            hint: s.streak > 0 ? 'dni pod rząd' : 'Przeczytaj dziś choć stronę',
          },
          { label: 'Ten tydzień', value: `${s.weekPages} str.`, hint: 'przeczytanych' },
          { label: 'Skończone', value: String(s.finishedCount), hint: `${s.readingCount} w trakcie` },
          {
            label: 'Łącznie',
            value: `${s.totalPages} str.`,
            hint: s.avgRating ? `Średnia ocena ${s.avgRating.toFixed(1)}` : 'ostatnie 90 dni',
          },
        ]}
      />

      <Card>
        <CardHead title="Czytam teraz" hint={`${reading.length} w trakcie`} />
        {reading.length === 0 ? (
          <EmptyState>Nic w trakcie. Dodaj książkę, żeby zacząć liczyć strony.</EmptyState>
        ) : (
          <ul className="row-list">
            {reading.map((b) => {
              const pct = b.total_pages ? (b.current_page / b.total_pages) * 100 : null
              return (
                <li key={b.id}>
                  <div className="entry">
                    <div className="entry-head">
                      <div className="row-main">
                        <span className="row-title">{b.title}</span>
                        <span className="row-sub">
                          {b.author || 'bez autora'}
                          {b.total_pages
                            ? ` · ${b.current_page} z ${b.total_pages} str.`
                            : ` · ${b.current_page} str.`}
                          {pct != null && ` · ${Math.round(pct)}%`}
                        </span>
                      </div>
                      <div className="chip-row">
                        <button className="chip is-active" onClick={() => setLogging(b)}>
                          + Strony
                        </button>
                        <Kebab items={[
                          {
                            label: 'Oznacz jako skończoną', icon: <IconEdit />,
                            onClick: () => setRating(b),
                          },
                          {
                            label: 'Porzuć', icon: <IconEdit />,
                            onClick: async () => { await updateBook(b.id, { status: 'porzucona' }); load() },
                          },
                          {
                            label: 'Usuń', icon: <IconTrash />, tone: 'danger',
                            onClick: async () => { await deleteBook(b.id); load() },
                          },
                        ]} />
                      </div>
                    </div>
                    {b.total_pages && (
                      <div style={{ marginTop: '.6rem' }}>
                        <ProgressBar value={b.current_page} max={b.total_pages} />
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {log.length > 0 && (
        <Card>
          <CardHead title="Ostatnie dwa tygodnie" hint="Strony dziennie" />
          <BarChart data={chart} height={90} format={(v) => `${v} str.`} />
        </Card>
      )}

      {others.length > 0 && (
        <Card>
          <CardHead title="Reszta półki" hint={`${others.length} pozycji`} />
          <table className="ledger">
            <thead>
              <tr>
                <th>Tytuł</th>
                <th>Status</th>
                <th className="num">Strony</th>
                <th className="num">Ocena</th>
                <th className="ledger-actions" />
              </tr>
            </thead>
            <tbody>
              {others.map((b) => (
                <tr key={b.id}>
                  <td className="ledger-main" data-label="Tytuł">
                    <span className="ledger-name">{b.title}</span>
                    <span className="ledger-sub">
                      {b.author || 'bez autora'}
                      {b.finished_at && ` · ${formatDatePl(b.finished_at)}`}
                    </span>
                  </td>
                  <td data-label="Status">{STATUS_LABEL[b.status]}</td>
                  <td className="num" data-label="Strony">
                    {b.total_pages ? `${b.current_page}/${b.total_pages}` : b.current_page}
                  </td>
                  <td className="num" data-label="Ocena">{b.rating ? `${b.rating}/5` : '—'}</td>
                  <td className="ledger-actions">
                    <Kebab items={[
                      {
                        label: 'Wróć do czytania', icon: <IconEdit />,
                        onClick: async () => {
                          await updateBook(b.id, { status: 'czytam', finished_at: null })
                          load()
                        },
                      },
                      {
                        label: 'Usuń', icon: <IconTrash />, tone: 'danger',
                        onClick: async () => { await deleteBook(b.id); load() },
                      },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <BookSheet open={addOpen} onClose={() => setAddOpen(false)}
        onSaved={() => { setAddOpen(false); load() }} />

      <PagesSheet book={logging} onClose={() => setLogging(null)}
        onSaved={(finished, b) => {
          setLogging(null)
          if (finished) setRating(b)
          load()
        }} />

      <RatingSheet book={rating} onClose={() => setRating(null)}
        onSaved={() => { setRating(null); load() }} />
    </div>
  )
}

function BookSheet({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', author: '', total_pages: '', status: 'czytam' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    if (open) { setForm({ title: '', author: '', total_pages: '', status: 'czytam' }); setError('') }
  }, [open])

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) return setError('Podaj tytuł.')
    setBusy(true)
    try {
      await createBook({
        title: form.title.trim(),
        author: form.author.trim() || null,
        total_pages: form.total_pages ? Number(form.total_pages) : null,
        status: form.status,
        started_at: form.status === 'czytam' ? todayISO() : null,
      })
      onSaved()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} title="Nowa książka" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Tytuł</span>
          <input type="text" value={form.title} onChange={set('title')} autoFocus maxLength={200} />
        </label>
        <div className="field-grid">
          <label className="field">
            <span>Autor</span>
            <input type="text" value={form.author} onChange={set('author')} />
          </label>
          <label className="field">
            <span>Ile stron</span>
            <input type="number" min="1" inputMode="numeric"
              value={form.total_pages} onChange={set('total_pages')} placeholder="opcjonalnie" />
          </label>
        </div>
        <label className="field">
          <span>Status</span>
          <select value={form.status} onChange={set('status')}>
            {STATUSES.filter((s) => s.value !== 'skonczona').map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Zapisywanie…' : 'Dodaj'}
        </button>
      </form>
    </Sheet>
  )
}

function PagesSheet({ book, onClose, onSaved }) {
  const [pages, setPages] = useState('')
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (book) { setPages(''); setDate(todayISO()); setError('') }
  }, [book])

  if (!book) return null

  async function submit(e) {
    e.preventDefault()
    const n = Number(pages)
    if (!n || n <= 0) return setError('Podaj liczbę stron.')
    setBusy(true)
    try {
      const res = await logPages({ bookId: book.id, pages: n, date, book })
      onSaved(res?.finished, book)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const left = book.total_pages ? book.total_pages - book.current_page : null

  return (
    <Sheet open title={book.title} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted">
          Jesteś na {book.current_page} stronie
          {book.total_pages && ` z ${book.total_pages} · zostało ${left}`}
        </p>
        <label className="field">
          <span>Ile stron przeczytałeś</span>
          <input type="number" min="1" inputMode="numeric" autoFocus
            value={pages} onChange={(e) => setPages(e.target.value)} placeholder="np. 20" />
        </label>
        <label className="field">
          <span>Kiedy</span>
          <input type="date" value={date} max={todayISO()}
            onChange={(e) => setDate(e.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Zapisywanie…' : 'Dopisz'}
        </button>
      </form>
    </Sheet>
  )
}

function RatingSheet({ book, onClose, onSaved }) {
  const [rating, setRating] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (book) { setRating(book.rating ?? null); setNote(book.note ?? '') } }, [book])
  if (!book) return null

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await updateBook(book.id, {
        status: 'skonczona',
        finished_at: book.finished_at ?? todayISO(),
        rating,
        note: note.trim() || null,
      })
      onSaved()
    } finally { setBusy(false) }
  }

  return (
    <Sheet open title="Skończone" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted">{book.title}</p>
        <div>
          <span className="mini-stats-label">Ocena</span>
          <div className="mood-picker-row">
            {[1, 2, 3, 4, 5].map((m) => (
              <button key={m} type="button"
                className={'mood-dot' + (rating === m ? ' is-selected' : '')}
                onClick={() => setRating(rating === m ? null : m)}>{m}</button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Co zapamiętasz</span>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Zapisywanie…' : 'Zapisz'}
        </button>
      </form>
    </Sheet>
  )
}
