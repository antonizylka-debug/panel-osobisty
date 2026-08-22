/**
 * Minimalna obsluga IndexedDB — tylko tyle, ile potrzebuje kolejka offline.
 * Bez biblioteki, zeby nie dokladac zaleznosci do apki, ktora ma byc lekka.
 */

const DB_NAME = 'panel-osobisty'
const DB_VERSION = 1
const STORE = 'outbox'

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  return dbPromise
}

async function tx(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const store = t.objectStore(STORE)
    let result
    try { result = fn(store) } catch (err) { reject(err); return }
    t.oncomplete = () => resolve(result?.result ?? result)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

export async function enqueue(entry) {
  return tx('readwrite', (store) => store.add({ ...entry, queuedAt: Date.now() }))
}

export async function listQueue() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly')
    const req = t.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function removeFromQueue(id) {
  return tx('readwrite', (store) => store.delete(id))
}

export async function countQueue() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly')
    const req = t.objectStore(STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function clearQueue() {
  return tx('readwrite', (store) => store.clear())
}
