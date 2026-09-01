import { useMemo, useState } from 'react'
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../theme/ThemeContext'
import { useAuth } from '../auth/AuthContext'
import { useLocalReminder } from '../features/reminders/useLocalReminder'
import { useSync } from '../offline/SyncContext'
import AccentMenu from './AccentMenu'
import {
  IconStart, IconGratitude, IconExpenses, IconWorkHours, IconJournal, IconDoItNow,
  IconBody, IconSun, IconMoon, IconSearch, IconSettings, IconLogout, IconLogo, IconCollapse,
} from './icons'

/** Zakladki pogrupowane w sekcje — jak CRM/CLIENTS/ACTIVITY w bocznym panelu Altezzy. */
const NAV_GROUPS = [
  {
    label: 'Główne',
    items: [{ to: '/', label: 'Dashboard', Icon: IconStart, end: true }],
  },
  {
    label: 'Finanse',
    items: [
      { to: '/wydatki', label: 'Wydatki', Icon: IconExpenses },
      { to: '/godziny-pracy', label: 'Godziny', Icon: IconWorkHours },
    ],
  },
  {
    label: 'Osobiste',
    items: [
      { to: '/wdziecznosc', label: 'Wdzięczność', Icon: IconGratitude },
      { to: '/cialo', label: 'Zdrowie', Icon: IconBody },
      { to: '/mysli-i-cele', label: 'Notatki', Icon: IconJournal },
    ],
  },
  {
    label: 'Produktywność',
    items: [{ to: '/zrob-to-teraz', label: 'Fokus', Icon: IconDoItNow }],
  },
]

/** Etykiety do okruszkow w gornym pasku — obejmuje tez ekrany spoza menu bocznego. */
const PAGE_LABELS = {
  '/': 'Dashboard',
  '/wdziecznosc': 'Wdzięczność',
  '/wydatki': 'Wydatki',
  '/godziny-pracy': 'Godziny pracy',
  '/cialo': 'Zdrowie',
  '/mysli-i-cele': 'Notatki',
  '/zrob-to-teraz': 'Fokus',
  '/przeglad-tygodnia': 'Przegląd tygodnia',
  '/ulubione': 'Ulubione',
  '/szukaj': 'Szukaj',
  '/ustawienia': 'Ustawienia',
}

function useBreadcrumbLabel() {
  const { pathname } = useLocation()
  return useMemo(() => {
    if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname]
    const match = Object.keys(PAGE_LABELS)
      .filter((path) => path !== '/' && pathname.startsWith(path))
      .sort((a, b) => b.length - a.length)[0]
    return match ? PAGE_LABELS[match] : 'Dashboard'
  }, [pathname])
}

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
  const [collapsed, setCollapsed] = useState(false)
  const breadcrumb = useBreadcrumbLabel()

  useLocalReminder(user)

  const initial = (profile?.display_name?.trim()?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()
  const name = profile?.display_name?.trim() || user?.email || ''

  async function handleLogout() {
    await signOut()
    navigate('/logowanie', { replace: true })
  }

  return (
    <div className={'shell' + (collapsed ? ' is-nav-collapsed' : '')}>
      <header className="shell-top">
        <Link className="shell-brand" to="/">
          <IconLogo className="shell-brand-logo" />
          Cashflow
        </Link>

        <div className="shell-breadcrumb">
          <span>Panel</span>
          <span className="shell-breadcrumb-sep">/</span>
          <b>{breadcrumb}</b>
        </div>

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

      {/* Na telefonie: dolny pasek z ikonami. Na desktopie: ciemny granatowy panel
          boczny z sekcjami — logo, wyszukiwarka, kolor akcentu, pogrupowane menu,
          profil z wylogowaniem na samym dole. Ten sam element <nav>, tylko inaczej
          ulozony przez CSS; bez duplikowania linkow. */}
      <nav className={'bottom-nav' + (collapsed ? ' is-collapsed' : '')} aria-label="Nawigacja główna">
        <div className="side-brand-row">
          <Link className="side-brand" to="/">
            <IconLogo className="side-brand-dot" />
            <span className="side-brand-text">Cashflow</span>
          </Link>
          <button
            type="button"
            className="side-collapse-toggle desktop-only"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Rozwiń panel' : 'Zwiń panel'}
            title={collapsed ? 'Rozwiń panel' : 'Zwiń panel'}
          >
            <IconCollapse />
          </button>
        </div>

        <Link className="side-search" to="/szukaj">
          <IconSearch />
          <span>Szukaj…</span>
        </Link>

        <div className="side-accent">
          <span className="side-accent-label">Kolor akcentu</span>
          <AccentMenu />
        </div>

        {NAV_GROUPS.map((group) => (
          <div className="side-nav-group" key={group.label}>
            <span className="side-section-label">{group.label}</span>
            <div className="side-nav-list">
              {group.items.map(({ to, label, Icon, end }) => (
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
          </div>
        ))}

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
