const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function IconStart(props) {
  return (
    <svg {...common} {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

export function IconGratitude(props) {
  return (
    <svg {...common} {...props}>
      <path d="M12 20.2s-7.8-4.7-9.7-9.4C1.1 7.6 3 4.6 6.3 4.4c1.9-.1 3.4 1 4.7 2.7C12.3 5.4 13.8 4.3 15.7 4.4c3.3.2 5.2 3.2 4 6.4-1.9 4.7-9.7 9.4-9.7 9.4Z" />
    </svg>
  )
}

export function IconExpenses(props) {
  return (
    <svg {...common} {...props}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h13A1.5 1.5 0 0 1 19 7.5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 17.5Z" />
      <path d="M3 10h16.5A1.5 1.5 0 0 1 21 11.5v5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <circle cx="16" cy="13.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconWorkHours(props) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12.5" r="8.3" />
      <path d="M12 8v4.5l3 2" />
      <path d="M9.5 2.5h5" />
    </svg>
  )
}

export function IconJournal(props) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconDoItNow(props) {
  return (
    <svg {...common} {...props}>
      <path d="M12.5 2.5 4 14h6.5l-1 7.5L20 10h-6.5Z" strokeLinejoin="round" />
    </svg>
  )
}

export function IconSun(props) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
    </svg>
  )
}

export function IconMoon(props) {
  return (
    <svg {...common} {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" strokeLinejoin="round" />
    </svg>
  )
}
