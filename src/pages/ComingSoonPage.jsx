export default function ComingSoonPage({ tab, step }) {
  return (
    <div className="page-pad">
      <p className="eyebrow-tag">Krok {step} z 14</p>
      <h1 className="page-title">{tab}</h1>
      <p className="page-lede">Ta zakładka jeszcze nie jest gotowa — budujemy ją w kroku {step}.</p>
    </div>
  )
}
