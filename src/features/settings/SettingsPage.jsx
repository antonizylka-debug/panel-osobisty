import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../auth/AuthContext'
import { useTheme, ACCENTS } from '../../theme/ThemeContext'
import {
  fetchQuotes, createQuote, deleteQuote, toggleQuoteFavorite,
  fetchPrompts, createPrompt, deletePrompt,
} from '../extras/api'
import { toCsv, downloadText } from '../../lib/csv'
import { Card, CardHead, EmptyState, Sheet, Segmented } from '../../components/ui'
import ReminderSettings from '../reminders/ReminderSettings'

const EXPORT_TABLES = [
  'profiles', 'main_goal', 'savings_goal', 'motivation_quotes', 'reflection_prompts',
  'gratitude_entries', 'work_days', 'expenses', 'budgets', 'debts', 'debt_payments',
  'journal_entries', 'procrastination_sessions', 'weekly_reviews', 'daily_plan',
  'habits', 'habit_logs',
]

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { theme, setTheme, accent, setAccent } = useTheme()
  const [quotes, setQuotes] = useState([])
  const [prompts, setPrompts] = useState([])
  const [quotesOpen, setQuotesOpen] = useState(false)
  const [promptsOpen, setPromptsOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [q, p] = await Promise.all([fetchQuotes(), fetchPrompts()])
      setQuotes(q); setPrompts(p)
    } catch (err) { setError(err.message) }
  }, [])

  useEffect(() => { load() }, [load])

  async function exportAll() {
    setExporting(true)
    setError('')
    try {
      for (const table of EXPORT_TABLES) {
        const { data, error } = await supabase.from(table).select('*')
        if (error) throw error
        if (!data?.length) continue

        const headers = Object.keys(data[0])
        const rows = [headers, ...data.map((row) => headers.map((h) => {
          const v = row[h]
          if (v == null) return ''
          if (Array.isArray(v)) return v.join(' | ')
          return String(v)
        }))]
        downloadText(`${table}.csv`, toCsv(rows))
        await new Promise((r) => setTimeout(r, 250))
      }
      setMessage('Pliki CSV pobrane — po jednym na tabelę.')
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page-pad">
      <h1 className="page-title">Ustawienia</h1>
      <p className="page-lede">{user.email}</p>

      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <div className="converter">{message}</div>}

      <Card>
        <CardHead title="Wygląd" />
        <Segmented
          ariaLabel="Motyw"
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'system', label: 'Systemowy' },
            { value: 'light', label: 'Jasny' },
            { value: 'dark', label: 'Ciemny' },
          ]}
        />

        <span className="field-label" style={{ display: 'block', margin: '1.25rem 0 .6rem' }}>
          Kolor akcentu
        </span>
        <div className="accent-grid">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              type="button"
              className={'accent-swatch' + (accent === a.value ? ' is-active' : '')}
              onClick={() => setAccent(a.value)}
              aria-pressed={accent === a.value}
              title={a.label}
            >
              <span style={{ background: a.swatch }} />
              {a.label}
            </button>
          ))}
        </div>
      </Card>

      <ReminderSettings />

      <Card>
        <CardHead title="Skróty" />
        <ul className="row-list">
          <li><Link className="row-item" to="/przeglad-tygodnia">
            <div className="row-main"><span className="row-title">Przegląd tygodnia</span></div>
          </Link></li>
          <li><Link className="row-item" to="/ulubione">
            <div className="row-main"><span className="row-title">Ulubione</span></div>
          </Link></li>
          <li><Link className="row-item" to="/szukaj">
            <div className="row-main"><span className="row-title">Szukaj we wszystkim</span></div>
          </Link></li>
        </ul>
      </Card>

      <Card>
        <CardHead title="Twoje listy" />
        <ul className="row-list">
          <li>
            <button className="row-item" onClick={() => setQuotesOpen(true)}>
              <div className="row-main">
                <span className="row-title">Cytaty i motywacje</span>
                <span className="row-sub">{quotes.length} pozycji</span>
              </div>
            </button>
          </li>
          <li>
            <button className="row-item" onClick={() => setPromptsOpen(true)}>
              <div className="row-main">
                <span className="row-title">Pytania do refleksji</span>
                <span className="row-sub">{prompts.length} pozycji</span>
              </div>
            </button>
          </li>
        </ul>
      </Card>

      <Card>
        <CardHead title="Twoje dane" hint="Wszystko, co zapisałeś, w plikach CSV" />
        <button className="btn btn-ghost btn-block" onClick={exportAll} disabled={exporting}>
          {exporting ? 'Przygotowuję…' : 'Eksportuj dane do CSV'}
        </button>
      </Card>

      <Card>
        <CardHead title="Konto" />
        <div className="stack">
          <button className="btn btn-ghost btn-block" onClick={() => setPasswordOpen(true)}>
            Zmień hasło
          </button>
          <button className="btn btn-ghost btn-block" onClick={signOut}>
            Wyloguj się
          </button>
          <button className="btn btn-ghost btn-block" style={{ color: 'var(--danger)' }}
            onClick={() => setDeleteOpen(true)}>
            Usuń konto
          </button>
        </div>
      </Card>

      <ListSheet
        open={quotesOpen}
        title="Cytaty i motywacje"
        items={quotes}
        placeholder="Nowy cytat"
        onClose={() => setQuotesOpen(false)}
        withAuthor
        onAdd={async (t, a) => { await createQuote(t, a); load() }}
        onDelete={async (id) => { await deleteQuote(id); load() }}
        onToggleFavorite={async (item) => { await toggleQuoteFavorite(item.id, !item.is_favorite); load() }}
      />

      <ListSheet
        open={promptsOpen}
        title="Pytania do refleksji"
        items={prompts}
        placeholder="Nowe pytanie"
        onClose={() => setPromptsOpen(false)}
        onAdd={async (t) => { await createPrompt(t); load() }}
        onDelete={async (id) => { await deletePrompt(id); load() }}
      />

      <PasswordSheet open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <DeleteAccountSheet open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  )
}

function ListSheet({ open, title, items, placeholder, onClose, onAdd, onDelete, onToggleFavorite, withAuthor }) {
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <div className="stack">
        <form className="stack" onSubmit={async (e) => {
          e.preventDefault()
          if (!text.trim()) return
          setBusy(true)
          try { await onAdd(text.trim(), author); setText(''); setAuthor('') } finally { setBusy(false) }
        }}>
          <label className="field">
            <span>{placeholder}</span>
            <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          {withAuthor && (
            <label className="field">
              <span>Autor (opcjonalnie)</span>
              <input type="text" value={author} placeholder="np. Jim Rohn"
                onChange={(e) => setAuthor(e.target.value)} />
            </label>
          )}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>Dodaj</button>
        </form>

        {items.length === 0 ? (
          <EmptyState>Lista jest pusta.</EmptyState>
        ) : (
          <ul className="entry-list">
            {items.map((item) => (
              <li key={item.id} className="entry">
                <div className="entry-head">
                  <span style={{ flex: 1, fontSize: '.92rem' }}>
                    {item.text}
                    {item.author && <em style={{ display: 'block', color: 'var(--ink-faint)', fontStyle: 'normal', fontSize: '.78rem', marginTop: '.2rem' }}>— {item.author}</em>}
                  </span>
                  <div className="entry-actions">
                    {onToggleFavorite && (
                      <button className={'chip' + (item.is_favorite ? ' is-active' : '')}
                        onClick={() => onToggleFavorite(item)}>★</button>
                    )}
                    <button className="chip" style={{ color: 'var(--danger)' }}
                      onClick={() => onDelete(item.id)}>Usuń</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  )
}

function PasswordSheet({ open, onClose }) {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Hasło musi mieć co najmniej 8 znaków.')
    if (password !== repeat) return setError('Hasła nie są takie same.')

    setSaving(true)
    try {
      await updatePassword(password)
      setDone(true)
      setPassword(''); setRepeat('')
      setTimeout(() => { setDone(false); onClose() }, 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title="Zmień hasło" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Nowe hasło</span>
          <input type="password" autoComplete="new-password" minLength={8}
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="field">
          <span>Powtórz nowe hasło</span>
          <input type="password" autoComplete="new-password" minLength={8}
            value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Zapisywanie…' : done ? 'Zmienione ✓' : 'Zapisz hasło'}
        </button>
      </form>
    </Sheet>
  )
}

function DeleteAccountSheet({ open, onClose }) {
  const { user, signOut } = useAuth()
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (confirm !== 'USUŃ') return setError('Wpisz USUŃ, żeby potwierdzić.')

    setBusy(true)
    try {
      // Kasujemy dane z kazdej tabeli; ON DELETE CASCADE zadziala dopiero przy
      // usunieciu konta w Supabase, do czego przegladarka nie ma uprawnien.
      for (const table of EXPORT_TABLES) {
        await supabase.from(table).delete().eq('user_id', user.id)
      }
      await signOut()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} title="Usuń konto" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted">
          Skasuje to <strong>wszystkie</strong> Twoje wpisy: wdzięczność, wydatki, godziny pracy,
          myśli, cele i nawyki. Tego nie da się cofnąć.
        </p>
        <p className="muted">
          Samo konto e-mail zostanie w Supabase — usuniesz je w panelu Supabase,
          w Authentication → Users. Przeglądarka nie ma do tego uprawnień.
        </p>
        <label className="field">
          <span>Wpisz USUŃ, żeby potwierdzić</span>
          <input type="text" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}
          style={{ background: 'var(--danger)', color: '#fff' }}>
          {busy ? 'Usuwanie…' : 'Usuń wszystkie moje dane'}
        </button>
      </form>
    </Sheet>
  )
}
