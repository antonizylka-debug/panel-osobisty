import { supabase } from './supabaseClient'
import { enqueue, listQueue, removeFromQueue, countQueue } from './idb'

/**
 * Zapis, ktory przezywa brak zasiegu.
 *
 * Probuje wyslac od razu. Jesli to blad sieci (a nie odrzucenie przez baze),
 * ladujе operacje do kolejki w IndexedDB i zwraca optymistyczny wynik.
 * Kolejka jest oproznianа po odzyskaniu polaczenia.
 *
 * Celowo NIE kolejkujemy bledow bazy (naruszenie constraintu, RLS) — te
 * trzeba pokazac uzytkownikowi od razu, bo ponowienie ich nie naprawi.
 */

const listeners = new Set()

export function onQueueChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

async function notify() {
  const n = await countQueue()
  listeners.forEach((fn) => fn(n))
}

/** Blad sieci, nie odpowiedz serwera. */
function isNetworkError(err) {
  if (!navigator.onLine) return true
  const msg = String(err?.message ?? err).toLowerCase()
  return (
    err instanceof TypeError ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('network request failed')
  )
}

async function runOperation({ table, op, payload, match, onConflict }) {
  const q = supabase.from(table)

  if (op === 'insert') {
    const { data, error } = await q.insert(payload).select().single()
    if (error) throw error
    return data
  }
  if (op === 'upsert') {
    const { data, error } = await q.upsert(payload, onConflict ? { onConflict } : undefined).select().single()
    if (error) throw error
    return data
  }
  if (op === 'update') {
    let query = q.update(payload)
    for (const [k, v] of Object.entries(match ?? {})) query = query.eq(k, v)
    const { error } = await query
    if (error) throw error
    return payload
  }
  if (op === 'delete') {
    let query = q.delete()
    for (const [k, v] of Object.entries(match ?? {})) query = query.eq(k, v)
    const { error } = await query
    if (error) throw error
    return null
  }
  throw new Error(`Nieznana operacja: ${op}`)
}

export async function mutate(operation) {
  try {
    return await runOperation(operation)
  } catch (err) {
    if (!isNetworkError(err)) throw err

    await enqueue(operation)
    await notify()

    // Optymistyczny wynik — apka rysuje wpis, jakby juz byl zapisany.
    return { ...operation.payload, __pending: true }
  }
}

let flushing = false

/** Wysyla zakolejkowane zapisy. Bezpieczne do wielokrotnego wywolania. */
export async function flushQueue() {
  if (flushing || !navigator.onLine) return { sent: 0, failed: 0 }
  flushing = true

  let sent = 0
  let failed = 0

  try {
    const items = await listQueue()
    for (const item of items) {
      const { id, queuedAt, ...operation } = item
      try {
        await runOperation(operation)
        await removeFromQueue(id)
        sent++
      } catch (err) {
        if (isNetworkError(err)) break // zasieg znowu padl — reszta poczeka

        // Baza odrzucila wpis (np. duplikat po zsynchronizowaniu z innego
        // urzadzenia). Trzymanie go w kolejce w nieskonczonosc nic nie da.
        console.warn('Odrzucony wpis z kolejki offline:', err.message, operation)
        await removeFromQueue(id)
        failed++
      }
    }
  } finally {
    flushing = false
    await notify()
  }

  return { sent, failed }
}

export async function pendingCount() {
  return countQueue()
}
