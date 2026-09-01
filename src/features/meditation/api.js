import { supabase } from '../../lib/supabaseClient'
import { todayISO, addDaysISO, daysBetweenISO } from '../../lib/date'

/**
 * Medytacja — sesje z timerem (migracja 0023).
 */

/**
 * Techniki oddechu. Fazy w sekundach; `hold2` to zatrzymanie PO wydechu.
 * `null` przy fazie = faza nie wystepuje w tej technice.
 *
 * Zrodla: box breathing to standard 4-4-4-4; 4-7-8 wg Weila; oddech
 * koherentny to rowne 5-5 (~6 oddechow na minute).
 */
export const TECHNIQUES = [
  {
    value: 'cisza',
    label: 'Cisza',
    hint: 'Sam timer, bez prowadzenia',
    phases: null,
  },
  {
    value: 'box',
    label: 'Kwadrat 4-4-4-4',
    hint: 'Uspokaja i skupia — dobre przed trudnym zadaniem',
    phases: { in: 4, hold1: 4, out: 4, hold2: 4 },
  },
  {
    value: '478',
    label: 'Relaks 4-7-8',
    hint: 'Długi wydech wycisza — dobre przed snem',
    phases: { in: 4, hold1: 7, out: 8, hold2: 0 },
  },
  {
    value: 'coherent',
    label: 'Spokojny 5-5',
    hint: 'Równy rytm, ~6 oddechów na minutę',
    phases: { in: 5, hold1: 0, out: 5, hold2: 0 },
  },
]

export const TECHNIQUE_LABEL = Object.fromEntries(TECHNIQUES.map((t) => [t.value, t.label]))

export const DURATIONS = [3, 5, 10, 15, 20, 30]

export async function fetchSessions(limit = 200) {
  const { data, error } = await supabase
    .from('meditation_sessions')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function saveSession(payload) {
  const { data, error } = await supabase
    .from('meditation_sessions')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSession(id) {
  const { error } = await supabase.from('meditation_sessions').delete().eq('id', id)
  if (error) throw error
}

/**
 * Seria dni pod rzad z przynajmniej jedna sesja.
 *
 * Liczy sie od dzisiaj albo od wczoraj — dzien jeszcze trwa, wiec brak sesji
 * dzisiaj nie moze zerowac serii zbudowanej przez tydzien. Zeruje sie dopiero
 * gdy minal caly dzien bez sesji.
 */
export function streak(sessions, today = todayISO()) {
  if (sessions.length === 0) return 0
  const days = new Set(sessions.map((s) => s.date))

  let cursor = days.has(today) ? today : addDaysISO(today, -1)
  if (!days.has(cursor)) return 0

  let n = 0
  while (days.has(cursor)) {
    n++
    cursor = addDaysISO(cursor, -1)
  }
  return n
}

export function stats(sessions, today = todayISO()) {
  const totalSeconds = sessions.reduce((s, x) => s + Number(x.duration_seconds), 0)
  const thisWeek = sessions.filter((s) => daysBetweenISO(s.date, today) < 7)
  const withMood = sessions.filter((s) => s.mood_before != null && s.mood_after != null)

  return {
    count: sessions.length,
    totalSeconds,
    avgSeconds: sessions.length ? totalSeconds / sessions.length : 0,
    weekCount: thisWeek.length,
    weekSeconds: thisWeek.reduce((s, x) => s + Number(x.duration_seconds), 0),
    streak: streak(sessions, today),
    // Srednia poprawa nastroju — jedyna miara, ktora mowi cos o skutku,
    // a nie tylko o wysiedzianym czasie.
    moodGain: withMood.length
      ? withMood.reduce((s, x) => s + (x.mood_after - x.mood_before), 0) / withMood.length
      : null,
    moodCount: withMood.length,
  }
}

/** 754 -> "12 min 34 s"; 45 -> "45 s" */
export function formatDuration(seconds) {
  const s = Math.round(Number(seconds) || 0)
  const m = Math.floor(s / 60)
  const rest = s % 60
  if (m === 0) return `${rest} s`
  if (rest === 0) return `${m} min`
  return `${m} min ${rest} s`
}

/** Laczny czas w czytelnej formie — godziny, gdy uzbiera sie ich dosc. */
export function formatTotal(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h === 0) return `${m} min`
  return `${h} h ${m} min`
}

export function isMissingTable(err) {
  return /meditation_sessions/.test(err?.message ?? '')
}
