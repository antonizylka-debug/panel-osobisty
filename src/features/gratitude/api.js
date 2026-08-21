import { supabase } from '../../lib/supabaseClient'

export async function fetchEntry(date) {
  const { data, error } = await supabase
    .from('gratitude_entries')
    .select('*')
    .eq('date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

// Lekki zestaw (data + nastroj) do streaka i wykresu — bez ciagania tresci wpisow.
export async function fetchMoodHistory(sinceDate) {
  const { data, error } = await supabase
    .from('gratitude_entries')
    .select('date, mood')
    .gte('date', sinceDate)
    .order('date', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchEntriesPage({ offset, limit }) {
  const { data, error } = await supabase
    .from('gratitude_entries')
    .select('*')
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return data
}

export async function saveTodayEntry({ date, items, reflection, mood }) {
  const { data, error } = await supabase
    .from('gratitude_entries')
    .upsert(
      { date, items, reflection: reflection || null, mood },
      { onConflict: 'user_id,date' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setFavorite(id, isFavorite) {
  const { error } = await supabase
    .from('gratitude_entries')
    .update({ is_favorite: isFavorite })
    .eq('id', id)
  if (error) throw error
}
