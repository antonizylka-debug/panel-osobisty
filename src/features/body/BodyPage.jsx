import { useCallback, useEffect, useMemo, useState } from 'react'
import LineChart from './LineChart'
import MonthCalendar from '../../components/MonthCalendar'
import { SleepCard, StepsCard } from './SleepStepsCards'
import {
  fetchWeights, saveWeight, fetchNutrition, saveNutrition,
  fetchWeightGoal, saveWeightGoal, fetchBodyProfile, saveBodyProfile, fetchMetrics,
  ACTIVITY, ageFrom, calcBMR, calcTDEE, calcDailyTarget, ema, weeklyTrend,
} from './api'
import { todayISO, addDaysISO, formatDatePl } from '../../lib/date'
import { Card, CardHead, ProgressBar, StatRow, EmptyState, Sheet, Segmented } from '../../components/ui'
import { PageLoader } from '../../components/FullScreenSpinner'

const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')))
const fmtKg = (v) => `${Number(v).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`

export default function BodyPage() {
  const today = todayISO()
  const [weights, setWeights] = useState([])
  const [nutrition, setNutrition] = useState([])
  const [goal, setGoal] = useState(null)
  const [metrics, setMetrics] = useState([])
  const [profile, setProfile] = useState(null)
  const [goalOpen, setGoalOpen] = useState(false)
  const [bodyOpen, setBodyOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const since = addDaysISO(today, -180)

    // allSettled, nie all: brak jednej tabeli (np. zanim wgrasz migracje)
    // nie moze skasowac calej strony razem z danymi, ktore sa w porzadku.
    const [w, n, g, p, m] = await Promise.allSettled([
      fetchWeights(since), fetchNutrition(since), fetchWeightGoal(), fetchBodyProfile(),
      fetchMetrics(since),
    ])

    if (w.status === 'fulfilled') setWeights(w.value)
    if (n.status === 'fulfilled') setNutrition(n.value)
    if (g.status === 'fulfilled') setGoal(g.value)
    if (p.status === 'fulfilled') setProfile(p.value)
    if (m.status === 'fulfilled') setMetrics(m.value)

    const failures = [w, n, g, p, m].filter((r) => r.status === 'rejected')
    if (failures.length) {
      const missingTable = failures.some((f) => /daily_metrics/.test(f.reason?.message ?? ''))
      setError(missingTable
        ? 'Sen i kroki wymagają migracji 0008_sleep_steps_authors.sql — reszta działa normalnie.'
        : failures[0].reason?.message ?? 'Nie udało się wczytać części danych.')
    } else {
      setError('')
    }

    setLoading(false)
  }, [today])

  useEffect(() => { load() }, [load])

  const latest = weights.length ? weights[weights.length - 1] : null
  const todayWeight = weights.find((w) => w.date === today)
  const todayNutrition = nutrition.find((n) => n.date === today)
  const todayMetrics = metrics.find((m) => m.date === today)

  const age = profile ? ageFrom(profile.birth_date, today) : null
  const bmr = calcBMR({
    weightKg: latest ? Number(latest.weight_kg) : null,
    heightCm: profile?.height_cm ? Number(profile.height_cm) : null,
    age,
    sex: profile?.sex,
  })
  const tdee = calcTDEE(bmr, profile?.activity_level)

  const direction = goal && latest
    ? Number(goal.target_weight_kg) < Number(latest.weight_kg) ? 'down' : 'up'
    : 'down'
  const dailyTarget = goal ? calcDailyTarget({ tdee, weeklyRateKg: Number(goal.weekly_rate_kg), direction }) : null

  const trend = useMemo(() => weeklyTrend(weights), [weights])

  const chart = useMemo(() => {
    const recent = weights.slice(-60)
    return {
      points: recent.map((w) => ({ label: formatDatePl(w.date), value: Number(w.weight_kg) })),
      smooth: ema(recent.map((w) => Number(w.weight_kg))),
    }
  }, [weights])

  const marks = useMemo(() => {
    const m = new Map()
    const add = (date, label) => m.set(date, [...(m.get(date) ?? []), label])
    for (const w of weights) add(w.date, 'waga')
    for (const n of nutrition) if (n.kcal != null) add(n.date, 'kalorie')
    for (const d of metrics) {
      if (d.sleep_hours != null) add(d.date, 'sen')
      if (d.steps != null) add(d.date, 'kroki')
    }
    return m
  }, [weights, nutrition, metrics])

  // Ile jeszcze tygodni do celu przy obecnym tempie
  const weeksLeft = useMemo(() => {
    if (!goal || !latest || !trend) return null
    const remaining = Number(goal.target_weight_kg) - Number(latest.weight_kg)
    if (Math.sign(remaining) !== Math.sign(trend)) return null
    const w = Math.abs(remaining / trend)
    return Number.isFinite(w) && w > 0 ? Math.ceil(w) : null
  }, [goal, latest, trend])

  if (loading) return <PageLoader />

  const start = goal?.start_weight_kg ? Number(goal.start_weight_kg) : (weights[0] ? Number(weights[0].weight_kg) : null)
  const doneKg = goal && latest && start != null ? Math.abs(start - Number(latest.weight_kg)) : null
  const totalKg = goal && start != null ? Math.abs(start - Number(goal.target_weight_kg)) : null

  return (
    <div className="page-pad">
      <h1 className="page-title">Ciało</h1>
      {error && <p className="form-error" role="alert">{error}</p>}

      <WeightCard date={today} entry={todayWeight} onSaved={load} />

      {goal && latest && (
        <Card>
          <CardHead
            title="Cel wagowy"
            hint={`${fmtKg(latest.weight_kg)} → ${fmtKg(goal.target_weight_kg)}`}
            action={<button className="chip" onClick={() => setGoalOpen(true)}>Zmień</button>}
          />
          <p className="big-number">{fmtKg(Math.abs(Number(goal.target_weight_kg) - Number(latest.weight_kg)))}</p>
          <p className="muted" style={{ marginTop: '.3rem' }}>
            {direction === 'down' ? 'do zrzucenia' : 'do przybrania'} ·
            tempo {Number(goal.weekly_rate_kg).toLocaleString('pl-PL')} kg / tydzień
          </p>
          {totalKg > 0 && (
            <div className="mt-1">
              <ProgressBar value={doneKg} max={totalKg} />
              <p className="muted" style={{ marginTop: '.4rem' }}>
                Za Tobą {fmtKg(doneKg)} z {fmtKg(totalKg)}
              </p>
            </div>
          )}
        </Card>
      )}

      {!goal && (
        <Card>
          <CardHead title="Cel wagowy" hint="Nie ustawiony" />
          <EmptyState>Ustaw wagę docelową, a policzę zapotrzebowanie i tempo.</EmptyState>
          <button className="btn btn-primary btn-block" onClick={() => setGoalOpen(true)}>
            Ustaw cel
          </button>
        </Card>
      )}

      <Card>
        <CardHead
          title="Dzienne zapotrzebowanie"
          hint={tdee ? 'Mifflin-St Jeor' : 'Uzupełnij dane ciała'}
          action={<button className="chip" onClick={() => setBodyOpen(true)}>Dane ciała</button>}
        />
        {dailyTarget ? (
          <>
            <p className="big-number">{dailyTarget}<span style={{ fontSize: '1rem', fontWeight: 600 }}> kcal / dzień</span></p>
            <div className="stat-row" style={{ marginTop: '1rem', marginBottom: 0 }}>
              <div className="stat-cell"><b>{bmr}</b><span>BMR</span></div>
              <div className="stat-cell"><b>{tdee}</b><span>TDEE</span></div>
              <div className="stat-cell">
                <b>{Math.abs(tdee - dailyTarget)}</b>
                <span>{direction === 'down' ? 'deficyt' : 'nadwyżka'}</span>
              </div>
            </div>
          </>
        ) : (
          <EmptyState>
            {!latest ? 'Zapisz wagę, żeby policzyć zapotrzebowanie.'
              : !profile?.height_cm || !profile?.birth_date || !profile?.sex
                ? 'Uzupełnij wzrost, datę urodzenia i płeć w „Dane ciała".'
                : 'Ustaw cel wagowy, żeby zobaczyć dzienny limit.'}
          </EmptyState>
        )}
      </Card>

      <NutritionCard date={today} entry={todayNutrition} target={dailyTarget} onSaved={load} />

      <SleepCard date={today} entry={todayMetrics} onSaved={load} />

      <StepsCard date={today} entry={todayMetrics} onSaved={load} />

      <Card>
        <CardHead title="Trend wagi" hint="Linia to wygładzona średnia, kropki to pomiary" />
        <LineChart
          points={chart.points}
          smooth={chart.smooth}
          target={goal ? Number(goal.target_weight_kg) : null}
          format={fmtKg}
        />
        {trend != null && (
          <div className="converter mt-1">
            Faktyczne tempo: {trend > 0 ? '+' : ''}{trend.toFixed(2)} kg / tydzień
            {weeksLeft && ` · przy tym tempie cel za ${weeksLeft} tyg.`}
          </div>
        )}
        {trend == null && weights.length < 3 && (
          <p className="muted mt-1">Potrzeba 3 pomiarów, żeby wyznaczyć trend.</p>
        )}
      </Card>

      <StatRow items={[
        { label: 'pomiarów', value: weights.length },
        { label: 'dni z kalor.', value: nutrition.filter((n) => n.kcal != null).length },
        { label: 'ostatnia waga', value: latest ? Number(latest.weight_kg).toFixed(1) : '—' },
      ]} />

      <Card>
        <CardHead title="Kalendarz" hint="Dni, w których coś zapisałeś" />
        <MonthCalendar
          marks={marks}
          legend={<><span><span className="cal-dot" /> zapisany dzień</span></>}
        />
      </Card>

      <GoalSheet open={goalOpen} goal={goal} latest={latest} onClose={() => setGoalOpen(false)}
        onDone={() => { setGoalOpen(false); load() }} />
      <BodySheet open={bodyOpen} profile={profile} onClose={() => setBodyOpen(false)}
        onDone={() => { setBodyOpen(false); load() }} />
    </div>
  )
}

function WeightCard({ date, entry, onSaved }) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => { setValue(entry ? String(entry.weight_kg) : '') }, [entry])

  async function submit(e) {
    e.preventDefault()
    setError('')
    const kg = num(value)
    if (kg == null || kg < 30 || kg > 300) return setError('Podaj wagę między 30 a 300 kg.')

    setSaving(true)
    try {
      await saveWeight({ date, weightKg: kg })
      onSaved()
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHead title="Waga dzisiaj" hint={entry ? 'Zapisana — możesz poprawić' : 'Brak wpisu'} />
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Waga (kg)</span>
          <input type="text" inputMode="decimal" value={value} placeholder="np. 90,5"
            onChange={(e) => setValue(e.target.value)}
            style={{ fontSize: '1.5rem', fontWeight: 800 }} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Zapisywanie…' : justSaved ? 'Zapisano ✓' : entry ? 'Zapisz zmianę' : 'Zapisz wagę'}
        </button>
      </form>
    </Card>
  )
}

function NutritionCard({ date, entry, target, onSaved }) {
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    setKcal(entry?.kcal != null ? String(entry.kcal) : '')
    setProtein(entry?.protein_g != null ? String(entry.protein_g) : '')
    setCarbs(entry?.carbs_g != null ? String(entry.carbs_g) : '')
    setFat(entry?.fat_g != null ? String(entry.fat_g) : '')
  }, [entry])

  const eaten = num(kcal)
  const diff = eaten != null && target != null ? eaten - target : null

  async function submit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await saveNutrition({
        date,
        kcal: eaten != null ? Math.round(eaten) : null,
        protein: num(protein), carbs: num(carbs), fat: num(fat),
      })
      onSaved()
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHead title="Kalorie dzisiaj" hint={entry?.kcal != null ? 'Zapisane' : 'Brak wpisu'} />
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>kcal</span>
          <input type="text" inputMode="numeric" value={kcal} placeholder="np. 2400"
            onChange={(e) => setKcal(e.target.value)}
            style={{ fontSize: '1.5rem', fontWeight: 800 }} />
        </label>

        {diff != null && (
          <div className={'converter' + (Math.abs(diff) <= 100 ? '' : ' is-muted')}>
            {diff < 0
              ? `${Math.abs(Math.round(diff))} kcal poniżej celu`
              : diff > 0
                ? `${Math.round(diff)} kcal powyżej celu`
                : 'Dokładnie w celu'}
            {target != null && ` · cel ${target} kcal`}
          </div>
        )}

        <span className="field-label">Makro (opcjonalnie)</span>
        <div className="field-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <label className="field">
            <span>Białko</span>
            <input type="text" inputMode="numeric" value={protein} placeholder="g"
              onChange={(e) => setProtein(e.target.value)} />
          </label>
          <label className="field">
            <span>Węgle</span>
            <input type="text" inputMode="numeric" value={carbs} placeholder="g"
              onChange={(e) => setCarbs(e.target.value)} />
          </label>
          <label className="field">
            <span>Tłuszcz</span>
            <input type="text" inputMode="numeric" value={fat} placeholder="g"
              onChange={(e) => setFat(e.target.value)} />
          </label>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Zapisywanie…' : justSaved ? 'Zapisano ✓' : 'Zapisz kalorie'}
        </button>
      </form>
    </Card>
  )
}

function GoalSheet({ open, goal, latest, onClose, onDone }) {
  const [target, setTarget] = useState('')
  const [rate, setRate] = useState('0.45')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTarget(goal?.target_weight_kg != null ? String(goal.target_weight_kg) : '')
    setRate(goal?.weekly_rate_kg != null ? String(goal.weekly_rate_kg) : '0.45')
    setError('')
  }, [open, goal])

  const current = latest ? Number(latest.weight_kg) : null
  // Bezpieczny limit kliniczny: do 1% masy ciala tygodniowo.
  const maxRate = current ? Math.min(2, Math.round(current * 0.01 * 100) / 100) : 2

  async function submit(e) {
    e.preventDefault()
    setError('')
    const t = num(target)
    const r = num(rate)
    if (t == null || t < 30 || t > 300) return setError('Podaj wagę docelową między 30 a 300 kg.')
    if (r == null || r <= 0) return setError('Podaj tempo większe od zera.')
    if (r > maxRate) return setError(`Tempo ograniczone do ${maxRate} kg/tydzień (1% masy ciała).`)

    setSaving(true)
    try {
      await saveWeightGoal({
        targetWeightKg: t,
        weeklyRateKg: r,
        startWeightKg: goal?.start_weight_kg ?? current,
      })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title="Cel wagowy" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Waga docelowa (kg)</span>
          <input type="text" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label className="field">
          <span>Tempo (kg / tydzień)</span>
          <input type="text" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <p className="muted">
          Bezpieczne tempo to do 1% masy ciała tygodniowo{current ? ` — u Ciebie ${maxRate} kg` : ''}.
          Szybciej tracisz mięśnie zamiast tłuszczu.
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Zapisywanie…' : 'Zapisz cel'}
        </button>
      </form>
    </Sheet>
  )
}

function BodySheet({ open, profile, onClose, onDone }) {
  const [height, setHeight] = useState('')
  const [birth, setBirth] = useState('')
  const [sex, setSex] = useState('male')
  const [activity, setActivity] = useState('moderate')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setHeight(profile?.height_cm != null ? String(profile.height_cm) : '')
    setBirth(profile?.birth_date ?? '')
    setSex(profile?.sex ?? 'male')
    setActivity(profile?.activity_level ?? 'moderate')
    setError('')
  }, [open, profile])

  async function submit(e) {
    e.preventDefault()
    setError('')
    const h = num(height)
    if (h == null || h < 100 || h > 250) return setError('Podaj wzrost między 100 a 250 cm.')
    if (!birth) return setError('Podaj datę urodzenia.')

    setSaving(true)
    try {
      await saveBodyProfile({
        height_cm: h,
        birth_date: birth,
        sex,
        activity_level: activity,
      })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title="Dane ciała" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted">
          Wzrost, wiek i płeć są potrzebne do policzenia Twojego zapotrzebowania kalorycznego.
        </p>
        <div className="field-grid">
          <label className="field">
            <span>Wzrost (cm)</span>
            <input type="text" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} />
          </label>
          <label className="field">
            <span>Data urodzenia</span>
            <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
          </label>
        </div>

        <label className="field">
          <span>Płeć</span>
          <Segmented
            ariaLabel="Płeć"
            value={sex}
            onChange={setSex}
            options={[{ value: 'male', label: 'Mężczyzna' }, { value: 'female', label: 'Kobieta' }]}
          />
        </label>

        <label className="field">
          <span>Poziom aktywności</span>
          <select value={activity} onChange={(e) => setActivity(e.target.value)}>
            {ACTIVITY.map((a) => (
              <option key={a.value} value={a.value}>{a.label} — {a.hint}</option>
            ))}
          </select>
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Zapisywanie…' : 'Zapisz dane'}
        </button>
      </form>
    </Sheet>
  )
}
