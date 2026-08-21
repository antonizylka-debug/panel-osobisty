import { supabase } from '../../lib/supabaseClient'

export const EMOTIONS = [
  { value: 'fear', label: 'Strach', advice: 'Zrób najgorszą możliwą wersję. Poprawisz później.' },
  { value: 'boredom', label: 'Nuda', advice: 'Ustaw 15 minut i połącz to z czymś przyjemnym.' },
  { value: 'overwhelm', label: 'Przytłoczenie', advice: 'Nie rób całości. Zrób tylko pierwszy ruch.' },
  { value: 'reluctance', label: 'Niechęć', advice: 'Komu to naprawdę służy? Jeśli tobie — zaczynaj.' },
  { value: 'no_start', label: 'Nie wiem od czego zacząć', advice: 'Napisz pierwszy krok tak mały, że zajmie 2 minuty.' },
]

export const EMOTION_LABEL = Object.fromEntries(EMOTIONS.map((e) => [e.value, e.label]))

export async function fetchSessions() {
  const { data, error } = await supabase
    .from('procrastination_sessions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createSession(payload) {
  const { data, error } = await supabase
    .from('procrastination_sessions')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSession(id, patch) {
  const { data, error } = await supabase
    .from('procrastination_sessions')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
