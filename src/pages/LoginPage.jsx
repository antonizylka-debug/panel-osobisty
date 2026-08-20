import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import AuthCard from '../components/AuthCard'

const ERROR_MESSAGES = {
  'Invalid login credentials': 'Zły e-mail albo hasło.',
  'Email not confirmed': 'Potwierdź najpierw adres e-mail — sprawdź skrzynkę.',
}

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      navigate(location.state?.from?.pathname ?? '/', { replace: true })
    } catch (err) {
      setError(ERROR_MESSAGES[err.message] ?? err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard title="Witaj z powrotem" subtitle="Zaloguj się do swojego panelu.">
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

        <label className="field">
          <span>Hasło</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Logowanie…' : 'Zaloguj się'}
        </button>
      </form>

      <div className="auth-links">
        <Link to="/zapomnialem-hasla">Nie pamiętam hasła</Link>
        <Link to="/rejestracja">Załóż konto</Link>
      </div>
    </AuthCard>
  )
}
