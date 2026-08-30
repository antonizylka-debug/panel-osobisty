import { addMonthsISO, monthsBetweenISO } from './date'

/**
 * Prognoza celu oszczednosciowego: przy obecnym tempie (miesieczna kwota
 * odlozona) kiedy uzbierasz cel, i — jesli jest ustawiony termin — czy
 * zdazysz i ile trzeba by odkladac miesiecznie, zeby zdazyc.
 */
export function savingsProjection(savings, monthlyRate, today) {
  if (!savings) return null
  const needed = Number(savings.target_amount) - Number(savings.current_amount)
  if (needed <= 0) return { done: true }

  const monthsAtCurrentRate = monthlyRate > 0 ? needed / monthlyRate : null
  const projectedDate = monthsAtCurrentRate != null ? addMonthsISO(today, monthsAtCurrentRate) : null

  if (!savings.target_date) {
    return { done: false, monthlyRate, projectedDate }
  }

  const monthsToTarget = monthsBetweenISO(today, savings.target_date)
  const requiredPerMonth = monthsToTarget > 0 ? needed / monthsToTarget : null
  const onTrack = projectedDate != null && projectedDate <= savings.target_date

  return {
    done: false, monthlyRate, projectedDate,
    targetDate: savings.target_date, requiredPerMonth, onTrack,
  }
}
