import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { searchEverything } from './api'
import { formatDatePl } from '../../lib/date'
import { EmptyState } from '../../components/ui'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (query.trim().length < 2) {
      setGroups([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true)
      setError('')
      try {
        const result = await searchEverything(query)
        if (!cancelled) setGroups(result)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  const total = groups.reduce((s, g) => s + g.items.length, 0)

  return (
    <div className="page-pad">
      <h1 className="page-title">Szukaj</h1>

      <input
        className="search-input"
        type="search"
        placeholder="Czego szukasz?"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {error && <p className="form-error mt-1" role="alert">{error}</p>}

      {query.trim().length >= 2 && (
        <p className="muted mt-1">
          {searching ? 'Szukam…' : total === 0 ? 'Nic nie znalazłem.' : `${total} wyników`}
        </p>
      )}

      {query.trim().length < 2 && (
        <EmptyState>Wpisz co najmniej dwa znaki — przeszukam wszystkie zakładki.</EmptyState>
      )}

      {groups.map((g) => (
        <section key={g.group}>
          <h2 className="search-group-title">{g.group}</h2>
          <ul className="row-list">
            {g.items.map((item) => (
              <li key={item.id}>
                <Link className="row-item" to={item.to}>
                  <div className="row-main">
                    <span className="row-title">{item.title}</span>
                    {(item.sub || item.date) && (
                      <span className="row-sub">
                        {item.date ? formatDatePl(item.date) : ''}
                        {item.date && item.sub ? ' · ' : ''}
                        {item.sub}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
