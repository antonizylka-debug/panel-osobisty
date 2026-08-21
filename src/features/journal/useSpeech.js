import { useCallback, useEffect, useRef, useState } from 'react'

const Recognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

export const speechSupported = !!Recognition

/**
 * Dyktowanie przez Web Speech API. Nagranie audio nie jest nigdzie zapisywane —
 * przegladarka zwraca sam tekst, ktory uzytkownik moze poprawic przed zapisem.
 */
export function useSpeech({ onText }) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recRef = useRef(null)
  const baseRef = useRef('')

  useEffect(() => () => recRef.current?.abort?.(), [])

  const start = useCallback((currentText = '') => {
    if (!Recognition) return
    setError('')
    baseRef.current = currentText ? currentText.trimEnd() + ' ' : ''

    const rec = new Recognition()
    rec.lang = 'pl-PL'
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      onText(baseRef.current + text)
    }
    rec.onerror = (e) => {
      setError(e.error === 'not-allowed' ? 'Brak zgody na mikrofon.' : 'Nie udało się rozpoznać mowy.')
      setListening(false)
    }
    rec.onend = () => setListening(false)

    recRef.current = rec
    rec.start()
    setListening(true)
  }, [onText])

  const stop = useCallback(() => {
    recRef.current?.stop?.()
    setListening(false)
  }, [])

  return { supported: speechSupported, listening, error, start, stop }
}
