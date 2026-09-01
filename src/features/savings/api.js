import { supabase } from '../../lib/supabaseClient'
import { daysBetweenISO, todayISO } from '../../lib/date'

/**
 * Historia odkladania na cel (migracja 0021).
 * savings_goal.current_amount zostaje zrodlem prawdy — patrz komentarz
 * w migracji. Tutaj trzymamy zdarzenia: kiedy, ile i skad.
 */

export const SOURCES = [
  { value: 'dniowka',   label: 'Z dniówki' },
  { value: 'dodatkowa', label: 'Z dodatkowej kasy' },
  { value: 'gotowka',   label: 'Z gotówki w domu' },
  { value: 'inne',      label: 'Inne' },
]

export const SOURCE_LABEL = Object.fromEntries(SOURCES.map((s) => [s.value, s.label]))

export async function fetchDeposits() {
  const { data, error } = await supabase
    .from('savings_deposits')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * Dopisuje wplate i podbija current_amount na celu.
 *
 * Dwa zapisy zamiast jednego, bo current_amount czyta pol apki i nie moze
 * przestac byc aktualne. Kolejnosc: najpierw historia, potem stan — gdyby
 * drugi zapis padl, zostaje slad zdarzenia do recznego poprawienia, a nie
 * podbity stan bez wyjasnienia skad.
 */
export async function addDeposit({ date, amount, source, note, currentAmount }) {
  const { error } = await supabase
    .from('savings_deposits')
    .insert({ date, amount, source, note: note?.trim() || null })
  if (error) throw error

  const next = Math.max(0, Number(currentAmount) + Number(amount))
  const { error: goalError } = await supabase
    .from('savings_goal')
    .update({ current_amount: next })
    .not('user_id', 'is', null)
  if (goalError) throw goalError

  return next
}

export async function deleteDeposit({ id, amount, currentAmount }) {
  const { error } = await supabase.from('savings_deposits').delete().eq('id', id)
  if (error) throw error

  const next = Math.max(0, Number(currentAmount) - Number(amount))
  const { error: goalError } = await supabase
    .from('savings_goal')
    .update({ current_amount: next })
    .not('user_id', 'is', null)
  if (goalError) throw goalError

  return next
}

/**
 * Podsumowanie: od kiedy odkladasz, ile dni, jak czesto, skad i w jakim tempie.
 */
export function depositStats(deposits, today = todayISO()) {
  const positive = deposits.filter((d) => Number(d.amount) > 0)
  if (positive.length === 0) return null

  const dates = positive.map((d) => d.date).sort()
  const firstDate = dates[0]
  const lastDate = dates[dates.length - 1]
  const days = daysBetweenISO(firstDate, today) + 1

  const total = positive.reduce((s, d) => s + Number(d.amount), 0)
  const withdrawn = deposits
    .filter((d) => Number(d.amount) < 0)
    .reduce((s, d) => s + Math.abs(Number(d.amount)), 0)

  // Ile roznych dni z wplata — "22 wplaty" przy 3 dniach znaczy co innego
  // niz przy 60, a sama liczba wierszy tego nie pokazuje.
  const distinctDays = new Set(dates).size

  const bySource = {}
  for (const d of positive) {
    bySource[d.source] = (bySource[d.source] ?? 0) + Number(d.amount)
  }

  return {
    firstDate,
    lastDate,
    days,
    daysSinceLast: daysBetweenISO(lastDate, today),
    count: positive.length,
    distinctDays,
    total,
    withdrawn,
    perDay: days > 0 ? total / days : 0,
    perMonth: days > 0 ? (total / days) * 30.44 : 0,
    bySource: Object.entries(bySource)
      .map(([source, amount]) => ({ source, amount, share: total > 0 ? amount / total : 0 }))
      .sort((a, b) => b.amount - a.amount),
  }
}

export function isMissingTable(err) {
  return /savings_deposits/.test(err?.message ?? '')
}

/**
 * Gdzie leza odlozone pieniadze — decyduje, czy wartosc netto ma je doliczyc
 * osobno, czy potraktowac jako etykiete na czesci gotowki (migracja 0022).
 */
export async function setHeldIn(heldIn) {
  const { error } = await supabase
    .from('savings_goal')
    .update({ held_in: heldIn })
    .not('user_id', 'is', null)
  if (error) throw error
}
