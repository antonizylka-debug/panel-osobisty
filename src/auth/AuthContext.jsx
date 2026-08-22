import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    // Kolumny wygladu dochodzily migracjami (accent w 0007, surface w 0012).
    // Schodzimy po kolei do wezszego zapytania, zeby brak najnowszej kolumny
    // nie cofal ustawien, ktore baza juz zna.
    const VARIANTS = [
      'user_id, display_name, theme, accent, surface, onboarded',
      'user_id, display_name, theme, accent, onboarded',
      'user_id, display_name, theme, onboarded',
    ]

    let data = null
    let error = null

    for (const columns of VARIANTS) {
      ;({ data, error } = await supabase
        .from('profiles')
        .select(columns)
        .eq('user_id', userId)
        .maybeSingle())

      if (!error) break
      if (!/column .* does not exist|schema cache/i.test(error.message ?? '')) break

      console.warn(`Baza nie zna jeszcze części kolumn wyglądu (${columns}) — wgraj brakujące migracje`)
    }

    if (error) {
      console.error('Nie udało się wczytać profilu:', error.message)
      setProfile(null)
      return
    }
    setProfile(data)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return
      setSession(session)
      await loadProfile(session?.user?.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return
      setSession(session)
      await loadProfile(session?.user?.id)
      setLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signUp = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/logowanie` },
    })
    if (error) throw error
  }, [])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const sendPasswordReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nowe-haslo`,
    })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }, [])

  const completeOnboarding = useCallback(
    async ({ goalTitle, goalDescription }) => {
      const userId = session?.user?.id
      if (!userId) throw new Error('Brak zalogowanego użytkownika')

      if (goalTitle?.trim()) {
        const { error: goalError } = await supabase
          .from('main_goal')
          .upsert(
            { user_id: userId, title: goalTitle.trim(), description: goalDescription?.trim() || null },
            { onConflict: 'user_id' }
          )
        if (goalError) throw goalError
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarded: true })
        .eq('user_id', userId)
      if (profileError) throw profileError

      await loadProfile(userId)
    },
    [session, loadProfile]
  )

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
    completeOnboarding,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth musi być użyte wewnątrz <AuthProvider>')
  return ctx
}
