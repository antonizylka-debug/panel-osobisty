import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchNetWorth } from './api'
import { formatPLN } from '../../lib/money'
import { formatDatePl } from '../../lib/date'
import { Card, CardHead } from '../../components/ui'

/**
 * Wartosc netto na Pulpicie — jedyne miejsce, gdzie wszystkie pieniadze
 * schodza sie do jednej liczby.
 */
export default function NetWorthCard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchNetWorth().then(setData).catch((err) => setError(err.message))
  }, [])

  if (error) {
    return (
      <Card>
        <CardHead title="Wartość netto" />
        <p className="form-error" role="alert">{error}</p>
      </Card>
    )
  }

  if (!data) return null

  const rows = [
    { label: 'Gotówka w domu', value: data.parts.cash, to: '/przychody' },
    { label: 'Odłożone na cel', value: data.parts.saved, to: '/wydatki' },
    { label: 'Czeka na wypłatę', value: data.parts.owedToYou, to: '/przychody' },
    { label: 'Do spłaty', value: -data.parts.debtLeft, to: '/wydatki' },
  ]

  return (
    <Card>
      <CardHead
        title="Wartość netto"
        hint="Gotówka + oszczędności + nierozliczone dniówki − długi"
      />
      <p className={'big-number ' + (data.netWorth >= 0 ? 'is-positive' : 'is-negative')}>
        {formatPLN(data.netWorth)}
      </p>

      <table className="ledger mt-1">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="ledger-main" data-label="Pozycja">
                <Link className="ledger-link" to={r.to}>{r.label}</Link>
              </td>
              <td className={'num' + (r.value < 0 ? ' is-negative' : '')} data-label="Kwota">
                {r.value < 0 ? `− ${formatPLN(Math.abs(r.value))}` : formatPLN(r.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.cashCountedAt && data.spentSinceCount > 0 && (
        <p className="muted mt-1">
          Gotówka: {formatPLN(data.spentSinceCount)} wydane od spisu z{' '}
          {formatDatePl(data.cashCountedAt)} już odjęte.
        </p>
      )}

      {data.missing.length > 0 && (
        <div className="converter is-muted mt-1">
          Nie liczę: {data.missing.join(', ')} — wymaga uruchomienia migracji.
        </div>
      )}
    </Card>
  )
}
