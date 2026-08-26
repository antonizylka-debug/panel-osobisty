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

/**
 * Zapis podzialu bez gubienia przypisanych kategorii.
 *
 * Kasowanie i wstawianie od nowa wygladalo prosciej, ale budget_category_map
 * ma na bucket_id ON DELETE CASCADE — razem z kopertami znikaly wszystkie
 * przypisania kategorii i podzial resetowal sie do zera.
 *
 * Dlatego dopasowujemy po pozycji: pierwsza koperta zostaje pierwsza,
 * zmienia sie tylko jej nazwa i procent. Id przezywa, wiec kategorie
 * dalej wskazuja na wlasciwa koperte — takze po zmianie na inny preset
 * czy po zmianie nazwy.
 */
export async function saveBuckets(buckets) {
  const existing = await fetchBuckets()

  const updates = []
  const inserts = []

  buckets.forEach((b, i) => {
    const row = {
      name: b.name.trim(),
      percent: b.percent,
      is_savings: !!b.is_savings,
      sort_order: i + 1,
    }
    if (existing[i]) updates.push({ id: existing[i].id, ...row })
    else inserts.push(row)
  })

  // Nazwa ma unikalnosc per konto, wiec przy zamianie miejscami dwie koperty
  // moglyby chwilowo nosic te sama nazwe. Najpierw rozbrajamy nazwy,
  // potem ustawiamy docelowe.
  for (const u of updates) {
    const { error } = await supabase
      .from('budget_buckets')
      .update({ name: `tmp-${u.id.slice(0, 8)}` })
      .eq('id', u.id)
    if (error) throw error
  }

  for (const u of updates) {
    const { id, ...patch } = u
    const { error } = await supabase.from('budget_buckets').update(patch).eq('id', id)
    if (error) throw error
  }

  if (inserts.length) {
    const { error } = await supabase.from('budget_buckets').insert(inserts)
    if (error) throw error
  }

  // Koperty ponad nowa liczbe znikaja — razem z ich przypisaniami,
  // bo nie ma juz dokad ich kierowac.
  const removed = existing.slice(buckets.length)
  for (const r of removed) {
    const { error } = await supabase.from('budget_buckets').delete().eq('id', r.id)
    if (error) throw error
  }

  return fetchBuckets()
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
