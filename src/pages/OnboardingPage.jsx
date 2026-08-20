import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const TABS = [
  { name: 'Start', desc: 'Jednym rzutem oka: bilans miesiąca, cele, dzisiejsze zadania.' },
  { name: 'Wdzięczność', desc: 'Za co jestem dziś wdzięczny — jeden wpis dziennie.' },
  { name: 'Wydatki', desc: 'Paragony, subskrypcje, spłaty i budżet — z przelicznikiem na godziny pracy.' },
  { name: 'Godziny pracy', desc: 'Ile dziś przepracowałeś i ile z tego dostaniesz.' },
  { name: 'Myśli i cele', desc: 'Notatki, cele i pomysły na biznes — także głosem.' },
  { name: 'Zrób to teraz', desc: 'Utknąłeś nad zadaniem? Cztery kroki i ruszasz.' },
]

export default function OnboardingPage() {
  const { completeOnboarding } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [goalTitle, setGoalTitle] = useState('')
  const [goalDescription, setGoalDescription] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function finish(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await completeOnboarding({ goalTitle, goalDescription })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (step === 1) {
    return (
      <div className="screen-center">
        <div className="onboard-card">
          <p className="eyebrow-tag">Witaj</p>
          <h1 className="onboard-title">Sześć zakładek, jeden cel</h1>
          <p className="onboard-lede">Każda robi jedną rzecz. Wpis zajmuje kilka sekund.</p>

          <ul className="onboard-tabs">
            {TABS.map((t) => (
              <li key={t.name}>
                <span className="onboard-tab-name">{t.name}</span>
                <span className="onboard-tab-desc">{t.desc}</span>
              </li>
            ))}
          </ul>

          <button className="btn btn-primary btn-block" onClick={() => setStep(2)}>
            Dalej
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen-center">
      <div className="onboard-card">
        <p className="eyebrow-tag">Ostatni krok</p>
        <h1 className="onboard-title">Jaki jest Twój główny cel?</h1>
        <p className="onboard-lede">Zobaczysz go na ekranie Start. Możesz go później zmienić w Ustawieniach.</p>

        <form className="auth-form" onSubmit={finish}>
          <label className="field">
            <span>Cel</span>
            <input
              type="text"
              placeholder="np. Zostać przedsiębiorcą"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              autoFocus
            />
          </label>

          <label className="field">
            <span>Opis (opcjonalnie)</span>
            <textarea
              rows={3}
              placeholder="Kilka zdań o tym, co to dla Ciebie znaczy"
              value={goalDescription}
              onChange={(e) => setGoalDescription(e.target.value)}
            />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="onboard-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
              Wstecz
            </button>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Zapisywanie…' : 'Zaczynamy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
