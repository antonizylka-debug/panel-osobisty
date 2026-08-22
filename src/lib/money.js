const pln = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 2,
})

const plnShort = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 0,
})

export function formatPLN(value, { short = false } = {}) {
  const n = Number(value ?? 0)
  return short ? plnShort.format(n) : pln.format(n)
}

/**
 * Godziny po ludzku: 11.78 -> "11 h 47 min", a nie "11,8 h".
 * Ulamek godziny nikomu nic nie mowi, minuty mowia wszystko.
 */
export function formatHours(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—'

  const totalMinutes = Math.round(Number(value) * 60)
  const sign = totalMinutes < 0 ? '-' : ''
  const abs = Math.abs(totalMinutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60

  if (totalMinutes === 0) return '0 h'
  if (h === 0) return `${sign}${m} min`
  if (m === 0) return `${sign}${h} h`
  return `${sign}${h} h ${m} min`
}

/** Godziny dziesietne na zapis 'H:MM' do pola edycyjnego. */
export function hoursToClock(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return ''
  const totalMinutes = Math.round(Number(value) * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/**
 * Czas trwania z pola edycyjnego na godziny dziesietne.
 * '7:20' -> 7.33, '7,5' -> 7.5, '7' -> 7. Null gdy sie nie da odczytac.
 */
export function clockToHours(raw) {
  const s = String(raw ?? '').trim()
  if (s === '') return ''

  if (s.includes(':')) {
    const [hPart, mPart = '0'] = s.split(':')
    const h = Number(hPart.replace(/\D/g, '') || 0)
    const m = Number(mPart.replace(/\D/g, '') || 0)
    if (!Number.isFinite(h) || !Number.isFinite(m) || m > 59) return null
    return Math.round((h + m / 60) * 100) / 100
  }

  const n = Number(s.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

export function parseAmount(text) {
  if (typeof text === 'number') return text
  const cleaned = String(text ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}
