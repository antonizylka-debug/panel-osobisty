import { useEffect, useState } from 'react'
import { fetchBalanceData, allBalances } from './api'
import { formatPLN } from '../../lib/money'
import { todayISO, formatDatePl } from '../../lib/date'
import { Card, CardHead, InfoTip } from '../../components/ui'

/**
 * Bilans w kilku okresach obok siebie + "od zawsze".
 *
 * Kafelki na gorze daja szybkie porownanie samych bilansow, tabela pod nimi
 * rozbija je na skladniki — inaczej ujemny bilans nie mowi, czy wynika z
 * malych zarobkow, czy z duzych wydatkow.
 */
export default function BalanceOverviewCard({ refreshKey = 0 }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetchBalanceData()
      .then((data) => { if (alive) setRows(allBalances(data, todayISO())) })
      .catch((err) => { if (alive) setError(err.message) })
    return () => { alive = false }
  }, [refreshKey])

  if (error) {
    return (
      <Card>
        <CardHead title="Bilans" />
        <p className="form-error" role="alert">{error}</p>
      </Card>
    )
  }

  if (!rows) return null

  const allTime = rows.find((r) => r.preset === 'all')

  return (
    <Card>
      <CardHead
        title="Bilans"
        hint="Zarobione minus wydatki minus zapłacone raty"
      />

      {/* Same bilanse obok siebie — do rzutu oka. */}
      <div className="balance-row">
        {rows.filter((r) => r.preset !== 'all').map((r) => (
          <div className="balance-cell" key={r.preset}>
            <span className="balance-label">{r.label}</span>
            <b className={'balance-value ' + (r.balance >= 0 ? 'is-positive' : 'is-negative')}>
              {formatPLN(r.balance, { short: r.preset === 'year' })}
            </b>
            <span className="balance-sub">
              {r.earned > 0 ? `z ${formatPLN(r.earned, { short: true })}` : 'brak przychodu'}
            </span>
          </div>
        ))}

        {/* Od zawsze — pasek przez cala szerokosc, pod okresami. */}
        <div className="balance-cell is-total">
          <span className="balance-total-main">
            <span className="balance-label">Od zawsze</span>
            <b className={'balance-value ' + (allTime.balance >= 0 ? 'is-positive' : 'is-negative')}>
              {formatPLN(allTime.balance)}
            </b>
          </span>
          {/* Wymieniamy WSZYSTKIE trzy skladowe, nie dwie — inaczej liczba
              nie zgadza sie z tym, co widac obok, i wyglada na blad. */}
          <span className="balance-sub">
            {allTime.earned > 0
              ? `${formatPLN(allTime.earned, { short: true })} zarobione`
                + ` − ${formatPLN(allTime.spent, { short: true })} wydane`
                + (allTime.installments > 0
                  ? ` − ${formatPLN(allTime.installments, { short: true })} raty`
                  : '')
                + ` · zostało ${Math.round((allTime.balance / allTime.earned) * 100)}%`
              : 'brak przychodu w historii'}
          </span>
        </div>
      </div>

      {/* Rozbicie — bez tego nie widac, skad bierze sie wynik. */}
      <table className="ledger mt-1">
        <thead>
          <tr>
            <th>Okres</th>
            <th className="num">
              Zarobione
              <InfoTip text="Dniówki z Godzin pracy plus Dodatkowa kasa, z datą mieszczącą się w tym okresie." />
            </th>
            <th className="num">
              Wydane
              <InfoTip text="Suma wydatków z datą w tym okresie — wszystkie kategorie, gotówka i karta razem. Raty są w osobnej kolumnie." />
            </th>
            <th className="num">
              Raty
              <InfoTip text="Tylko raty faktycznie odhaczone jako zapłacone. Rata liczy się do miesiąca, którego dotyczy — dlatego w krótkich okresach zwykle jest tu kreska." />
            </th>
            <th className="num">
              Bilans
              <InfoTip text="Zarobione minus wydane minus zapłacone raty." />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.preset}>
              <td className="ledger-main" data-label="Okres">
                <span className="ledger-name">{r.label}</span>
                <span className="ledger-sub">
                  {r.preset === 'all'
                    ? 'cała historia'
                    : r.range.from === r.range.to
                      ? formatDatePl(r.range.from)
                      : `${formatDatePl(r.range.from)} – ${formatDatePl(r.range.to)}`}
                </span>
              </td>
              <td className="num" data-label="Zarobione">
                {formatPLN(r.earned, { short: true })}
                {r.fromExtra > 0 && (
                  <span className="ledger-sub">
                    w tym {formatPLN(r.fromExtra, { short: true })} dodatkowe
                  </span>
                )}
              </td>
              <td className="num" data-label="Wydane">{formatPLN(r.spent, { short: true })}</td>
              <td className="num" data-label="Raty">
                {r.installments > 0 ? formatPLN(r.installments, { short: true }) : '—'}
              </td>
              <td className={'num ' + (r.balance >= 0 ? '' : 'is-negative')} data-label="Bilans">
                {formatPLN(r.balance, { short: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="muted mt-1">
        Raty liczone z faktycznie odhaczonych spłat, nie z samego zobowiązania —
        dlatego w krótkich okresach zwykle wychodzi zero.
      </p>
    </Card>
  )
}
