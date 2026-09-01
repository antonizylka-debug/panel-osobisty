import { todayISO, isoDate, addDaysISO, daysBetweenISO, formatDatePl } from './date'

/**
 * Zakres dat wspolny dla Wydatkow, Przychodow i Godzin pracy.
 *
 * Jeden wybor obowiazuje na wszystkich trzech ekranach, zeby liczby dalo sie
 * zestawiac: "w tym samym okresie zarobilem X, wydalem Y, przepracowalem Z".
 * Presety licza sie wzgledem dnia dzisiejszego przy kazdym odczycie — dzieki
 * temu zapamietany "ten miesiac" nie zostaje na sztywno przy sierpniu, gdy
 * przyjdzie wrzesien.
 */

export const PERIOD_PRESETS = [
  { value: 'today',     label: 'Dziś' },
  { value: 'week',      label: 'Ten tydzień' },
  { value: 'lastWeek',  label: 'Poprzedni tydzień' },
  { value: 'month',     label: 'Ten miesiąc' },
  { value: 'lastMonth', label: 'Poprzedni miesiąc' },
  { value: 'days30',    label: 'Ostatnie 30 dni' },
  { value: 'year',      label: 'Ten rok' },
  { value: 'all',       label: 'Wszystko' },
]

/** Najwczesniejsza data, od ktorej w ogole moga istniec wpisy. */
const EPOCH = '2000-01-01'

function monthStartISO(iso) {
  return iso.slice(0, 8) + '01'
}

function monthEndISO(iso) {
  const [y, m] = iso.split('-').map(Number)
  // dzien 0 kolejnego miesiaca = ostatni dzien biezacego
  return isoDate(new Date(y, m, 0))
}

/** Poniedzialek tygodnia, w ktorym lezy podana data (konwencja PL). */
function weekStartISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7
  return addDaysISO(iso, -dow)
}

/**
 * Zamienia wybor uzytkownika na konkretny zakres dat.
 * `period` to { preset } albo { preset: 'custom', from, to }.
 */
export function resolvePeriod(period, today = todayISO()) {
  const preset = period?.preset ?? 'month'

  if (preset === 'custom') {
    // Odwrocony zakres (od > do) prostujemy zamiast zwracac pustke.
    const a = period.from || today
    const b = period.to || today
    const [from, to] = a <= b ? [a, b] : [b, a]
    return { preset, from, to }
  }

  switch (preset) {
    case 'today':
      return { preset, from: today, to: today }
    case 'week':
      return { preset, from: weekStartISO(today), to: today }
    case 'lastWeek': {
      const start = addDaysISO(weekStartISO(today), -7)
      return { preset, from: start, to: addDaysISO(start, 6) }
    }
    case 'month':
      return { preset, from: monthStartISO(today), to: today }
    case 'lastMonth': {
      const prev = addDaysISO(monthStartISO(today), -1)
      return { preset, from: monthStartISO(prev), to: monthEndISO(prev) }
    }
    case 'days30':
      return { preset, from: addDaysISO(today, -29), to: today }
    case 'year':
      return { preset, from: today.slice(0, 4) + '-01-01', to: today }
    case 'all':
      return { preset, from: EPOCH, to: today }
    default:
      return { preset: 'month', from: monthStartISO(today), to: today }
  }
}

/**
 * Poprzedni odcinek tej samej dlugosci, konczacy sie tuz przed `from`.
 * Sluzy do porownan "wiecej/mniej niz poprzednio" — liczba bez odniesienia
 * niewiele mowi.
 *
 * Dla "poprzedniego miesiaca" i "poprzedniego tygodnia" cofamy sie o pelna
 * jednostke kalendarzowa, nie o liczbe dni — inaczej porownanie lutego
 * wypadaloby wzgledem dziwnego wycinka stycznia.
 */
export function previousRange({ preset, from, to }, today = todayISO()) {
  if (preset === 'all') return null

  if (preset === 'month') {
    const prev = addDaysISO(monthStartISO(today), -1)
    // Ten sam dzien miesiaca, zeby porownywac "do 12-go" z "do 12-go".
    const dayOfMonth = daysBetweenISO(monthStartISO(today), to)
    const prevStart = monthStartISO(prev)
    const prevEnd = addDaysISO(prevStart, dayOfMonth)
    return { from: prevStart, to: prevEnd > monthEndISO(prev) ? monthEndISO(prev) : prevEnd }
  }

  if (preset === 'lastMonth') {
    const prev = addDaysISO(from, -1)
    return { from: monthStartISO(prev), to: monthEndISO(prev) }
  }

  const span = daysBetweenISO(from, to)
  return { from: addDaysISO(from, -span - 1), to: addDaysISO(from, -1) }
}

/** Krotki opis zakresu do pokazania pod przyciskiem wyboru. */
export function formatRange({ preset, from, to }) {
  if (preset === 'all') return 'Cała historia'
  if (from === to) return formatDatePl(from)
  return `${formatDatePl(from)} – ${formatDatePl(to)}`
}

/** Etykieta presetu; dla zakresu wlasnego same daty. */
export function periodLabel(period) {
  if (period.preset === 'custom') return 'Zakres własny'
  return PERIOD_PRESETS.find((p) => p.value === period.preset)?.label ?? 'Ten miesiąc'
}

/** Ile dni obejmuje zakres (wlacznie z oboma koncami). */
export function rangeDays({ from, to }) {
  return daysBetweenISO(from, to) + 1
}
