import { NavLink, Outlet, Link } from 'react-router-dom'
import { useTheme } from '../theme/ThemeContext'
import { useAuth } from '../auth/AuthContext'
import { useLocalReminder } from '../features/reminders/useLocalReminder'
import { useSync } from '../offline/SyncContext'
import AccentMenu from './AccentMenu'
import {
  IconStart, IconGratitude, IconExpenses, IconWorkHours, IconJournal, IconDoItNow,
  IconBody, IconSun, IconMoon, IconSearch, IconSettings,
} from './icons'

const TABS = [
  { to: '/', label: 'Start', Icon: IconStart, end: true },
  { to: '/wdziecznosc', label: 'Wdzięczność', Icon: IconGratitude },
  { to: '/wydatki', label: 'Wydatki', Icon: IconExpenses },
  { to: '/godziny-pracy', label: 'Godziny', Icon: IconWorkHours },
  { to: '/cialo', label: 'Ciało', Icon: IconBody },
  { to: '/mysli-i-cele', label: 'Myśli', Icon: IconJournal },
  { to: '/zrob-to-teraz', label: 'Teraz', Icon: IconDoItNow },
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
  const { user, profile } = useAuth()

  useLocalReminder(user)

  const initial = (profile?.display_name?.trim()?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()

  return (
    <div className="shell">
      <header className="shell-top">
        <span className="shell-brand">Panel Osobisty</span>
        <SyncBadge />
        <div style={{ display: 'flex', gap: '.5rem', marginLeft: 'auto' }}>
          <Link className="theme-toggle" to="/szukaj" aria-label="Szukaj">
            <IconSearch />
          </Link>
          <AccentMenu />
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
          <Link className="user-avatar" to="/ustawienia" title={profile?.display_name || user?.email}>
            {initial}
          </Link>
        </div>
      </header>

      <main className="shell-main">
        <Outlet />
      </main>

      {/* Ten sam element na telefonie (dolny pasek) i na desktopie (boczne menu) */}
      <nav className="bottom-nav" aria-label="Nawigacja główna">
        <span className="side-brand">Panel Osobisty</span>
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
      </nav>
    </div>
  )
}
