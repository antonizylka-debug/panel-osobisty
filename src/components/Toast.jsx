import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { describeError } from '../lib/errors'

/**
 * Jedno miejsce na odpowiedz "co sie wlasnie stalo".
 *
 * Do tej pory kazdy formularz radzil sobie sam: jeden zmienial napis na
 * przycisku, drugi dopisywal akapit pod spodem, a usuwanie nie mowilo nic —
 * wpis po prostu znikal i nie bylo wiadomo, czy zapis przeszedl.
 *
 * Pasek jest nieblokujacy: nie zabiera focusu, nie zaslania przyciskow i sam
 * znika. Przy akcji "Cofnij" czeka dluzej, bo trzeba zdazyc w niego trafic.
 */

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  // Rzucamy zamiast zwracac atrape: cicha atrapa znaczy, ze zapis niby sie
  // udal, tylko nikt sie o tym nie dowiedzial — czyli dokladnie ten problem,
  // ktory ten komponent ma rozwiazac.
  if (!ctx) throw new Error('useToast wymaga <ToastProvider> nad drzewem')
  return ctx
}

const AUTO_HIDE = 4000
const AUTO_HIDE_WITH_ACTION = 8000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  const push = useCallback((tone, text, options = {}) => {
    const id = Math.random().toString(36).slice(2)
    const { action } = options
    // Jeden komunikat naraz. Pietrzace sie paski zaslaniaja pol ekranu
    // na telefonie, a i tak czyta sie tylko ostatni.
    setToasts([{ id, tone, text, action }])
    const timer = setTimeout(() => dismiss(id), action ? AUTO_HIDE_WITH_ACTION : AUTO_HIDE)
    timers.current.set(id, timer)
    return id
  }, [dismiss])

  const api = useMemo(() => ({
    ok: (text, options) => push('ok', text, options),
    info: (text, options) => push('info', text, options),
    /** Przyjmuje Error albo tekst — sam tlumaczy blad Supabase na polski. */
    error: (err, options) => push('error', describeError(err), options),
    dismiss,
  }), [push, dismiss])

  useEffect(() => {
    const map = timers.current
    return () => { map.forEach(clearTimeout); map.clear() }
  }, [])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div className={`toast is-${t.tone}`} key={t.id}>
              <span className="toast-text">{t.text}</span>
              {t.action && (
                <button
                  type="button"
                  className="toast-action"
                  onClick={() => { dismiss(t.id); t.action.onClick() }}
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                className="toast-close"
                onClick={() => dismiss(t.id)}
                aria-label="Zamknij powiadomienie"
              >
                ×
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}
