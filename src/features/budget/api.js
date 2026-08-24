import { supabase } from '../../lib/supabaseClient'

/** Gotowe podzialy do wyboru jednym klikiem. */
export const PRESETS = [
  {
    key: '50/30/20',
    label: '50 / 30 / 20',
    hint: 'Klasyka. Połowa na życie, jedna trzecia na przyjemności, reszta odłożona.',
    buckets: [
      { name: 'Potrzeby', percent: 50, is_savings: false },
      { name: 'Zachcianki', percent: 30, is_savings: false },
      { name: 'Oszczędności', percent: 20, is_savings: true },
    ],
  },
  {
    key: '60/20/20',
    label: '60 / 20 / 20',
    hint: 'Gdy stałe koszty są wysokie — więcej na potrzeby, mniej na zachcianki.',
    buckets: [
      { name: 'Potrzeby', percent: 60, is_savings: false },
      { name: 'Zachcianki', percent: 20, is_savings: false },
      { name: 'Oszczędności', percent: 20, is_savings: true },
    ],
  },
  {
    key: '50/20/30',
    label: '50 / 20 / 30',
    hint: 'Pod odkładanie. Zachcianki schodzą na trzeci plan.',
    buckets: [
      { name: 'Potrzeby', percent: 50, is_savings: false },
      { name: 'Zachcianki', percent: 20, is_savings: false },
      { name: 'Oszczędności', percent: 30, is_savings: true },
    ],
  },
  {
    key: '70/10/20',
    label: '70 / 10 / 20',
    hint: 'Na start, gdy dochód jest niski i prawie wszystko idzie na życie.',
    buckets: [
      { name: 'Potrzeby', percent: 70, is_savings: false },
      { name: 'Zachcianki', percent: 10, is_savings: false },
      { name: 'Oszczędności', percent: 20, is_savings: true },
    ],
  },
]

export async function fetchBuckets() {
  const { data, error } = await supabase
    .from('budget_buckets')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchCategoryMap() {
  const { data, error } = await supabase.from('budget_category_map').select('*')
  if (error) throw error
  return data
}

export async function saveBuckets(buckets) {
  // Podzial zawsze zapisujemy w calosci — inaczej latwo zostawic sume != 100.
  const { error: delError } = await supabase
    .from('budget_buckets')
    .delete()
    .not('id', 'is', null)
  if (delError) throw delError

  const { data, error } = await supabase
    .from('budget_buckets')
    .insert(buckets.map((b, i) => ({
      name: b.name.trim(),
      percent: b.percent,
      is_savings: !!b.is_savings,
      sort_order: i + 1,
    })))
    .select()
  if (error) throw error
  return data
}

export async function assignCategory(category, bucketId) {
  if (!bucketId) {
    const { error } = await supabase
      .from('budget_category_map')
      .delete()
      .eq('category', category)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('budget_category_map')
    .upsert({ category, bucket_id: bucketId }, { onConflict: 'user_id,category' })
  if (error) throw error
}

/**
 * Ile z przychodu przypada na koperte i ile juz z niej zeszlo.
 *
 * Oszczednosci liczymy inaczej niz reszte: nie wydajesz "z" nich, tylko
 * zostaja z tego, czego nie wydales. Dlatego dla koperty oszczednosciowej
 * pokazujemy realnie odlozone, a nie sume wydatkow.
 */
export function bucketSummary({ buckets, categoryMap, expenses, income }) {
  const byBucket = new Map(buckets.map((b) => [b.id, 0]))
  const catToBucket = new Map(categoryMap.map((m) => [m.category, m.bucket_id]))

  let unassigned = 0
  let spentTotal = 0

  for (const e of expenses) {
    const amount = Number(e.amount)
    spentTotal += amount

    const bucketId = catToBucket.get(e.category ?? '')
    if (bucketId && byBucket.has(bucketId)) {
      byBucket.set(bucketId, byBucket.get(bucketId) + amount)
    } else {
      unassigned += amount
    }
  }

  const rows = buckets.map((b) => {
    const planned = (income * Number(b.percent)) / 100
    const spent = b.is_savings ? Math.max(0, income - spentTotal) : byBucket.get(b.id) ?? 0

    return {
      ...b,
      planned,
      spent,
      left: planned - spent,
      ratio: planned > 0 ? spent / planned : 0,
    }
  })

  return { rows, unassigned, spentTotal }
}
