import { supabase } from '../../lib/supabaseClient'

/**
 * Przychody = dniowki (work_days.pay_amount) + dodatkowa kasa (extra_income).
 *
 * Obie tabele maja kolumne `date`, wiec ten sam zakres filtruje jedno i drugie.
 * Zwracamy oba zbiory osobno; laczenie w jedna liste zdarzen robi ekran, bo
 * tylko on wie, czy potrzebuje rozbicia wg zrodla, czy sumy dziennej.
 */
export async function fetchIncomeRange(from, to) {
  const [days, extra] = await Promise.all([
    supabase
      .from('work_days')
      .select('id, date, pay_amount, pay_status, pay_date, hours_worked, day_type')
      .gte('date', from)
      .lte('date', to)
      .not('pay_amount', 'is', null)
      .order('date', { ascending: false }),
    supabase
      .from('extra_income')
      .select('id, date, amount, note')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false }),
  ])

  if (days.error) throw days.error
  if (extra.error) throw extra.error

  return { workDays: days.data ?? [], extraIncome: extra.data ?? [] }
}

/** Suma dniowek + dodatkowej kasy w podanych zbiorach. */
export function totalIncome({ workDays, extraIncome }) {
  const fromWork = workDays.reduce((s, d) => s + Number(d.pay_amount ?? 0), 0)
  const fromExtra = extraIncome.reduce((s, e) => s + Number(e.amount), 0)
  return { fromWork, fromExtra, total: fromWork + fromExtra }
}

/**
 * Jedna lista wszystkich wplywow, posortowana od najnowszego.
 * `source` rozroznia dniowke od dodatkowej kasy przy renderowaniu tabeli.
 */
export function incomeEvents({ workDays, extraIncome }) {
  const fromWork = workDays.map((d) => ({
    id: `w-${d.id}`,
    date: d.date,
    amount: Number(d.pay_amount),
    source: 'work',
    label: 'Dniówka',
    hours: d.hours_worked != null ? Number(d.hours_worked) : null,
    settled: d.pay_status === 'paid',
  }))

  const fromExtra = extraIncome.map((e) => ({
    id: `e-${e.id}`,
    date: e.date,
    amount: Number(e.amount),
    source: 'extra',
    label: e.note || 'Dodatkowa kasa',
    hours: null,
    settled: true,
  }))

  return [...fromWork, ...fromExtra].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/** Sumy miesiac po miesiacu — do wykresu i tabeli "miesiac po miesiacu". */
export function monthlyTotals(events) {
  const map = new Map()
  for (const ev of events) {
    const key = ev.date.slice(0, 7)
    const cur = map.get(key) ?? { month: key, work: 0, extra: 0, total: 0 }
    cur[ev.source === 'work' ? 'work' : 'extra'] += ev.amount
    cur.total += ev.amount
    map.set(key, cur)
  }
  return [...map.values()].sort((a, b) => (a.month < b.month ? 1 : -1))
}

const monthFormatter = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' })

export function formatMonth(key) {
  const [y, m] = key.split('-').map(Number)
  return monthFormatter.format(new Date(y, m - 1, 1))
}
