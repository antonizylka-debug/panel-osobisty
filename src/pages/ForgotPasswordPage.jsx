import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import AuthCard from '../components/AuthCard'

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await sendPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthCard title="Sprawdź skrzynkę">
        <p className="auth-body">
          Jeśli konto na <strong>{email}</strong> istnieje, wysłaliśmy link do zmiany hasła.
        </p>
        <div className="auth-links">
          <Link to="/logowanie">Wróć do logowania</Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Nie pamiętasz hasła?" subtitle="Wyślemy Ci link do ustawienia nowego.">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>E-mail</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Wysyłanie…' : 'Wyślij link'}
        </button>
      </form>

      <div className="auth-links">
        <Link to="/logowanie">Wróć do logowania</Link>
      </div>
    </AuthCard>
  )
}
