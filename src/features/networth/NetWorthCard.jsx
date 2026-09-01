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
    // Odlozone doliczamy tylko wtedy, gdy leza poza gotowka — inaczej sa
    // ta sama kwota, ktora juz stoi w wierszu wyzej (patrz migracja 0022).
    ...(data.savedSeparately
      ? [{ label: 'Odłożone (osobno)', value: data.parts.saved, to: '/przychody' }]
      : []),
    { label: 'Czeka na wypłatę', value: data.parts.owedToYou, to: '/przychody' },
    { label: 'Do spłaty', value: -data.parts.debtLeft, to: '/wydatki' },
  ]

  return (
    <Card>
      <CardHead
        title="Wartość netto"
        hint={data.savedSeparately
          ? 'Gotówka + odłożone osobno + nierozliczone dniówki − długi'
          : 'Gotówka + nierozliczone dniówki − długi'}
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

      {!data.savedSeparately && data.parts.saved > 0 && (
        <p className="muted mt-1">
          Z tej gotówki {formatPLN(data.parts.saved)} masz zaklepane na cel —
          nie doliczam ich drugi raz. Trzymasz odłożone gdzie indziej?
          Zmień to w Przychodach → Odkładanie.
        </p>
      )}

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
