import { supabase } from '../../lib/supabaseClient'

export async function fetchDay(date) {
  const { data, error } = await supabase.from('work_days').select('*').eq('date', date).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchRange(fromDate, toDate) {
  const { data, error } = await supabase
    .from('work_days')
    .select('*')
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchPending() {
  const { data, error } = await supabase
    .from('work_days')
    .select('*')
    .eq('pay_status', 'pending')
    .not('pay_amount', 'is', null)
    .order('date', { ascending: true })
  if (error) throw error
  return data
}

export async function saveDay(payload) {
  const { data, error } = await supabase
    .from('work_days')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Rozliczenie zbiorcze: kilka dni jedna wyplata. */
export async function settlePayment({ dates, totalAmount, payDate }) {
  const perDay = Number((totalAmount / dates.length).toFixed(2))
  const { error } = await supabase
    .from('work_days')
    .update({
      pay_status: 'paid',
      pay_date: payDate,
      pay_amount: perDay,
      paid_for_dates: dates,
    })
    .in('date', dates)
  if (error) throw error
}

/**
 * Realna stawka godzinowa: dniowka / czas od wyjazdu z domu do powrotu.
 * Srednia z ostatnich 30 dni — zasila przelicznik "to = X godzin pracy" w Wydatkach.
 */
export async function fetchRealHourlyRate(sinceDate) {
  const { data, error } = await supabase
    .from('work_days')
    .select('pay_amount, left_home_time, return_time, hours_worked')
    .gte('date', sinceDate)
    .not('pay_amount', 'is', null)
  if (error) throw error

  let pay = 0
  let hours = 0
  for (const d of data) {
    const span = doorToDoorHours(d.left_home_time, d.return_time) ?? Number(d.hours_worked ?? 0)
    if (span > 0 && d.pay_amount != null) {
      pay += Number(d.pay_amount)
      hours += span
    }
  }
  return hours > 0 ? pay / hours : null
}

export function doorToDoorHours(leftHome, returned) {
  if (!leftHome || !returned) return null
  return diffHours(leftHome, returned)
}

export function diffHours(from, to) {
  if (!from || !to) return null
  const [fh, fm] = from.split(':').map(Number)
  const [th, tm] = to.split(':').map(Number)
  let mins = th * 60 + tm - (fh * 60 + fm)
  if (mins < 0) mins += 24 * 60 // przekroczenie polnocy
  return Math.round((mins / 60) * 100) / 100
}
