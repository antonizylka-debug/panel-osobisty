import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Brak VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — utwórz .env.local na podstawie .env.example'
  )
}

export const supabase = createClient(url, anonKey)
