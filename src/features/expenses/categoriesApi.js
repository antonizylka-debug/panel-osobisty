import { supabase } from '../../lib/supabaseClient'

/**
 * Kategorie wydatkow — dane konta, nie stala w kodzie (migracja 0018).
 * DEFAULT_CATEGORIES zostaje jako awaryjna lista: gdy migracja nie jest
 * jeszcze uruchomiona, formularz wydatku ma z czego wybierac.
 */
export const DEFAULT_CATEGORIES = [
  'Jedzenie', 'Paliwo', 'Dom', 'Rachunki', 'Zdrowie',
  'Ubrania', 'Rozrywka', 'Narzędzia', 'Transport', 'Inne',
]

export async function fetchCategories({ includeInactive = false } = {}) {
  let q = supabase
    .from('expense_categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (!includeInactive) q = q.eq('active', true)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function createCategory(name) {
  const { data, error } = await supabase
    .from('expense_categories')
    .insert({ name: name.trim(), sort_order: 99 })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameCategory(id, name) {
  const { error } = await supabase
    .from('expense_categories')
    .update({ name: name.trim() })
    .eq('id', id)
  if (error) throw error
}

/**
 * Wylaczenie, nie skasowanie: historyczne wydatki trzymaja nazwe kategorii
 * jako tekst, wiec maja sie dalej wyswietlac — tylko przestaje byc
 * proponowana przy nowych wpisach.
 */
export async function deactivateCategory(id) {
  const { error } = await supabase
    .from('expense_categories')
    .update({ active: false })
    .eq('id', id)
  if (error) throw error
}

export async function reactivateCategory(id) {
  const { error } = await supabase
    .from('expense_categories')
    .update({ active: true })
    .eq('id', id)
  if (error) throw error
}

export function isMissingTable(err) {
  return /expense_categories/.test(err?.message ?? '')
}
