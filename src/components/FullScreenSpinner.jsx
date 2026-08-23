/**
 * Ekran ladowania: znak apki rysuje sie sam, potem lekko oddycha.
 * Przy prefers-reduced-motion zostaje sam statyczny znak.
 */
function Mark({ label }) {
  return (
    <div className="loader" role="status" aria-label={label}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle className="loader-ring" cx="32" cy="32" r="27" />
        <polyline className="loader-tick" points="19,33 28,42 45,23" />
      </svg>
      <span className="loader-label">{label}</span>
    </div>
  )
}

/** Na cala wysokosc okna — logowanie, ochrona tras, start apki. */
export default function FullScreenSpinner({ label = 'Wczytywanie' }) {
  return (
    <div className="screen-center">
      <Mark label={label} />
    </div>
  )
}

/**
 * Wewnatrz zakladki, gdzie naglowek i nawigacja juz stoja.
 * Nie rozpycha sie na cala wysokosc, zeby powloka nie skakala.
 */
export function PageLoader({ label = 'Wczytywanie' }) {
  return (
    <div className="page-loader">
      <Mark label={label} />
    </div>
  )
}
