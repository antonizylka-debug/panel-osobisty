import { supabase } from '../../lib/supabaseClient'

/** Rzeczy, na ktore zbierasz. Migracja 0026. */

export const WISH_STATUSES = [
  { value: 'chce',       label: 'Chcę' },
  { value: 'kupione',    label: 'Kupione' },
  { value: 'odpuszczam', label: 'Odpuszczam' },
]

export const WISH_STATUS_LABEL = Object.fromEntries(WISH_STATUSES.map((s) => [s.value, s.label]))

export const PRIORITIES = [
  { value: 1, label: 'Muszę' },
  { value: 2, label: 'Chcę' },
  { value: 3, label: 'Kiedyś' },
]

export const PRIORITY_LABEL = Object.fromEntries(PRIORITIES.map((p) => [p.value, p.label]))

export async function fetchWishes() {
  const { data, error } = await supabase
    .from('wishlist')
    .select('*')
    .order('status', { ascending: true })
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createWish(payload) {
  const { data, error } = await supabase.from('wishlist').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateWish(id, patch) {
  const { error } = await supabase.from('wishlist').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteWish(id) {
  const { error } = await supabase.from('wishlist').delete().eq('id', id)
  if (error) throw error
}

/**
 * Ile ta rzecz kosztuje w godzinach Twojej pracy i za ile bedzie Cie na nia
 * stac przy obecnym tempie odkladania.
 *
 * `monthlyRate` to realne tempo (bilans miesiaca), a nie deklaracja — jesli
 * jest zerowe albo ujemne, nie zgadujemy terminu, tylko mowimy wprost, ze
 * przy tym tempie nie uzbiera sie nigdy.
 */
export function affordability({ price, hourlyRate, monthlyRate, alreadySaved = 0 }) {
  const hours = hourlyRate > 0 ? Number(price) / hourlyRate : null
  const missing = Math.max(0, Number(price) - Number(alreadySaved))

  let months = null
  if (missing <= 0) months = 0
  else if (monthlyRate > 0) months = missing / monthlyRate

  return {
    hours,
    missing,
    months,
    // Tydzien to wygodniejsza jednostka przy tanszych rzeczach.
    weeks: months != null ? months * 4.345 : null,
    neverAtThisRate: missing > 0 && !(monthlyRate > 0),
  }
}

/** Ile pieniedzy zaoszczedzila sama lista — pozycje swiadomie odpuszczone. */
export function savedByDeciding(wishes) {
  return wishes
    .filter((w) => w.status === 'odpuszczam')
    .reduce((s, w) => s + Number(w.price), 0)
}

export function isMissingTable(err) {
  return /wishlist/.test(err?.message ?? '')
}
