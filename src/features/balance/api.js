import { supabase } from '../../lib/supabaseClient'
import { resolvePeriod } from '../../lib/period'

/**
 * Bilans w kilku okresach naraz — dzis, tydzien, miesiac, rok i od zawsze.
 *
 * Pobieramy CALA historie raz i tniemy ja w JS na okresy, zamiast robic
 * osobne zapytanie na kazdy okres. Piec zapytan po to samo bylo by wolniejsze,
 * a przy skali osobistego panelu (tysiace wierszy, nie miliony) roznica w
 * przesylanych danych jest bez znaczenia. Bierzemy tez tylko te kolumny,
 * ktore sa potrzebne do sumowania.
 */
export async function fetchBalanceData() {
  const [days, extra, expenses, payments, debts] = await Promise.all([
    supabase.from('work_days').select('date, pay_amount').not('pay_amount', 'is', null),
    supabase.from('extra_income').select('date, amount'),
    supabase.from('expenses').select('date, amount'),
    supabase.from('debt_payments').select('debt_id, month, paid').eq('paid', true),
    supabase.from('debts').select('id, monthly_payment'),
  ])

  // Brak tabeli (np. extra_income sprzed migracji 0016) nie moze wywalic karty.
  const safe = (res) => (res.error ? [] : (res.data ?? []))

  if (days.error) throw days.error
  if (expenses.error) throw expenses.error

  return {
    days: safe(days),
    extra: safe(extra),
    expenses: safe(expenses),
    payments: safe(payments),
    debts: safe(debts),
  }
}

export const BALANCE_PERIODS = [
  { preset: 'today', label: 'Dziś' },
  { preset: 'week',  label: 'Ten tydzień' },
  { preset: 'month', label: 'Ten miesiąc' },
  { preset: 'year',  label: 'Ten rok' },
  { preset: 'all',   label: 'Od zawsze' },
]

function inRange(date, from, to) {
  return date >= from && date <= to
}

/**
 * Liczy bilans dla jednego zakresu.
 *
 * Raty bierzemy z FAKTYCZNIE odhaczonych splat (debt_payments.paid), a nie z
 * mnozenia raty przez liczbe miesiecy — inaczej "od zawsze" pokazywaloby
 * zobowiazania, ktorych jeszcze nie zaplaciles. Rata nalezy do miesiaca,
 * ktorego dotyczy, wiec w krotkich okresach (dzien, tydzien) zwykle wyjdzie
 * zero — i tak ma byc.
 */
export function balanceFor({ days, extra, expenses, payments, debts }, range) {
  const { from, to } = range

  const fromWork = days
    .filter((d) => inRange(d.date, from, to))
    .reduce((s, d) => s + Number(d.pay_amount ?? 0), 0)

  const fromExtra = extra
    .filter((e) => inRange(e.date, from, to))
    .reduce((s, e) => s + Number(e.amount), 0)

  const spent = expenses
    .filter((e) => inRange(e.date, from, to))
    .reduce((s, e) => s + Number(e.amount), 0)

  const rateById = new Map(debts.map((d) => [d.id, Number(d.monthly_payment)]))
  const installments = payments
    .filter((p) => inRange(p.month, from, to))
    .reduce((s, p) => s + (rateById.get(p.debt_id) ?? 0), 0)

  const earned = fromWork + fromExtra

  return {
    earned,
    fromWork,
    fromExtra,
    spent,
    installments,
    balance: earned - spent - installments,
  }
}

/** Bilans dla wszystkich okresow naraz. */
export function allBalances(data, today) {
  return BALANCE_PERIODS.map((p) => ({
    ...p,
    range: resolvePeriod({ preset: p.preset }, today),
    ...balanceFor(data, resolvePeriod({ preset: p.preset }, today)),
  }))
}
