import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../auth/AuthContext'

const ThemeContext = createContext(null)

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/* Stonowana, krotka paleta. Kazdy kolor jest przygaszony i wystarczajaco
   ciemny, zeby bialy tekst na nim byl czytelny (patrz --accent-ink). */
export const ACCENTS = [
  { value: 'graphite', label: 'Grafit',   swatch: '#4A505A' },
  { value: 'navy',     label: 'Granat',   swatch: '#37506E' },
  { value: 'steel',    label: 'Stal',     swatch: '#456070' },
  { value: 'forest',   label: 'Zieleń',   swatch: '#3D5B4C' },
  { value: 'burgundy', label: 'Bordo',    swatch: '#6B454C' },
  { value: 'amber',    label: 'Bursztyn', swatch: '#726039' },
]

export const DENSITIES = [
  { value: 'comfortable', label: 'Standardowa' },
  { value: 'compact',     label: 'Zwarta' },
]

export const SURFACES = [
  { value: 'neutral', label: 'Neutralna' },
  { value: 'tinted',  label: 'Barwna' },
]

const DEFAULT_ACCENT = 'graphite'
const DENSITY_KEY = 'panel.density'

function storedDensity() {
  try {
    const v = localStorage.getItem(DENSITY_KEY)
    return DENSITIES.some((d) => d.value === v) ? v : 'comfortable'
  } catch {
    return 'comfortable'
  }
}

export function ThemeProvider({ children }) {
  const { user, profile } = useAuth()
  const [theme, setThemeState] = useState('system')
  const [accent, setAccentState] = useState(DEFAULT_ACCENT)
  const [surface, setSurfaceState] = useState('neutral')
  // Gestosc to preferencja urzadzenia, nie konta — na telefonie chcesz innej
  // niz na monitorze. Dlatego localStorage, a nie kolumna w profilu.
  const [density, setDensityState] = useState(storedDensity)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  // Startowa wartosc przychodzi z profilu (zapamietana dla konta).
  useEffect(() => {
    if (profile?.theme) setThemeState(profile.theme)
    // Konta zalozone przed zmianą palety maja zapisany kolor, ktorego juz nie
    // ma na liscie — wtedy wracamy do domyslnego zamiast zostawiac pusty motyw.
    if (profile?.accent) {
      setAccentState(ACCENTS.some((a) => a.value === profile.accent) ? profile.accent : DEFAULT_ACCENT)
    }
    if (profile?.surface) setSurfaceState(profile.surface)
  }, [profile?.theme, profile?.accent, profile?.surface])

  useEffect(() => {
    document.documentElement.dataset.accent = accent
  }, [accent])

  useEffect(() => {
    document.documentElement.dataset.surface = surface
  }, [surface])

  useEffect(() => {
    document.documentElement.dataset.density = density
    try { localStorage.setItem(DENSITY_KEY, density) } catch { /* tryb prywatny */ }
  }, [density])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    if (theme === 'system') {
      delete document.documentElement.dataset.theme
    } else {
      document.documentElement.dataset.theme = theme
    }
  }, [theme])

  const setTheme = useCallback(
    async (next) => {
      setThemeState(next)
      if (!user) return
      const { error } = await supabase.from('profiles').update({ theme: next }).eq('user_id', user.id)
      if (error) console.error('Nie udało się zapisać motywu:', error.message)
    },
    [user]
  )

  const toggle = useCallback(() => {
    setTheme(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setTheme])

  const setAccent = useCallback(
    async (next) => {
      setAccentState(next)
      if (!user) return
      const { error } = await supabase.from('profiles').update({ accent: next }).eq('user_id', user.id)
      if (error) console.error('Nie udało się zapisać koloru:', error.message)
    },
    [user]
  )

  const setSurface = useCallback(
    async (next) => {
      setSurfaceState(next)
      if (!user) return
      const { error } = await supabase.from('profiles').update({ surface: next }).eq('user_id', user.id)
      if (error) console.error('Nie udało się zapisać stylu powierzchni:', error.message)
    },
    [user]
  )

  const setDensity = useCallback((next) => setDensityState(next), [])

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggle, accent, setAccent, surface, setSurface, density, setDensity }),
    [theme, resolved, setTheme, toggle, accent, setAccent, surface, setSurface, density, setDensity]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme musi być użyte wewnątrz <ThemeProvider>')
  return ctx
}
