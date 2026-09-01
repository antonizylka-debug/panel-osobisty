import { supabase } from '../../lib/supabaseClient'
import { todayISO, daysBetweenISO, addDaysISO } from '../../lib/date'

/** "Bez czegos" — licznik dni od ostatniej wpadki. Migracja 0025. */

export async function fetchTrackers() {
  const { data, error } = await supabase
    .from('quit_trackers')
    .select('*')
    .order('active', { ascending: false })
    .order('started_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchSlips() {
  const { data, error } = await supabase
    .from('quit_slips')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createTracker(payload) {
  const { data, error } = await supabase.from('quit_trackers').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateTracker(id, patch) {
  const { error } = await supabase.from('quit_trackers').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTracker(id) {
  const { error } = await supabase.from('quit_trackers').delete().eq('id', id)
  if (error) throw error
}

export async function addSlip({ trackerId, date, note }) {
  const { error } = await supabase
    .from('quit_slips')
    .insert({ tracker_id: trackerId, date, note: note?.trim() || null })
  if (error) throw error
}

export async function deleteSlip(id) {
  const { error } = await supabase.from('quit_slips').delete().eq('id', id)
  if (error) throw error
}

/**
 * Statystyki jednego licznika.
 *
 * `current` liczy sie od dnia PO ostatniej wpadce (dzien wpadki nie jest
 * dniem czystym). Bez wpadek — od daty startu.
 *
 * `best` to najdluzsza przerwa w historii, wliczajac biezaca. To wlasnie ona
 * jest miara postepu: kolejne podejscia moga byc dluzsze, nawet gdy licznik
 * co jakis czas wraca do zera.
 */
export function trackerStats(tracker, slips, today = todayISO()) {
  const mine = slips
    .filter((s) => s.tracker_id === tracker.id)
    .map((s) => s.date)
    .sort()

  const lastSlip = mine.length ? mine[mine.length - 1] : null
  const since = lastSlip ? addDaysISO(lastSlip, 1) : tracker.started_at
  const current = Math.max(0, daysBetweenISO(since, today) + 1)

  // Dlugosci wszystkich przerw: start -> 1. wpadka, miedzy wpadkami, ostatnia -> dzis
  const gaps = []
  let cursor = tracker.started_at
  for (const slip of mine) {
    gaps.push(Math.max(0, daysBetweenISO(cursor, slip)))
    cursor = addDaysISO(slip, 1)
  }
  gaps.push(current)

  return {
    current,
    best: Math.max(...gaps, 0),
    slipCount: mine.length,
    lastSlip,
    since,
    totalDays: daysBetweenISO(tracker.started_at, today) + 1,
  }
}

export function isMissingTable(err) {
  return /quit_trackers|quit_slips/.test(err?.message ?? '')
}
