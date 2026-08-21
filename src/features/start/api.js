import { supabase } from '../../lib/supabaseClient'

export async function fetchMainGoal() {
  const { data, error } = await supabase.from('main_goal').select('*').maybeSingle()
  if (error) throw error
  return data
}

export async function fetchSavingsGoal() {
  const { data, error } = await supabase.from('savings_goal').select('*').maybeSingle()
  if (error) throw error
  return data
}

export async function saveSavingsGoal({ title, targetAmount, currentAmount }) {
  const { error } = await supabase
    .from('savings_goal')
    .upsert(
      { title, target_amount: targetAmount, current_amount: currentAmount },
      { onConflict: 'user_id' }
    )
  if (error) throw error
}

export async function saveMainGoal({ title, description, progressCurrent, progressTarget }) {
  const { error } = await supabase
    .from('main_goal')
    .upsert(
      {
        title,
        description: description || null,
        progress_current: progressCurrent ?? 0,
        progress_target: progressTarget ?? null,
      },
      { onConflict: 'user_id' }
    )
  if (error) throw error
}

/** Cytat dnia — ten sam przez caly dzien, wybierany deterministycznie z daty. */
export function quoteOfTheDay(quotes, isoDay) {
  if (!quotes?.length) return null
  let hash = 0
  for (const ch of isoDay) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return quotes[hash % quotes.length]
}

/** Wpis wdziecznosci sprzed roku, jesli istnieje. */
export async function fetchYearAgo(isoDay) {
  const [y, m, d] = isoDay.split('-')
  const lastYear = `${Number(y) - 1}-${m}-${d}`
  const { data, error } = await supabase
    .from('gratitude_entries')
    .select('*')
    .eq('date', lastYear)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchLatestBusinessIdea() {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, title, content, next_step, created_at')
    .eq('tag', 'Pomysł na biznes')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}
