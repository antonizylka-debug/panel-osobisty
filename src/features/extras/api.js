import { supabase } from '../../lib/supabaseClient'
import { addDaysISO } from '../../lib/date'

/* ---------------------------------- nawyki --------------------------------- */

export async function fetchHabits() {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchHabitLogs(since) {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('*')
    .gte('date', since)
  if (error) throw error
  return data
}

export async function toggleHabit({ habitId, date, done }) {
  if (done) {
    const { error } = await supabase
      .from('habit_logs')
      .upsert({ habit_id: habitId, date, done: true, value: 0 }, { onConflict: 'habit_id,date' })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('habit_logs')
      .delete()
      .eq('habit_id', habitId)
      .eq('date', date)
    if (error) throw error
  }
}

/**
 * Zapis postepu nawyku liczbowego. Nawyk liczy sie za zrobiony dopiero
 * po osiagnieciu celu — na tym opiera sie streak.
 * Wartosc 0 kasuje wpis, zeby dzien nie liczyl sie jako zaczety.
 */
export async function setHabitProgress({ habitId, date, value, target }) {
  const clamped = Math.max(0, Math.round(value * 100) / 100)

  if (clamped === 0) {
    const { error } = await supabase
      .from('habit_logs')
      .delete()
      .eq('habit_id', habitId)
      .eq('date', date)
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('habit_logs')
    .upsert(
      { habit_id: habitId, date, value: clamped, done: clamped >= Number(target) },
      { onConflict: 'habit_id,date' }
    )
  if (error) throw error
}

export async function createHabit({ name, target, unit, step }) {
  const { error } = await supabase.from('habits').insert({
    name,
    target: target ?? null,
    unit: unit || null,
    step: step ?? 1,
  })
  if (error) throw error
}

export async function updateHabit(id, { name, target, unit, step }) {
  const patch = {}
  if (name !== undefined) patch.name = name
  if (target !== undefined) patch.target = target
  if (unit !== undefined) patch.unit = unit || null
  if (step !== undefined) patch.step = step ?? 1

  const { error } = await supabase.from('habits').update(patch).eq('id', id)
  if (error) throw error
}

export async function deactivateHabit(id) {
  const { error } = await supabase.from('habits').update({ active: false }).eq('id', id)
  if (error) throw error
}

/** Dzien odpoczynku — nie liczy sie jako zrobione, ale nie lamie serii. */
export async function setHabitRest({ habitId, date, isRest }) {
  if (!isRest) {
    const { error } = await supabase
      .from('habit_logs').delete().eq('habit_id', habitId).eq('date', date)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('habit_logs')
    .upsert(
      { habit_id: habitId, date, done: false, value: 0, is_rest: true },
      { onConflict: 'habit_id,date' }
    )
  if (error) throw error
}

/**
 * Ile dni z rzedu odhaczony, liczac wstecz od dzis.
 * Dni odpoczynku sa przeskakiwane — nie dodaja do serii, ale jej nie zeruja.
 */
export function habitStreak(habitId, logs, today) {
  const mine = logs.filter((l) => l.habit_id === habitId)
  const done = new Set(mine.filter((l) => l.done).map((l) => l.date))
  const rest = new Set(mine.filter((l) => l.is_rest).map((l) => l.date))

  let streak = 0
  let cursor = today
  // Dzisiaj jeszcze nieodhaczone nie zeruje serii — liczymy od wczoraj.
  if (!done.has(cursor) && !rest.has(cursor)) cursor = addDaysISO(cursor, -1)

  while (done.has(cursor) || rest.has(cursor)) {
    if (done.has(cursor)) streak++
    cursor = addDaysISO(cursor, -1)
  }
  return streak
}

/* --------------------------------- plan dnia -------------------------------- */

export async function fetchDailyPlan(date) {
  const { data, error } = await supabase
    .from('daily_plan')
    .select('*')
    .eq('date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveDailyPlan({ date, items, completed }) {
  const { data, error } = await supabase
    .from('daily_plan')
    .upsert({ date, items, completed }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

/* ------------------------------ przeglad tygodnia --------------------------- */

export async function fetchWeeklyReview(weekStart) {
  const { data, error } = await supabase
    .from('weekly_reviews')
    .select('*')
    .eq('week_start', weekStart)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveWeeklyReview({ weekStart, wentWell, wouldChange, nextPriority }) {
  const { data, error } = await supabase
    .from('weekly_reviews')
    .upsert(
      {
        week_start: weekStart,
        went_well: wentWell || null,
        would_change: wouldChange || null,
        next_priority: nextPriority || null,
      },
      { onConflict: 'user_id,week_start' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

/* --------------------------------- cytaty ----------------------------------- */

export async function fetchQuotes() {
  const { data, error } = await supabase
    .from('motivation_quotes')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createQuote(text, author) {
  const { error } = await supabase
    .from('motivation_quotes')
    .insert({ text, author: author?.trim() || null })
  if (error) throw error
}

export async function deleteQuote(id) {
  const { error } = await supabase.from('motivation_quotes').delete().eq('id', id)
  if (error) throw error
}

export async function toggleQuoteFavorite(id, isFavorite) {
  const { error } = await supabase
    .from('motivation_quotes')
    .update({ is_favorite: isFavorite })
    .eq('id', id)
  if (error) throw error
}

/* -------------------------------- pytania ----------------------------------- */

export async function fetchPrompts() {
  const { data, error } = await supabase
    .from('reflection_prompts')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createPrompt(text) {
  const { error } = await supabase.from('reflection_prompts').insert({ text })
  if (error) throw error
}

export async function deletePrompt(id) {
  const { error } = await supabase.from('reflection_prompts').delete().eq('id', id)
  if (error) throw error
}

/* ----------------------------- globalna wyszukiwarka ------------------------ */

export async function searchEverything(query) {
  const q = query.trim()
  if (q.length < 2) return []
  const like = `%${q}%`

  const [gratitude, expenses, journal, procrastination, quotes] = await Promise.all([
    supabase.from('gratitude_entries').select('id, date, items, reflection').or(`reflection.ilike.${like}`).limit(10),
    supabase.from('expenses').select('id, date, description, amount, category').or(`description.ilike.${like},category.ilike.${like}`).limit(10),
    supabase.from('journal_entries').select('id, type, title, content, tag, created_at').or(`title.ilike.${like},content.ilike.${like},tag.ilike.${like}`).limit(10),
    supabase.from('procrastination_sessions').select('id, task, created_at').ilike('task', like).limit(10),
    supabase.from('motivation_quotes').select('id, text').ilike('text', like).limit(10),
  ])

  // Wdziecznosc: items to tablica, filtrujemy po stronie klienta.
  const gratitudeExtra = await supabase
    .from('gratitude_entries')
    .select('id, date, items, reflection')
    .limit(300)

  const gratitudeHits = new Map()
  for (const row of gratitude.data ?? []) gratitudeHits.set(row.id, row)
  for (const row of gratitudeExtra.data ?? []) {
    if (row.items?.some((it) => it.toLowerCase().includes(q.toLowerCase()))) {
      gratitudeHits.set(row.id, row)
    }
  }

  return [
    { group: 'Wdzięczność', items: [...gratitudeHits.values()].slice(0, 10).map((r) => ({
      id: r.id, title: r.items?.join(' · ') ?? '', sub: r.reflection ?? '', date: r.date, to: '/wdziecznosc',
    })) },
    { group: 'Wydatki', items: (expenses.data ?? []).map((r) => ({
      id: r.id, title: r.description || r.category || 'Wydatek', sub: `${r.amount} zł`, date: r.date, to: '/wydatki',
    })) },
    { group: 'Myśli i cele', items: (journal.data ?? []).map((r) => ({
      id: r.id, title: r.title || r.content?.slice(0, 60) || '', sub: r.tag ?? '', date: r.created_at.slice(0, 10), to: '/mysli-i-cele',
    })) },
    { group: 'Zrób to teraz', items: (procrastination.data ?? []).map((r) => ({
      id: r.id, title: r.task, sub: '', date: r.created_at.slice(0, 10), to: '/zrob-to-teraz',
    })) },
    { group: 'Cytaty', items: (quotes.data ?? []).map((r) => ({
      id: r.id, title: r.text, sub: '', date: null, to: '/',
    })) },
  ].filter((g) => g.items.length > 0)
}

/* --------------------------------- ulubione --------------------------------- */

export async function fetchFavorites() {
  const [gratitude, journal, quotes] = await Promise.all([
    supabase.from('gratitude_entries').select('*').eq('is_favorite', true).order('date', { ascending: false }),
    supabase.from('journal_entries').select('*').eq('is_favorite', true).order('created_at', { ascending: false }),
    supabase.from('motivation_quotes').select('*').eq('is_favorite', true),
  ])
  if (gratitude.error) throw gratitude.error
  if (journal.error) throw journal.error
  if (quotes.error) throw quotes.error
  return { gratitude: gratitude.data, journal: journal.data, quotes: quotes.data }
}
