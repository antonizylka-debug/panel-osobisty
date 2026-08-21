import { supabase } from '../../lib/supabaseClient'

/* --------------------------------- waga ----------------------------------- */

export async function fetchWeights(since) {
  const { data, error } = await supabase
    .from('body_weights')
    .select('*')
    .gte('date', since)
    .order('date', { ascending: true })
  if (error) throw error
  return data
}

export async function saveWeight({ date, weightKg }) {
  const { data, error } = await supabase
    .from('body_weights')
    .upsert({ date, weight_kg: weightKg }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

/* -------------------------------- kalorie --------------------------------- */

export async function fetchNutrition(since) {
  const { data, error } = await supabase
    .from('nutrition_days')
    .select('*')
    .gte('date', since)
    .order('date', { ascending: true })
  if (error) throw error
  return data
}

export async function saveNutrition({ date, kcal, protein, carbs, fat, activeKcal }) {
  const { data, error } = await supabase
    .from('nutrition_days')
    .upsert(
      {
        date,
        kcal: kcal ?? null,
        protein_g: protein ?? null,
        carbs_g: carbs ?? null,
        fat_g: fat ?? null,
        active_kcal: activeKcal ?? null,
      },
      { onConflict: 'user_id,date' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

/* ------------------------------- cel wagowy -------------------------------- */

export async function fetchWeightGoal() {
  const { data, error } = await supabase.from('weight_goal').select('*').maybeSingle()
  if (error) throw error
  return data
}

export async function saveWeightGoal({ targetWeightKg, weeklyRateKg, startWeightKg }) {
  const { error } = await supabase
    .from('weight_goal')
    .upsert(
      {
        target_weight_kg: targetWeightKg,
        weekly_rate_kg: weeklyRateKg,
        start_weight_kg: startWeightKg ?? null,
      },
      { onConflict: 'user_id' }
    )
  if (error) throw error
}

export async function fetchBodyProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('height_cm, birth_date, sex, activity_level')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveBodyProfile(patch) {
  const { error } = await supabase.from('profiles').update(patch).eq('user_id', (await supabase.auth.getUser()).data.user.id)
  if (error) throw error
}

/* ------------------------------- obliczenia -------------------------------- */

export const ACTIVITY = [
  { value: 'sedentary',   label: 'Siedzący',        hint: 'praca biurowa, brak ruchu', factor: 1.2 },
  { value: 'light',       label: 'Lekki',           hint: '1–3 dni / tydzień',        factor: 1.375 },
  { value: 'moderate',    label: 'Umiarkowany',     hint: '3–5 dni / tydzień',        factor: 1.55 },
  { value: 'active',      label: 'Aktywny',         hint: '6–7 dni / tydzień',        factor: 1.725 },
  { value: 'very_active', label: 'Bardzo aktywny',  hint: '2× dziennie / praca fizyczna', factor: 1.9 },
]

export function ageFrom(birthDate, today) {
  if (!birthDate) return null
  const [by, bm, bd] = birthDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  let age = ty - by
  if (tm < bm || (tm === bm && td < bd)) age--
  return age
}

/** Mifflin-St Jeor — standardowy wzor na spoczynkowa przemiane materii. */
export function calcBMR({ weightKg, heightCm, age, sex }) {
  if (!weightKg || !heightCm || age == null || !sex) return null
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return Math.round(sex === 'male' ? base + 5 : base - 161)
}

export function calcTDEE(bmr, activityLevel) {
  if (bmr == null) return null
  const f = ACTIVITY.find((a) => a.value === activityLevel)?.factor ?? 1.55
  return Math.round(bmr * f)
}

/**
 * Ile kcal dziennie, zeby chudnac/tyc w zadanym tempie.
 * 1 kg tkanki tluszczowej ~ 7700 kcal.
 */
export function calcDailyTarget({ tdee, weeklyRateKg, direction }) {
  if (tdee == null) return null
  const daily = (weeklyRateKg * 7700) / 7
  return Math.round(direction === 'down' ? tdee - daily : tdee + daily)
}

/**
 * Wygladzona srednia wagi (EMA). Pojedynczy pomiar skacze o wode i posilki —
 * trend liczony z wygladzenia mowi wiecej niz ostatnia liczba na wadze.
 */
export function ema(values, alpha = 0.25) {
  if (!values.length) return []
  const out = [values[0]]
  for (let i = 1; i < values.length; i++) {
    out.push(alpha * values[i] + (1 - alpha) * out[i - 1])
  }
  return out
}

/** kg na tydzien wynikajace z realnych pomiarow (regresja liniowa po EMA). */
export function weeklyTrend(weights) {
  if (weights.length < 3) return null
  const smooth = ema(weights.map((w) => Number(w.weight_kg)))
  const t0 = Date.parse(weights[0].date)
  const xs = weights.map((w) => (Date.parse(w.date) - t0) / 864e5)

  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = smooth.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (smooth[i] - my)
    den += (xs[i] - mx) ** 2
  }
  if (den === 0) return null
  return (num / den) * 7
}
