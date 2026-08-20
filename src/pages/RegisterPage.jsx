import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import AuthCard from '../components/AuthCard'

const ERROR_MESSAGES = {
  'User already registered': 'To konto już istnieje — spróbuj się zalogować.',
}

export default function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków.')
      return
    }
    if (password !== passwordRepeat) {
      setError('Hasła nie są takie same.')
      return
    }

    setSubmitting(true)
    try {
      await signUp(email.trim(), password)
      navigate('/sprawdz-email', { replace: true, state: { email: email.trim() } })
    } catch (err) {
      setError(ERROR_MESSAGES[err.message] ?? err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard title="Załóż konto" subtitle="Twoje dane widzisz tylko Ty — nikt inny do nich nie zajrzy.">
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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Powtórz hasło</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={passwordRepeat}
            onChange={(e) => setPasswordRepeat(e.target.value)}
          />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Zakładanie konta…' : 'Załóż konto'}
        </button>
      </form>

      <div className="auth-links">
        <Link to="/logowanie">Mam już konto</Link>
      </div>
    </AuthCard>
  )
}
