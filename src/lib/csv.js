/** Parser CSV radzacy sobie z cudzyslowami i przecinkami w polach. */
export function parseCsv(text, delimiter) {
  const delim = delimiter ?? detectDelimiter(text)
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += ch
      continue
    }

    if (ch === '"') { inQuotes = true; continue }
    if (ch === delim) { row.push(field); field = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }

  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

function detectDelimiter(text) {
  const head = text.slice(0, 2000)
  const counts = { ',': 0, ';': 0, '\t': 0 }
  let inQuotes = false
  for (const ch of head) {
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && ch in counts) counts[ch]++
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

/** Kwota z wyciagu: "-1 234,56 PLN" -> -1234.56 */
export function parseCsvAmount(raw) {
  if (raw == null) return null
  let s = String(raw).trim().replace(/\s| /g, '')
  s = s.replace(/[A-Za-zł€$]/g, '')
  const negative = /^\(.*\)$/.test(s) || s.includes('-')
  s = s.replace(/[()\-+]/g, '')

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/,/g, '')

  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

/** Data z wyciagu w roznych formatach -> YYYY-MM-DD */
export function parseCsvDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`

  return null
}

const pad = (v) => String(v).padStart(2, '0')

/** Zgadywanie, ktora kolumna jest czym — uzytkownik moze poprawic. */
export function guessColumns(header) {
  const find = (...needles) =>
    header.findIndex((h) => {
      const low = h.toLowerCase()
      return needles.some((n) => low.includes(n))
    })

  return {
    date: find('data operacji', 'data transakcji', 'data księgowania', 'data', 'date'),
    amount: find('kwota', 'obciążenia', 'wartość', 'amount'),
    description: find('opis', 'tytuł', 'odbiorca', 'kontrahent', 'nadawca', 'description', 'title'),
  }
}

export function toCsv(rows) {
  return rows
    .map((r) => r.map((cell) => {
      const s = cell == null ? '' : String(cell)
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }).join(','))
    .join('\n')
}

export function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
