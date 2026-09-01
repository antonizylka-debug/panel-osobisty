import { supabase } from '../../lib/supabaseClient'
import { todayISO } from '../../lib/date'

/**
 * Wartosc netto — jedna liczba z rozproszonych po apce skladnikow.
 *
 * AKTYWA
 *   + gotowka w domu (ostatni spis minus wydatki gotowkowe od tego spisu)
 *   + odlozone na cel oszczednosciowy
 *   + dniowki nierozliczone (praca wykonana, pieniadze jeszcze nie wyplacone)
 * PASYWA
 *   − ile zostalo do splaty zobowiazan
 *
 * Swiadomie NIE liczymy salda konta bankowego — apka nie zna stanu konta,
 * wiec dopisanie go z powietrza dawaloby liczbe, ktora wyglada dokladnie,
 * a nie jest. Lepiej pokazac wezsza, ale prawdziwa wartosc.
 */
export async function fetchNetWorth() {
  const today = todayISO()

  const [cash, cashExpenses, savings, pending, debts, payments] = await Promise.all([
    supabase.from('cash_on_hand').select('date, amount, created_at')
      .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(1),
    // Wydatki gotowkowe pobieramy dopiero po ustaleniu daty spisu (nizej),
    // ale zeby zmiescic sie w jednym przelocie bierzemy szerzej i tniemy w JS.
    supabase.from('expenses').select('date, amount, created_at').eq('payment_method', 'cash'),
    supabase.from('savings_goal').select('current_amount').maybeSingle(),
    supabase.from('work_days').select('pay_amount').eq('pay_status', 'pending').not('pay_amount', 'is', null),
    supabase.from('debts').select('id, total_amount, monthly_payment, active').eq('active', true),
    supabase.from('debt_payments').select('debt_id, paid'),
  ])

  // Kazdy skladnik moze nie istniec (migracja nieuruchomiona) — wtedy liczy
  // sie jako zero, a nie wywala calego pulpitu.
  const missing = []

  let cashOnHand = 0
  let lastCount = null
  if (cash.error) {
    if (/cash_on_hand/.test(cash.error.message)) missing.push('gotówka')
    else throw cash.error
  } else if (cash.data?.length) {
    lastCount = cash.data[0]
    cashOnHand = Number(lastCount.amount)
  }

  // Gotowka wydana od ostatniego spisu — patrz komentarz w 0020.
  // Granica jak w features/cash/api.js: punkt w czasie, nie caly dzien.
  let spentSinceCount = 0
  if (!cashExpenses.error && lastCount) {
    spentSinceCount = (cashExpenses.data ?? [])
      .filter((e) => e.date <= today && (
        e.date > lastCount.date ||
        (e.date === lastCount.date && e.created_at > lastCount.created_at)
      ))
      .reduce((s, e) => s + Number(e.amount), 0)
  }
  const effectiveCash = Math.max(0, cashOnHand - spentSinceCount)
  const cashCountedAt = lastCount?.date ?? null

  const saved = savings.error ? 0 : Number(savings.data?.current_amount ?? 0)
  const owedToYou = pending.error
    ? 0
    : (pending.data ?? []).reduce((s, d) => s + Number(d.pay_amount ?? 0), 0)

  let debtLeft = 0
  if (!debts.error) {
    const paidByDebt = new Map()
    for (const p of payments.data ?? []) {
      if (p.paid) paidByDebt.set(p.debt_id, (paidByDebt.get(p.debt_id) ?? 0) + 1)
    }
    for (const d of debts.data ?? []) {
      const paidCount = paidByDebt.get(d.id) ?? 0
      const paidAmount = paidCount * Number(d.monthly_payment)
      debtLeft += Math.max(0, Number(d.total_amount) - paidAmount)
    }
  }

  const assets = effectiveCash + saved + owedToYou

  return {
    assets,
    liabilities: debtLeft,
    netWorth: assets - debtLeft,
    parts: { cash: effectiveCash, saved, owedToYou, debtLeft },
    cashCountedAt,
    spentSinceCount,
    missing,
  }
}
