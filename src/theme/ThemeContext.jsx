import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../auth/AuthContext'

const ThemeContext = createContext(null)

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const ACCENTS = [
  { value: 'lime',    label: 'Limonkowy',  swatch: '#15A46B' },
  { value: 'violet',  label: 'Fioletowy',  swatch: '#6D4AE0' },
  { value: 'amber',   label: 'Bursztyn',   swatch: '#B7791F' },
  { value: 'cyan',    label: 'Cyjan',      swatch: '#0E7C99' },
  { value: 'rose',    label: 'Różowy',     swatch: '#C2415F' },
  { value: 'crimson', label: 'Karmazyn',   swatch: '#C0392B' },
  { value: 'ocean',   label: 'Oceaniczny', swatch: '#2563C7' },
  { value: 'earth',   label: 'Ziemia',     swatch: '#8A6A45' },
  { value: 'mint',    label: 'Mięta',      swatch: '#0E8C7F' },
  { value: 'indigo',  label: 'Indygo',     swatch: '#4F46E5' },
  { value: 'magenta', label: 'Magenta',    swatch: '#A8357D' },
  { value: 'slate',   label: 'Stal',       swatch: '#4A6076' },
]

export const SURFACES = [
  { value: 'neutral', label: 'Neutralna' },
  { value: 'tinted',  label: 'Barwna' },
]

export function ThemeProvider({ children }) {
  const { user, profile } = useAuth()
  const [theme, setThemeState] = useState('system')
  const [accent, setAccentState] = useState('lime')
  const [surface, setSurfaceState] = useState('neutral')
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  // Startowa wartosc przychodzi z profilu (zapamietana dla konta).
  useEffect(() => {
    if (profile?.theme) setThemeState(profile.theme)
    if (profile?.accent) setAccentState(profile.accent)
    if (profile?.surface) setSurfaceState(profile.surface)
  }, [profile?.theme, profile?.accent, profile?.surface])

  useEffect(() => {
    document.documentElement.dataset.accent = accent
  }, [accent])

  useEffect(() => {
    document.documentElement.dataset.surface = surface
  }, [surface])

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

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggle, accent, setAccent, surface, setSurface }),
    [theme, resolved, setTheme, toggle, accent, setAccent, surface, setSurface]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme musi być użyte wewnątrz <ThemeProvider>')
  return ctx
}
