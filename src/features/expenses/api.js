import { supabase } from '../../lib/supabaseClient'

export const CATEGORIES = [
  'Jedzenie', 'Paliwo', 'Dom', 'Rachunki', 'Zdrowie',
  'Ubrania', 'Rozrywka', 'Narzędzia', 'Transport', 'Inne',
]

export async function fetchExpenses({ from, to }) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchSubscriptions() {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('type', 'subscription')
    .order('amount', { ascending: false })
  if (error) throw error
  return data
}

export async function createExpense(payload) {
  const { data, error } = await supabase.from('expenses').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function createExpensesBulk(rows) {
  const { data, error } = await supabase.from('expenses').insert(rows).select()
  if (error) throw error
  return data
}

/** Dodatkowa kasa poza dniowka — napiwek, znalezione, sprzedane, prezent itd. */
export async function fetchExtraIncome({ from, to }) {
  const { data, error } = await supabase
    .from('extra_income')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addExtraIncome({ date, amount, note }) {
  const { error } = await supabase
    .from('extra_income')
    .insert({ date, amount, note: note?.trim() || null })
  if (error) throw error
}

export async function deleteExtraIncome(id) {
  const { error } = await supabase.from('extra_income').delete().eq('id', id)
  if (error) throw error
}

export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

export async function fetchBudgets(month) {
  const { data, error } = await supabase.from('budgets').select('*').eq('month', month)
  if (error) throw error
  return data
}

export async function saveBudget({ month, limitAmount, category }) {
  const { error } = await supabase
    .from('budgets')
    .upsert(
      { month, limit_amount: limitAmount, category: category || null },
      { onConflict: category ? 'user_id,month,category' : 'user_id,month' }
    )
  if (error) throw error
}

export async function deleteBudget(id) {
  const { error } = await supabase.from('budgets').delete().eq('id', id)
  if (error) throw error
}

/** Kompresja zdjecia paragonu do ~200 KB przed wyslaniem do Storage. */
export async function compressImage(file, maxBytes = 200 * 1024) {
  const bitmap = await createImageBitmap(file)
  const maxDim = 1400
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)

  for (const quality of [0.8, 0.65, 0.5, 0.38, 0.28]) {
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
    if (blob && blob.size <= maxBytes) return blob
  }
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.25))
}

export async function uploadReceipt(userId, file) {
  const blob = await compressImage(file)
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('receipts').upload(path, blob, {
    contentType: 'image/jpeg',
  })
  if (error) throw error
  return path
}

export async function receiptUrl(path) {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}
