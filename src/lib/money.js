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

export function formatHours(value) {
  const n = Number(value ?? 0)
  const rounded = Math.round(n * 10) / 10
  return `${rounded.toLocaleString('pl-PL')} h`
}

export function parseAmount(text) {
  if (typeof text === 'number') return text
  const cleaned = String(text ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}
