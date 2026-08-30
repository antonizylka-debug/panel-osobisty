export function todayISO() {
  return isoDate(new Date())
}

export function isoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDaysISO(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + delta)
  return isoDate(date)
}

/** Data przesunieta o (mozliwe ulamkowe) miesiace — do prognoz oszczednosci. */
export function addMonthsISO(iso, months) {
  const [y, m, d] = iso.split('-').map(Number)
  const totalMonths = y * 12 + (m - 1) + months
  const wholeMonths = Math.floor(totalMonths)
  const fracDays = (totalMonths - wholeMonths) * 30.44
  const date = new Date(Math.floor(wholeMonths / 12), wholeMonths % 12, d + Math.round(fracDays))
  return isoDate(date)
}

/** Ile (ulamkowych) miesiecy dzieli dwie daty ISO. */
export function monthsBetweenISO(fromIso, toIso) {
  const [y1, m1, d1] = fromIso.split('-').map(Number)
  const [y2, m2, d2] = toIso.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1) + (d2 - d1) / 30.44
}

/** Ile pelnych dni dzieli dwie daty ISO. */
export function daysBetweenISO(fromIso, toIso) {
  const [y1, m1, d1] = fromIso.split('-').map(Number)
  const [y2, m2, d2] = toIso.split('-').map(Number)
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000)
}

const dayFormatter = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' })
const dayFormatterWithYear = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })

export function formatDatePl(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const thisYear = new Date().getFullYear()
  return (y === thisYear ? dayFormatter : dayFormatterWithYear).format(date)
}
