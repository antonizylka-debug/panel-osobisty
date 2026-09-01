import { createClient } from '@supabase/supabase-js'

// trim() jest tu konieczny, nie kosmetyczny: wklejenie wartosci w panelu
// hostingu (Vercel ma wieloliniowe pole) potrafi dokleic znak nowej linii.
// Klucz trafia potem do naglowka HTTP `apikey`, a naglowek ze znakiem nowej
// linii wywala fetch z "Failed to execute 'set' on 'Headers': Invalid value" —
// bledem, ktory nijak nie wskazuje na przyczyne.
const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!url || !anonKey) {
  throw new Error(
    'Brak VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — utwórz .env.local na podstawie .env.example'
  )
}

export const supabase = createClient(url, anonKey)
