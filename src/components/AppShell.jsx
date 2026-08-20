import { NavLink, Outlet } from 'react-router-dom'
import { useTheme } from '../theme/ThemeContext'
import {
  IconStart, IconGratitude, IconExpenses, IconWorkHours, IconJournal, IconDoItNow,
  IconSun, IconMoon,
} from './icons'

const TABS = [
  { to: '/', label: 'Start', Icon: IconStart, end: true },
  { to: '/wdziecznosc', label: 'Wdzięczność', Icon: IconGratitude },
  { to: '/wydatki', label: 'Wydatki', Icon: IconExpenses },
  { to: '/godziny-pracy', label: 'Godziny', Icon: IconWorkHours },
  { to: '/mysli-i-cele', label: 'Myśli', Icon: IconJournal },
  { to: '/zrob-to-teraz', label: 'Teraz', Icon: IconDoItNow },
]

export default function AppShell() {
  const { resolved, toggle } = useTheme()

  return (
    <div className="shell">
      <header className="shell-top">
        <span className="shell-brand">Panel Osobisty</span>
        <button
          className="theme-toggle"
          onClick={toggle}
          aria-label={resolved === 'dark' ? 'Przełącz na jasny motyw' : 'Przełącz na ciemny motyw'}
        >
          {resolved === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
      </header>

      <main className="shell-main">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Nawigacja główna">
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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
