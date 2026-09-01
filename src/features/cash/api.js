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
