/**
 * Wykres wagi: surowe pomiary jako kropki, wygladzony trend jako linia,
 * cel jako pozioma przerywana. Rysowany recznie w SVG — bez bibliotek.
 */
export default function LineChart({ points, smooth, target, height = 150, format = (v) => v }) {
  if (points.length < 2) {
    return <p className="empty-state">Za mało pomiarów na wykres — potrzeba co najmniej dwóch.</p>
  }

  const W = 320
  const H = height
  const padL = 34
  const padR = 8
  const padT = 10
  const padB = 18

  const values = [...points.map((p) => p.value), ...smooth]
  if (target != null) values.push(target)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max - min < 1) { min -= 1; max += 1 }
  const span = max - min

  const x = (i) => padL + (i / (points.length - 1)) * (W - padL - padR)
  const y = (v) => padT + (1 - (v - min) / span) * (H - padT - padB)

  const line = smooth.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  const ticks = [max, (max + min) / 2, min]

  return (
    <div className="chart">
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Wykres wagi, od ${format(points[0].value)} do ${format(points[points.length - 1].value)}`}>

        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)}
              stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 5} y={y(t) + 3} textAnchor="end"
              fontSize="7" fill="var(--ink-faint)">{Math.round(t)}</text>
          </g>
        ))}

        {target != null && (
          <line x1={padL} y1={y(target)} x2={W - padR} y2={y(target)}
            stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8" />
        )}

        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r="2"
            fill="var(--ink-faint)" opacity="0.6">
            <title>{`${p.label}: ${format(p.value)}`}</title>
          </circle>
        ))}
      </svg>

      <div className="chart-labels">
        <span style={{ textAlign: 'left' }}>{points[0].label}</span>
        <span style={{ textAlign: 'right' }}>{points[points.length - 1].label}</span>
      </div>
    </div>
  )
}
