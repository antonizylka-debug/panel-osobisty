import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../auth/AuthContext'

const ThemeContext = createContext(null)

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }) {
  const { user, profile } = useAuth()
  const [theme, setThemeState] = useState('system')
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  // Startowa wartosc przychodzi z profilu (zapamietana dla konta).
  useEffect(() => {
    if (profile?.theme) setThemeState(profile.theme)
  }, [profile?.theme])

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

  const value = useMemo(() => ({ theme, resolved, setTheme, toggle }), [theme, resolved, setTheme, toggle])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme musi być użyte wewnątrz <ThemeProvider>')
  return ctx
}
