import { useEffect, useState } from 'react'
import { fetchBalanceData, balanceFor } from './api'
import { resolvePeriod } from '../../lib/period'
import { formatPLN } from '../../lib/money'
import { todayISO } from '../../lib/date'
import { Card, InfoTip } from '../../components/ui'

/**
 * Najprostsza mozliwa liczba: zarobione minus wydane. Koniec.
 *
 * Swiadomie BEZ rat, bez okresow, bez porownan — od tego jest karta "Bilans"
 * nizej. Ta ma odpowiadac na jedno pytanie, ktore zadaje sie najczesciej,
 * i nie zmuszac do liczenia niczego w glowie.
 */
export default function SimpleBalanceCard({ refreshKey = 0 }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    fetchBalanceData()
      .then((d) => {
        if (!alive) return
        setData(balanceFor(d, resolvePeriod({ preset: 'all' }, todayISO())))
      })
      .catch(() => { /* karta jest dodatkiem — bledy pokazuje "Bilans" nizej */ })
    return () => { alive = false }
  }, [refreshKey])

  if (!data) return null

  // Bez rat — uzytkownik chce czystej roznicy, nie pelnego rachunku.
  const left = data.earned - data.spent

  return (
    <Card className="simple-balance">
      <div className="simple-balance-row">
        <div className="simple-balance-part">
          <span className="simple-balance-label">
            Zarobiłeś
            <InfoTip text="Wszystkie dniówki z Godzin pracy plus Dodatkowa kasa, od pierwszego wpisu do dziś. Bez rat i bez oszczędności." />
          </span>
          <b className="simple-balance-num">{formatPLN(data.earned)}</b>
        </div>

        <span className="simple-balance-op" aria-hidden="true">−</span>

        <div className="simple-balance-part">
          <span className="simple-balance-label">
            Wydałeś
            <InfoTip text="Suma wszystkich wydatków z zakładki Wydatki, od pierwszego wpisu do dziś. Liczą się wszystkie kategorie i sposoby płatności. Raty NIE są tu wliczone." />
          </span>
          <b className="simple-balance-num">{formatPLN(data.spent)}</b>
        </div>

        <span className="simple-balance-op" aria-hidden="true">=</span>

        <div className="simple-balance-part is-result">
          <span className="simple-balance-label">
            Zostało
            <InfoTip text="Zarobione minus wydane. Celowo bez rat — pełny rachunek z ratami jest w karcie Bilans niżej." />
          </span>
          <b className={'simple-balance-num' + (left < 0 ? ' is-negative' : '')}>
            {formatPLN(left)}
          </b>
        </div>
      </div>
    </Card>
  )
}
