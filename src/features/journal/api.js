import { supabase } from '../../lib/supabaseClient'

export const TYPE_LABEL = {
  thought: 'Myśl',
  goal: 'Cel',
  past_link: 'Łączy mnie z przeszłością',
}

export const STATUS_LABEL = {
  in_progress: 'W trakcie',
  achieved: 'Osiągnięty',
  abandoned: 'Porzucony',
}

export const BUSINESS_TAG = 'Pomysł na biznes'

export async function fetchEntries() {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createEntry(payload) {
  const { data, error } = await supabase.from('journal_entries').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateEntry(id, patch) {
  const { data, error } = await supabase.from('journal_entries').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteEntry(id) {
  const { error } = await supabase.from('journal_entries').delete().eq('id', id)
  if (error) throw error
}

/**
 * Losuje pytanie, ktore nie bylo uzyte w ciagu ostatnich 30 dni.
 * Jesli wszystkie byly — bierze najdawniej uzyte.
 */
export async function drawReflectionPrompt() {
  const cutoff = new Date(Date.now() - 30 * 864e5).toISOString()

  let { data, error } = await supabase
    .from('reflection_prompts')
    .select('*')
    .eq('active', true)
    .or(`last_used_at.is.null,last_used_at.lt.${cutoff}`)
  if (error) throw error

  if (!data?.length) {
    const fallback = await supabase
      .from('reflection_prompts')
      .select('*')
      .eq('active', true)
      .order('last_used_at', { ascending: true, nullsFirst: true })
      .limit(1)
    if (fallback.error) throw fallback.error
    data = fallback.data
  }

  if (!data?.length) return null

  const picked = data[Math.floor(Math.random() * data.length)]
  await supabase
    .from('reflection_prompts')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', picked.id)

  return picked
}
