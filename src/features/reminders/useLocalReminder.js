import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { todayISO } from '../../lib/date'

const STORAGE_KEY = 'panel-osobisty:last-reminder'

/**
 * Lokalne przypomnienie wieczorne. Dziala, gdy apka jest otwarta albo
 * service worker zyje w tle — bez zadnego platnego serwera push.
 * Sprawdza raz na minute, czy wybila ustawiona godzina i czy brakuje wpisu.
 */
export function useLocalReminder(user) {
  useEffect(() => {
    if (!user) return
    if (!('Notification' in window)) return

    let cancelled = false

    async function tick() {
      if (cancelled || Notification.permission !== 'granted') return

      const { data: profile } = await supabase
        .from('profiles')
        .select('reminder_time, reminder_push_enabled, reminder_gratitude, reminder_work_hours')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile?.reminder_push_enabled) return

      const today = todayISO()
      if (localStorage.getItem(STORAGE_KEY) === today) return

      const now = new Date()
      const [h, m] = (profile.reminder_time ?? '20:00').split(':').map(Number)
      const due = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)
      if (!due) return

      const missing = []

      if (profile.reminder_gratitude) {
        const { data } = await supabase
          .from('gratitude_entries').select('id').eq('date', today).maybeSingle()
        if (!data) missing.push('wdzięczność')
      }
      if (profile.reminder_work_hours) {
        const { data } = await supabase
          .from('work_days').select('id').eq('date', today).maybeSingle()
        if (!data) missing.push('godziny pracy')
      }

      if (missing.length === 0) return

      localStorage.setItem(STORAGE_KEY, today)

      const opts = {
        body: `Zostało na dziś: ${missing.join(' i ')}.`,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'daily-reminder',
      }

      // Przez service workera, jesli jest — takie powiadomienie wyglada
      // i zachowuje sie jak systemowe, takze na komputerze.
      const reg = await navigator.serviceWorker?.getRegistration?.()
      if (reg?.showNotification) await reg.showNotification('Panel Osobisty', opts)
      else new Notification('Panel Osobisty', opts)
    }

    tick()
    const id = setInterval(tick, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [user])
}
