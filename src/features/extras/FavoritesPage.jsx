import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchFavorites } from './api'
import { TYPE_LABEL } from '../journal/api'
import { formatDatePl } from '../../lib/date'
import { Card, CardHead, EmptyState } from '../../components/ui'
import { PageLoader } from '../../components/FullScreenSpinner'

export default function FavoritesPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await fetchFavorites()) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <PageLoader />

  const total = data ? data.gratitude.length + data.journal.length + data.quotes.length : 0

  return (
    <div className="page-pad">
      <h1 className="page-title">Ulubione</h1>
      {error && <p className="form-error" role="alert">{error}</p>}

      {total === 0 && (
        <EmptyState>
          Nic jeszcze nie oznaczyłeś. Klikaj serduszko przy wpisach, które chcesz tu mieć.
        </EmptyState>
      )}

      {data.quotes.length > 0 && (
        <Card>
          <CardHead title="Cytaty" hint={`${data.quotes.length}`} />
          <ul className="entry-list">
            {data.quotes.map((q) => (
              <li key={q.id} className="entry">{q.text}</li>
            ))}
          </ul>
        </Card>
      )}

      {data.gratitude.length > 0 && (
        <Card>
          <CardHead
            title="Wdzięczność"
            hint={`${data.gratitude.length}`}
            action={<Link className="chip" to="/wdziecznosc">Otwórz</Link>}
          />
          <ul className="entry-list">
            {data.gratitude.map((g) => (
              <li key={g.id} className="entry">
                <span className="entry-date">{formatDatePl(g.date)}</span>
                <ul className="entry-items">
                  {g.items.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
                {g.reflection && <p className="entry-reflection">{g.reflection}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.journal.length > 0 && (
        <Card>
          <CardHead
            title="Myśli i cele"
            hint={`${data.journal.length}`}
            action={<Link className="chip" to="/mysli-i-cele">Otwórz</Link>}
          />
          <ul className="entry-list">
            {data.journal.map((j) => (
              <li key={j.id} className="entry">
                <div className="entry-head">
                  <span className="badge">{TYPE_LABEL[j.type]}</span>
                  <span className="entry-date">{formatDatePl(j.created_at.slice(0, 10))}</span>
                </div>
                {j.title && <span className="row-title" style={{ marginTop: '.3rem' }}>{j.title}</span>}
                {j.content && <p className="entry-reflection" style={{ fontStyle: 'normal' }}>{j.content}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
