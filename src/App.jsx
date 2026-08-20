import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ThemeProvider } from './theme/ThemeContext'
import ProtectedRoute from './auth/ProtectedRoute'
import GuestRoute from './auth/GuestRoute'
import AppShell from './components/AppShell'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CheckEmailPage from './pages/CheckEmailPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import OnboardingPage from './pages/OnboardingPage'
import HomePage from './pages/HomePage'
import ComingSoonPage from './pages/ComingSoonPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            <Route element={<GuestRoute />}>
              <Route path="/logowanie" element={<LoginPage />} />
              <Route path="/rejestracja" element={<RegisterPage />} />
              <Route path="/sprawdz-email" element={<CheckEmailPage />} />
              <Route path="/zapomnialem-hasla" element={<ForgotPasswordPage />} />
            </Route>

            {/* Dostepne z linku w mailu resetujacym haslo — nie GuestRoute, bo Supabase
                zdąża zalogować sesję odzyskiwania zanim ten ekran się wyrenderuje. */}
            <Route path="/nowe-haslo" element={<ResetPasswordPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/powitanie" element={<OnboardingPage />} />

              <Route element={<AppShell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/wdziecznosc" element={<ComingSoonPage tab="Wdzięczność" step={4} />} />
                <Route path="/godziny-pracy" element={<ComingSoonPage tab="Godziny pracy" step={5} />} />
                <Route path="/godziny-pracy/nowy" element={<ComingSoonPage tab="Zapisz godziny" step={5} />} />
                <Route path="/wydatki" element={<ComingSoonPage tab="Wydatki" step={6} />} />
                <Route path="/wydatki/nowy" element={<ComingSoonPage tab="Dodaj wydatek" step={6} />} />
                <Route path="/mysli-i-cele" element={<ComingSoonPage tab="Myśli i cele" step={7} />} />
                <Route path="/zrob-to-teraz" element={<ComingSoonPage tab="Zrób to teraz" step={8} />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
