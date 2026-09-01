import { supabase } from '../../lib/supabaseClient'
import { todayISO, addDaysISO, daysBetweenISO } from '../../lib/date'

/** Czytanie: ksiazki (stan) + dziennik stron (zdarzenia). Migracja 0024. */

export const STATUSES = [
  { value: 'czytam',    label: 'Czytam' },
  { value: 'planuje',   label: 'Planuję' },
  { value: 'skonczona', label: 'Skończone' },
  { value: 'porzucona', label: 'Porzucone' },
]

export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]))

export async function fetchBooks() {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('status', { ascending: true })
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchLog(sinceDate) {
  let q = supabase.from('reading_log').select('*').order('date', { ascending: false })
  if (sinceDate) q = q.gte('date', sinceDate)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function createBook(payload) {
  const { data, error } = await supabase.from('books').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateBook(id, patch) {
  const { error } = await supabase.from('books').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteBook(id) {
  const { error } = await supabase.from('books').delete().eq('id', id)
  if (error) throw error
}

/**
 * Dopisuje przeczytane strony i przesuwa zakladke w ksiazce.
 *
 * Kolejnosc jak przy wplatach na cel (0021): najpierw zdarzenie, potem stan.
 * Gdyby drugi zapis padl, zostaje slad w dzienniku do recznego poprawienia,
 * a nie przesunieta zakladka bez wyjasnienia skad.
 */
export async function logPages({ bookId, pages, date, book }) {
  const { error } = await supabase
    .from('reading_log')
    .insert({ book_id: bookId, pages, date })
  if (error) throw error

  if (!book) return null

  const next = Math.max(0, Number(book.current_page) + Number(pages))
  const capped = book.total_pages ? Math.min(next, Number(book.total_pages)) : next
  const finished = book.total_pages != null && capped >= Number(book.total_pages)

  await updateBook(bookId, {
    current_page: capped,
    // Dojscie do ostatniej strony samo zamyka ksiazke — inaczej "Czytam"
    // wisialoby na pozycji, ktora jest skonczona.
    ...(finished ? { status: 'skonczona', finished_at: date } : {}),
  })

  return { capped, finished }
}

export async function deleteLogEntry(id) {
  const { error } = await supabase.from('reading_log').delete().eq('id', id)
  if (error) throw error
}

/** Seria dni z czytaniem — jak w medytacji, liczona od dzis albo wczoraj. */
export function readingStreak(log, today = todayISO()) {
  if (log.length === 0) return 0
  const days = new Set(log.map((l) => l.date))
  let cursor = days.has(today) ? today : addDaysISO(today, -1)
  if (!days.has(cursor)) return 0
  let n = 0
  while (days.has(cursor)) { n++; cursor = addDaysISO(cursor, -1) }
  return n
}

export function readingStats(books, log, today = todayISO()) {
  const week = log.filter((l) => daysBetweenISO(l.date, today) < 7)
  const pagesTotal = log.reduce((s, l) => s + Number(l.pages), 0)
  const finished = books.filter((b) => b.status === 'skonczona')

  return {
    streak: readingStreak(log, today),
    weekPages: week.reduce((s, l) => s + Number(l.pages), 0),
    totalPages: pagesTotal,
    finishedCount: finished.length,
    readingCount: books.filter((b) => b.status === 'czytam').length,
    avgRating: finished.filter((b) => b.rating).length
      ? finished.filter((b) => b.rating).reduce((s, b) => s + b.rating, 0)
        / finished.filter((b) => b.rating).length
      : null,
  }
}

export function isMissingTable(err) {
  return /books|reading_log/.test(err?.message ?? '')
}
