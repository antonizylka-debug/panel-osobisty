import { Link, useLocation } from 'react-router-dom'
import AuthCard from '../components/AuthCard'

export default function CheckEmailPage() {
  const location = useLocation()
  const email = location.state?.email

  return (
    <AuthCard title="Sprawdź skrzynkę">
      <p className="auth-body">
        Wysłaliśmy link potwierdzający{email ? <> na <strong>{email}</strong></> : ''}.
        Kliknij go, żeby dokończyć zakładanie konta.
      </p>
      <div className="auth-links">
        <Link to="/logowanie">Wróć do logowania</Link>
      </div>
    </AuthCard>
  )
}
