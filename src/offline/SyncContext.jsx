import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { flushQueue, pendingCount, onQueueChange } from '../lib/offlineMutate'

const SyncContext = createContext(null)

export function SyncProvider({ children }) {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const sync = useCallback(async () => {
    if (!navigator.onLine) return
    setSyncing(true)
    try {
      await flushQueue()
      setPending(await pendingCount())
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    pendingCount().then(setPending).catch(() => {})
    const off = onQueueChange(setPending)

    function handleOnline() { setOnline(true); sync() }
    function handleOffline() { setOnline(false) }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Proba na starcie — cos moglo zostac z poprzedniej sesji.
    sync()

    return () => {
      off()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [sync])

  return (
    <SyncContext.Provider value={{ online, pending, syncing, sync }}>
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync musi być użyte wewnątrz <SyncProvider>')
  return ctx
}
