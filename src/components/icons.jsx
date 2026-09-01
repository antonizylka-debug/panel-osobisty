const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

/** Znaczek marki — rosnacy wykres na zaokraglonym tle, w kolorze akcentu. */
export function IconLogo(props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path d="M8 19.5 13 14.5 17 18.5 24.5 10" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24.5" cy="10" r="2.1" fill="white" />
    </svg>
  )
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

export function IconPayout(props) {
  return (
    <svg {...common} {...props}>
      <rect x="2.5" y="7" width="15" height="10" rx="2" />
      <circle cx="10" cy="12" r="2.3" />
      <path d="M15.5 4.5h4A2 2 0 0 1 21.5 6.5v8" />
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

export function IconMic(props) {
  return (
    <svg {...common} {...props}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
    </svg>
  )
}

export function IconCheck(props) {
  return (
    <svg {...common} strokeWidth={3.2} {...props}>
      <polyline points="4 12.5 9.5 18 20 6.5" />
    </svg>
  )
}

export function IconBody(props) {
  return (
    <svg {...common} {...props}>
      <path d="M6 5.5h12" />
      <path d="M4.5 3.5v4M19.5 3.5v4" />
      <path d="M9 5.5v6.5a3 3 0 0 0 6 0V5.5" />
      <path d="M12 14.5v6" />
      <path d="M8.5 20.5h7" />
    </svg>
  )
}

export function IconRest(props) {
  return (
    <svg {...common} {...props}>
      <path d="M4 11h12v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" />
      <path d="M16 12h1.8a2.2 2.2 0 1 1 0 4.4H16" />
      <path d="M7 4.5v2M10.5 4.5v2M14 4.5v2" />
    </svg>
  )
}

export function IconSearch(props) {
  return (
    <svg {...common} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.2 16.2 21 21" />
    </svg>
  )
}

export function IconLogout(props) {
  return (
    <svg {...common} {...props}>
      <path d="M9 4.5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3" />
      <path d="M13.5 8.5 17.5 12l-4 3.5" />
      <path d="M17.5 12h-10" />
    </svg>
  )
}

export function IconMore(props) {
  return (
    <svg {...common} fill="currentColor" stroke="none" {...props}>
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  )
}

export function IconEdit(props) {
  return (
    <svg {...common} {...props}>
      <path d="M15.2 3.8 20.2 8.8 8.5 20.5H3.5v-5Z" strokeLinejoin="round" />
    </svg>
  )
}

export function IconTrash(props) {
  return (
    <svg {...common} {...props}>
      <path d="M4.5 6.5h15" />
      <path d="M9 6.5v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6.5 6.5 7.3 20a1 1 0 0 0 1 1h7.4a1 1 0 0 0 1-1l.8-13.5" />
    </svg>
  )
}

/** Zwijanie bocznego panelu — pudelko z pionowa kreska, jak w Altezzy. */
export function IconCollapse(props) {
  return (
    <svg {...common} {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="3.5" />
      <path d="M9.5 4.5v15" />
      <path d="M14.5 10 12.3 12l2.2 2" />
    </svg>
  )
}

/** Medytacja — koncentryczne kregi, jak rozchodzacy sie oddech. */
export function IconMeditation(props) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 5.5a6.5 6.5 0 0 1 6.5 6.5" />
      <path d="M12 18.5A6.5 6.5 0 0 1 5.5 12" />
    </svg>
  )
}

/** Malutka strzalka w dol — rozwijane przyciski, jak "Create Activity ▾". */
export function IconChevronDown(props) {
  return (
    <svg {...common} strokeWidth={2.4} {...props}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function IconSettings(props) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9.1a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9.1a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.56 1.03Z" />
    </svg>
  )
}
