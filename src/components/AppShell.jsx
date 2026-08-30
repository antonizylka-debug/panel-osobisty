import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { useTheme } from '../theme/ThemeContext'
import { useAuth } from '../auth/AuthContext'
import { useLocalReminder } from '../features/reminders/useLocalReminder'
import { useSync } from '../offline/SyncContext'
import AccentMenu from './AccentMenu'
import {
  IconStart, IconGratitude, IconExpenses, IconWorkHours, IconJournal, IconDoItNow,
  IconBody, IconSun, IconMoon, IconSearch, IconSettings, IconLogout, IconLogo,
} from './icons'

const TABS = [
  { to: '/', label: 'Dashboard', Icon: IconStart, end: true },
  { to: '/wdziecznosc', label: 'Wdzięczność', Icon: IconGratitude },
  { to: '/wydatki', label: 'Wydatki', Icon: IconExpenses },
  { to: '/godziny-pracy', label: 'Godziny', Icon: IconWorkHours },
  { to: '/cialo', label: 'Zdrowie', Icon: IconBody },
  { to: '/mysli-i-cele', label: 'Notatki', Icon: IconJournal },
  { to: '/zrob-to-teraz', label: 'Fokus', Icon: IconDoItNow },
]

/** Widoczny tylko wtedy, gdy jest o czym mowic: brak sieci albo zaleglosci. */
function SyncBadge() {
  const { online, pending, syncing, sync } = useSync()

  if (online && pending === 0) return null

  return (
    <button
      className="offline-pill"
      onClick={sync}
      disabled={!online || syncing}
      title={online ? 'Kliknij, żeby zsynchronizować teraz' : 'Brak połączenia'}
    >
      {!online && 'Offline'}
      {!online && pending > 0 && ' · '}
      {pending > 0 && `niezsynchronizowane: ${pending}`}
      {online && pending > 0 && syncing && ' · wysyłam…'}
    </button>
  )
}

export default function AppShell() {
  const { resolved, toggle } = useTheme()
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  useLocalReminder(user)

  const initial = (profile?.display_name?.trim()?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()
  const name = profile?.display_name?.trim() || user?.email || ''

  async function handleLogout() {
    await signOut()
    navigate('/logowanie', { replace: true })
  }

  return (
    <div className="shell">
      <header className="shell-top">
        <Link className="shell-brand" to="/">
          <IconLogo className="shell-brand-logo" />
          Cashflow
        </Link>
        <SyncBadge />
        <div style={{ display: 'flex', gap: '.5rem', marginLeft: 'auto' }}>
          <Link className="theme-toggle mobile-only" to="/szukaj" aria-label="Szukaj">
            <IconSearch />
          </Link>
          <button
            className="theme-toggle"
            onClick={toggle}
            aria-label={resolved === 'dark' ? 'Przełącz na jasny motyw' : 'Przełącz na ciemny motyw'}
          >
            {resolved === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <Link className="theme-toggle" to="/ustawienia" aria-label="Ustawienia">
            <IconSettings />
          </Link>
          <Link className="user-avatar" to="/ustawienia" title={name}>
            {initial}
          </Link>
        </div>
      </header>

      <main className="shell-main">
        <Outlet />
      </main>

      {/* Na telefonie: dolny pasek z ikonami. Na desktopie: ciemny boczny panel
          w stylu Claude/Alair — logo, wyszukiwarka, kolor akcentu, posortowane
          menu, profil z wylogowaniem na samym dole. */}
      <nav className="bottom-nav" aria-label="Nawigacja główna">
        <Link className="side-brand" to="/">
          <IconLogo className="side-brand-dot" />
          <span className="side-brand-text">Cashflow</span>
        </Link>

        <Link className="side-search" to="/szukaj">
          <IconSearch />
          <span>Szukaj…</span>
        </Link>

        <div className="side-accent">
          <span>Kolor akcentu</span>
          <AccentMenu />
        </div>

        <span className="side-section-label">Menu</span>
        <div className="side-nav-list">
          {TABS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) => 'bottom-nav-item' + (isActive ? ' is-active' : '')}
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        <div className="side-footer">
          <Link className="side-profile" to="/ustawienia">
            <span className="side-avatar">{initial}</span>
            <span className="side-profile-text">
              <span className="side-profile-name">{name}</span>
              <span className="side-profile-sub">{resolved === 'dark' ? 'Ciemny motyw' : 'Jasny motyw'}</span>
            </span>
          </Link>
          <button className="side-logout" onClick={handleLogout} aria-label="Wyloguj" title="Wyloguj">
            <IconLogout />
          </button>
        </div>
      </nav>
    </div>
  )
}
