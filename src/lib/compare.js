/**
 * Krotki tekst "wiecej/mniej niz poprzedni okres" — do porownan
 * miesiac do miesiaca, tydzien do tygodnia itp. Null gdy nie ma
 * z czym porownac (brak danych z poprzedniego okresu).
 */
export function compareLabel(current, previous, noun, format) {
  if (!previous || previous <= 0) return null
  const diff = current - previous
  if (diff === 0) return `Tyle samo co ${noun}`
  const pct = Math.round((Math.abs(diff) / previous) * 100)
  return `${diff > 0 ? '▲' : '▼'} ${pct}% ${diff > 0 ? 'więcej' : 'mniej'} niż ${noun} — ${format(Math.abs(diff))}`
}
