import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import FullScreenSpinner from '../components/FullScreenSpinner'

export default function GuestRoute() {
  const { user, profile, loading } = useAuth()

  if (loading) return <FullScreenSpinner />

  if (user) {
    return <Navigate to={profile && !profile.onboarded ? '/powitanie' : '/'} replace />
  }

  return <Outlet />
}
