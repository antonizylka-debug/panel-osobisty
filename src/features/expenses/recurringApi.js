import { supabase } from '../../lib/supabaseClient'
import { todayISO, addDaysISO, isoDate } from '../../lib/date'

/**
 * Wydatki cykliczne — szablon + data najblizszego wystapienia (migracja 0019).
 */

export const CYCLE_LABEL = {
  weekly: 'co tydzień',
  monthly: 'co miesiąc',
  quarterly: 'co kwartał',
  yearly: 'co rok',
}

export const CYCLES = Object.entries(CYCLE_LABEL).map(([value, label]) => ({ value, label }))

export async function fetchRecurring({ includeInactive = false } = {}) {
  let q = supabase.from('recurring_expenses').select('*').order('next_due', { ascending: true })
  if (!includeInactive) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function createRecurring(payload) {
  const { data, error } = await supabase.from('recurring_expenses').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateRecurring(id, patch) {
  const { error } = await supabase.from('recurring_expenses').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteRecurring(id) {
  const { error } = await supabase.from('recurring_expenses').delete().eq('id', id)
  if (error) throw error
}

/**
 * Kolejny termin po `iso` dla danego cyklu.
 *
 * Dla cykli miesiecznych i dluzszych trzymamy sie DNIA MIESIACA z pierwotnej
 * daty. Gdy docelowy miesiac jest krotszy (31 -> luty), schodzimy na ostatni
 * dzien miesiaca — inaczej JS przewinalby date na marzec i rachunek z 31.01
 * zniknalby z lutego.
 */
export function nextDue(iso, cycle) {
  const [y, m, d] = iso.split('-').map(Number)

  if (cycle === 'weekly') return addDaysISO(iso, 7)

  const monthsAhead = cycle === 'monthly' ? 1 : cycle === 'quarterly' ? 3 : 12
  const target = new Date(y, m - 1 + monthsAhead, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return isoDate(new Date(target.getFullYear(), target.getMonth(), Math.min(d, lastDay)))
}

/**
 * Dopisuje zalegle wystapienia i przesuwa next_due na przyszlosc.
 *
 * Odporne na wielokrotne wywolanie: insert leci z ignoreDuplicates na
 * (recurring_id, date), a wiec ta sama rata nie wpadnie dwa razy nawet gdy
 * apka odpali sie rownolegle na dwoch urzadzeniach.
 *
 * Zwraca liczbe faktycznie dopisanych wydatkow.
 */
export async function generateDueExpenses() {
  const today = todayISO()
  const due = await fetchRecurring()
  const pending = due.filter((r) => r.next_due <= today)
  if (pending.length === 0) return 0

  const rows = []
  const updates = []

  for (const r of pending) {
    let cursor = r.next_due
    // Nadrabiamy wszystkie pominiete cykle, nie tylko ostatni — apka mogla
    // byc nieuruchamiana przez kilka miesiecy.
    let guard = 0
    while (cursor <= today && guard < 240) {
      rows.push({
        recurring_id: r.id,
        date: cursor,
        amount: r.amount,
        description: r.description,
        category: r.category,
        context: r.context,
        for_whom: r.for_whom,
        type: 'receipt',
      })
      cursor = nextDue(cursor, r.cycle)
      guard++
    }
    updates.push({ id: r.id, next_due: cursor })
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from('expenses')
      .upsert(rows, { onConflict: 'recurring_id,date', ignoreDuplicates: true })
    if (error) throw error
  }

  // next_due przesuwamy dopiero po udanym zapisie wydatkow.
  for (const u of updates) {
    const { error } = await supabase
      .from('recurring_expenses')
      .update({ next_due: u.next_due })
      .eq('id', u.id)
    if (error) throw error
  }

  return rows.length
}

export function isMissingTable(err) {
  return /recurring_expenses|recurring_id/.test(err?.message ?? '')
}
