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

const dayFormatter = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' })
const dayFormatterWithYear = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })

export function formatDatePl(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const thisYear = new Date().getFullYear()
  return (y === thisYear ? dayFormatter : dayFormatterWithYear).format(date)
}
