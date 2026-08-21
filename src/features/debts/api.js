import { supabase } from '../../lib/supabaseClient'

export async function fetchDebts() {
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .order('active', { ascending: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchPayments() {
  const { data, error } = await supabase.from('debt_payments').select('*')
  if (error) throw error
  return data
}

export async function createDebt(payload) {
  const { data, error } = await supabase.from('debts').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateDebt(id, patch) {
  const { error } = await supabase.from('debts').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteDebt(id) {
  const { error } = await supabase.from('debts').delete().eq('id', id)
  if (error) throw error
}

export async function togglePayment({ debtId, month, paid, paidDate }) {
  const { error } = await supabase
    .from('debt_payments')
    .upsert(
      { debt_id: debtId, month, paid, paid_date: paid ? paidDate : null },
      { onConflict: 'debt_id,month' }
    )
  if (error) throw error
}

/** Ile rat juz zaplacono i ile zostalo — do paska postepu splaty. */
export function debtProgress(debt, payments) {
  const paidCount = payments.filter((p) => p.debt_id === debt.id && p.paid).length
  const paidAmount = paidCount * Number(debt.monthly_payment)
  const total = Number(debt.total_amount)
  return {
    paidCount,
    paidAmount: Math.min(paidAmount, total),
    remaining: Math.max(0, total - paidAmount),
    total,
  }
}

/** Ostrzezenie o zblizajacej sie racie — 3 dni wczesniej. */
export function upcomingPayments(debts, payments, today, withinDays = 3) {
  const [y, m, d] = today.split('-').map(Number)
  const monthKey = `${y}-${String(m).padStart(2, '0')}-01`
  const out = []

  for (const debt of debts) {
    if (!debt.active) continue
    const already = payments.find((p) => p.debt_id === debt.id && p.month === monthKey && p.paid)
    if (already) continue

    const diff = debt.payment_day - d
    if (diff >= 0 && diff <= withinDays) {
      out.push({ debt, daysLeft: diff, month: monthKey })
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft)
}
