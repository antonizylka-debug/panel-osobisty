import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import FullScreenSpinner from '../components/FullScreenSpinner'

export default function ProtectedRoute() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenSpinner />

  if (!user) {
    return <Navigate to="/logowanie" replace state={{ from: location }} />
  }

  if (profile && !profile.onboarded && location.pathname !== '/powitanie') {
    return <Navigate to="/powitanie" replace />
  }

  return <Outlet />
}
