import { useAuth } from '../auth/AuthContext'

export default function HomePage() {
  const { user, signOut } = useAuth()

  return (
    <div className="page-pad">
      <p className="eyebrow-tag">Start</p>
      <h1 className="page-title">Cześć.</h1>
      <p className="page-lede">
        Zalogowano jako {user.email}. Cel, bilans miesiąca i reszta ekranu Start pojawią się
        w kroku 10 — na razie widzisz szkielet aplikacji.
      </p>
      <button className="btn btn-ghost" onClick={signOut}>
        Wyloguj się
      </button>
    </div>
  )
}
