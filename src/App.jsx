import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ThemeProvider } from './theme/ThemeContext'
import { SyncProvider } from './offline/SyncContext'
import ProtectedRoute from './auth/ProtectedRoute'
import GuestRoute from './auth/GuestRoute'
import AppShell from './components/AppShell'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CheckEmailPage from './pages/CheckEmailPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import OnboardingPage from './pages/OnboardingPage'

import StartPage from './features/start/StartPage'
import GratitudePage from './features/gratitude/GratitudePage'
import WorkPage from './features/work/WorkPage'
import ExpensesPage from './features/expenses/ExpensesPage'
import JournalPage from './features/journal/JournalPage'
import ProcrastinationPage from './features/procrastination/ProcrastinationPage'
import BodyPage from './features/body/BodyPage'
import WeeklyReviewPage from './features/extras/WeeklyReviewPage'
import FavoritesPage from './features/extras/FavoritesPage'
import SearchPage from './features/extras/SearchPage'
import SettingsPage from './features/settings/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <SyncProvider>
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
                <Route path="/" element={<StartPage />} />
                <Route path="/wdziecznosc" element={<GratitudePage />} />
                <Route path="/godziny-pracy" element={<WorkPage />} />
                <Route path="/godziny-pracy/nowy" element={<WorkPage />} />
                <Route path="/wydatki" element={<ExpensesPage />} />
                <Route path="/wydatki/nowy" element={<ExpensesPage />} />
                <Route path="/cialo" element={<BodyPage />} />
                <Route path="/mysli-i-cele" element={<JournalPage />} />
                <Route path="/zrob-to-teraz" element={<ProcrastinationPage />} />
                <Route path="/przeglad-tygodnia" element={<WeeklyReviewPage />} />
                <Route path="/ulubione" element={<FavoritesPage />} />
                <Route path="/szukaj" element={<SearchPage />} />
                <Route path="/ustawienia" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </SyncProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
