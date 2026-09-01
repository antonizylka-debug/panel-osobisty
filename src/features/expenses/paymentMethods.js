/** Metody platnosci — enum public.payment_method (migracja 0020). */
export const PAYMENT_METHODS = [
  { value: 'cash',     label: 'Gotówka' },
  { value: 'card',     label: 'Karta' },
  { value: 'transfer', label: 'Przelew' },
]

export const PAYMENT_LABEL = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label])
)
