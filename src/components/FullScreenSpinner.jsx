/**
 * Ekran ladowania: znak apki rysuje sie sam, potem lekko oddycha.
 * Przy prefers-reduced-motion zostaje sam statyczny znak.
 */
export default function FullScreenSpinner({ label = 'Wczytywanie' }) {
  return (
    <div className="screen-center">
      <div className="loader" role="status" aria-label={label}>
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle className="loader-ring" cx="32" cy="32" r="27" />
          <polyline className="loader-tick" points="19,33 28,42 45,23" />
        </svg>
        <span className="loader-label">{label}</span>
      </div>
    </div>
  )
}
