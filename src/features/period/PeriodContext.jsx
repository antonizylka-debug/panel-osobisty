import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'
import { resolvePeriod, previousRange } from '../../lib/period'

const PeriodContext = createContext(null)
const STORAGE_KEY = 'panel.period'

/**
 * Wybrany zakres dat, wspolny dla Wydatkow, Przychodow i Godzin pracy.
 *
 * Trzymany w localStorage (nie w bazie): to preferencja "na czym teraz patrze",
 * a nie dana konta. Przezywa odswiezenie strony i przejscie miedzy zakladkami,
 * ale nie wedruje miedzy urzadzeniami — i dobrze.
 */
function storedPeriod() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { preset: 'month' }
    const parsed = JSON.parse(raw)
    if (typeof parsed?.preset !== 'string') return { preset: 'month' }
    return parsed
  } catch {
    return { preset: 'month' }
  }
}

export function PeriodProvider({ children }) {
  const [period, setPeriodState] = useState(storedPeriod)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(period)) } catch { /* tryb prywatny */ }
  }, [period])

  const setPeriod = useCallback((next) => setPeriodState(next), [])

  const value = useMemo(() => {
    // Presety licza sie przy kazdym renderze wzgledem dzisiaj — zapamietany
    // "ten miesiac" ma pokazywac biezacy miesiac, nie ten sprzed tygodnia.
    const range = resolvePeriod(period)
    return { period, setPeriod, range, previous: previousRange(range) }
  }, [period, setPeriod])

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}

export function usePeriod() {
  const ctx = useContext(PeriodContext)
  if (!ctx) throw new Error('usePeriod musi być użyte wewnątrz <PeriodProvider>')
  return ctx
}
