import { supabase } from '../../lib/supabaseClient'

/**
 * Gotowka w domu — model "spisu z natury" (patrz 0017_cash_on_hand.sql).
 * Kazdy wiersz to STAN po przeliczeniu, nie roznica.
 */

export async function fetchCashHistory(limit = 40) {
  const { data, error } = await supabase
    .from('cash_on_hand')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/** Zapisuje nowy stan gotowki. */
export async function saveCashCount({ date, amount, note }) {
  const { data, error } = await supabase
    .from('cash_on_hand')
    .insert({ date, amount, note: note?.trim() || null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCashCount(id) {
  const { error } = await supabase.from('cash_on_hand').delete().eq('id', id)
  if (error) throw error
}

/** Aktualny stan = najnowszy wpis; historia przychodzi juz posortowana. */
export function currentCash(history) {
  return history.length > 0 ? Number(history[0].amount) : null
}

/**
 * Roznica miedzy dwoma ostatnimi spisami — pokazuje, czy gotowki przybylo
 * czy ubylo od ostatniego liczenia.
 */
export function lastChange(history) {
  if (history.length < 2) return null
  return Number(history[0].amount) - Number(history[1].amount)
}

/** Rozpoznaje bledy "tabela nie istnieje" — apka ma wtedy poprosic o migracje. */
export function isMissingTable(err) {
  return /cash_on_hand/.test(err?.message ?? '')
}

/**
 * Wydatki oznaczone jako gotowkowe od dnia ostatniego spisu (wlacznie).
 *
 * To jest cale powiazanie wydatkow z gotowka: nie dopisujemy nic do
 * cash_on_hand, tylko odejmujemy w locie. Dzieki temu skasowanie albo
 * poprawienie wydatku od razu prostuje stan, a historia spisow zostaje
 * historia spisow — patrz komentarz w migracji 0020.
 */
export async function fetchCashSpentSince(count) {
  if (!count) return 0
  const { data, error } = await supabase
    .from('expenses')
    .select('amount, date, created_at')
    .eq('payment_method', 'cash')
    .gte('date', count.date)
  // Brak kolumny payment_method (migracja 0020) nie moze wywalac karty.
  if (error) {
    if (/payment_method/.test(error.message)) return 0
    throw error
  }

  // Granica jest punktem w czasie, nie dniem. Wydatek z DNIA spisu liczy sie
  // tylko wtedy, gdy zostal dopisany PO spisie — inaczej odjelibysmy drugi raz
  // to, co spis juz uwzglednil (np. "przeliczam" zaraz po zakupach).
  return (data ?? [])
    .filter((e) => e.date > count.date || (e.date === count.date && e.created_at > count.created_at))
    .reduce((s, e) => s + Number(e.amount), 0)
}
