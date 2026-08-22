import { supabase } from '../../lib/supabaseClient'

export async function fetchBlocks(date) {
  const { data, error } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('date', date)
    .order('start_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchBlocksRange(from, to) {
  const { data, error } = await supabase
    .from('time_blocks')
    .select('date, category, hours')
    .gte('date', from)
    .lte('date', to)
  if (error) throw error
  return data
}

/** Kategorie, ktorych uzytkownik juz uzywal — do podpowiedzi w formularzu. */
export async function fetchCategories() {
  const { data, error } = await supabase
    .from('time_blocks')
    .select('category')
    .order('category', { ascending: true })
  if (error) throw error
  return [...new Set((data ?? []).map((r) => r.category))]
}

export async function createBlock({ date, category, label, startTime, endTime, hours }) {
  const { data, error } = await supabase
    .from('time_blocks')
    .insert({
      date,
      category,
      label,
      start_time: startTime || null,
      end_time: endTime || null,
      hours: hours ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteBlock(id) {
  const { error } = await supabase.from('time_blocks').delete().eq('id', id)
  if (error) throw error
}

/** Suma godzin per kategoria z listy blokow. */
export function sumByCategory(blocks) {
  const out = {}
  for (const b of blocks) {
    out[b.category] = (out[b.category] ?? 0) + Number(b.hours ?? 0)
  }
  return out
}
