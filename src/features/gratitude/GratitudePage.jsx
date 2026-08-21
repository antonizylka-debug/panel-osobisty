import { useCallback, useEffect, useMemo, useState } from 'react'
import GratitudeForm from './GratitudeForm'
import { fetchEntry, fetchMoodHistory, fetchEntriesPage, setFavorite } from './api'
import { todayISO, addDaysISO, formatDatePl } from '../../lib/date'
import { Card, CardHead, BarChart, EmptyState, StatRow } from '../../components/ui'
import { IconGratitude } from '../../components/icons'

function computeStreak(dates) {
  const set = new Set(dates)
  let streak = 0
  let cursor = todayISO()
  // Wpis z dzisiaj jeszcze nie musi istniec — streak liczymy wtedy od wczoraj.
  if (!set.has(cursor)) cursor = addDaysISO(cursor, -1)
  while (set.has(cursor)) {
    streak++
    cursor = addDaysISO(cursor, -1)
  }
  return streak
}

const PAGE_SIZE = 20

export default function GratitudePage() {
  const today = todayISO()
  const [entry, setEntry] = useState(null)
  const [history, setHistory] = useState([])
  const [list, setList] = useState([])
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const since = addDaysISO(today, -364)
      const [todayEntry, moods, page] = await Promise.all([
        fetchEntry(today),
        fetchMoodHistory(since),
        fetchEntriesPage({ offset: 0, limit: PAGE_SIZE }),
      ])
      setEntry(todayEntry)
      setHistory(moods)
      setList(page)
      setHasMore(page.length === PAGE_SIZE)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => { load() }, [load])

  async function loadMore() {
    try {
      const page = await fetchEntriesPage({ offset: list.length, limit: PAGE_SIZE })
      setList((prev) => [...prev, ...page])
      setHasMore(page.length === PAGE_SIZE)
    } catch (err) {
      setError(err.message)
    }
  }

  function handleSaved(saved) {
    setEntry(saved)
    setList((prev) => {
      const without = prev.filter((e) => e.id !== saved.id)
      return [saved, ...without].sort((a, b) => (a.date < b.date ? 1 : -1))
    })
    setHistory((prev) => {
      const without = prev.filter((h) => h.date !== saved.date)
      return [...without, { date: saved.date, mood: saved.mood }].sort((a, b) => (a.date < b.date ? -1 : 1))
    })
  }

  async function toggleFavorite(item) {
    const next = !item.is_favorite
    setList((prev) => prev.map((e) => (e.id === item.id ? { ...e, is_favorite: next } : e)))
    if (entry?.id === item.id) setEntry((prev) => ({ ...prev, is_favorite: next }))
    try {
      await setFavorite(item.id, next)
    } catch (err) {
      setError(err.message)
      load()
    }
  }

  const streak = useMemo(() => computeStreak(history.map((h) => h.date)), [history])

  const chartData = useMemo(
    () =>
      history
        .slice(-14)
        .map((h) => ({ label: h.date.slice(8), value: h.mood ?? 0 })),
    [history]
  )

  const visible = onlyFavorites ? list.filter((e) => e.is_favorite) : list

  if (loading) return <div className="page-pad"><p className="page-lede">Wczytywanie…</p></div>

  return (
    <div className="page-pad">
      <h1 className="page-title">Wdzięczność</h1>

      {error && <p className="form-error" role="alert">{error}</p>}

      <Card>
        <CardHead title={formatDatePl(today)} hint={entry ? 'Wpis zapisany — możesz go zmienić' : 'Dzisiaj jeszcze nic nie zapisałeś'} />
        <GratitudeForm date={today} entry={entry} onSaved={handleSaved} />
      </Card>

      <StatRow
        items={[
          { label: 'dni z rzędu', value: streak },
          { label: 'wpisów łącznie', value: history.length },
          { label: 'ulubionych', value: list.filter((e) => e.is_favorite).length },
        ]}
      />

      <Card>
        <CardHead title="Nastrój" hint="Ostatnie dwa tygodnie" />
        <BarChart data={chartData} height={90} />
      </Card>

      <Card>
        <CardHead
          title="Historia"
          action={
            <button
              type="button"
              className={'chip' + (onlyFavorites ? ' is-active' : '')}
              onClick={() => setOnlyFavorites((v) => !v)}
              aria-pressed={onlyFavorites}
            >
              Tylko ulubione
            </button>
          }
        />
        {visible.length === 0 ? (
          <EmptyState>
            {onlyFavorites ? 'Nie masz jeszcze ulubionych wpisów.' : 'Twoje wpisy pojawią się tutaj.'}
          </EmptyState>
        ) : (
          <ul className="entry-list">
            {visible.map((item) => (
              <li key={item.id} className="entry">
                <div className="entry-head">
                  <span className="entry-date">{formatDatePl(item.date)}</span>
                  <div className="entry-actions">
                    {item.mood && <span className="entry-mood">{item.mood}/5</span>}
                    <button
                      className={'favorite-toggle' + (item.is_favorite ? ' is-active' : '')}
                      onClick={() => toggleFavorite(item)}
                      aria-pressed={item.is_favorite}
                      aria-label={item.is_favorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
                    >
                      <IconGratitude style={item.is_favorite ? { fill: 'currentColor' } : undefined} />
                    </button>
                  </div>
                </div>
                <ul className="entry-items">
                  {item.items.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
                {item.reflection && <p className="entry-reflection">{item.reflection}</p>}
              </li>
            ))}
          </ul>
        )}
        {hasMore && !onlyFavorites && visible.length > 0 && (
          <button className="btn btn-ghost btn-block" onClick={loadMore}>Pokaż starsze</button>
        )}
      </Card>
    </div>
  )
}
