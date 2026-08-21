const LABELS = ['Fatalny', 'Słaby', 'Neutralny', 'Dobry', 'Świetny']

export default function MoodPicker({ value, onChange }) {
  return (
    <div className="mood-picker">
      <div className="mood-picker-row">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={'mood-dot' + (value === n ? ' is-selected' : '')}
            aria-label={`Nastrój: ${LABELS[n - 1]}`}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <span className="mood-picker-label">{value ? LABELS[value - 1] : 'Wybierz nastrój'}</span>
    </div>
  )
}
