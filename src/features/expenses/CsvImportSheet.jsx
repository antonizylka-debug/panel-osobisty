import { useMemo, useState } from 'react'
import { parseCsv, parseCsvAmount, parseCsvDate, guessColumns } from '../../lib/csv'
import { createExpensesBulk, CATEGORIES } from './api'
import { formatPLN } from '../../lib/money'
import { formatDatePl } from '../../lib/date'
import { Sheet, EmptyState } from '../../components/ui'

export default function CsvImportSheet({ open, existing, onClose, onDone }) {
  const [rows, setRows] = useState(null)
  const [header, setHeader] = useState([])
  const [hasHeader, setHasHeader] = useState(true)
  const [map, setMap] = useState({ date: -1, amount: -1, description: -1 })
  const [skipped, setSkipped] = useState(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setRows(null); setHeader([]); setMap({ date: -1, amount: -1, description: -1 })
    setSkipped(new Set()); setBulkCategory(''); setError('')
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const text = await file.text()
      const parsed = parseCsv(text)
      if (!parsed.length) return setError('Plik wygląda na pusty.')

      const head = parsed[0]
      setHeader(head)
      setRows(parsed)
      setMap(guessColumns(head))
      setHasHeader(true)
      setSkipped(new Set())
    } catch (err) {
      setError('Nie udało się odczytać pliku: ' + err.message)
    }
  }

  const dataRows = useMemo(() => (rows ? (hasHeader ? rows.slice(1) : rows) : []), [rows, hasHeader])

  // Duplikat = ta sama data + kwota + opis wsrod juz zapisanych wydatkow.
  const existingKeys = useMemo(() => {
    const set = new Set()
    for (const e of existing) {
      set.add(`${e.date}|${Number(e.amount).toFixed(2)}|${(e.description ?? '').trim().toLowerCase()}`)
    }
    return set
  }, [existing])

  const parsedRows = useMemo(() => {
    if (!rows || map.date < 0 || map.amount < 0) return []
    return dataRows.map((r, i) => {
      const date = parseCsvDate(r[map.date])
      const rawAmount = parseCsvAmount(r[map.amount])
      const description = map.description >= 0 ? String(r[map.description] ?? '').trim() : ''
      const amount = rawAmount == null ? null : Math.abs(rawAmount)
      const key = date && amount != null
        ? `${date}|${amount.toFixed(2)}|${description.toLowerCase()}`
        : null
      return {
        i,
        date,
        amount,
        description,
        isExpense: rawAmount != null && rawAmount < 0,
        valid: !!date && amount != null && amount > 0,
        duplicate: key ? existingKeys.has(key) : false,
      }
    })
  }, [rows, dataRows, map, existingKeys])

  const selectable = parsedRows.filter((r) => r.valid && !r.duplicate)
  const selected = selectable.filter((r) => !skipped.has(r.i))
  const duplicates = parsedRows.filter((r) => r.duplicate).length
  const invalid = parsedRows.filter((r) => !r.valid).length

  function toggle(i) {
    setSkipped((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  async function submit() {
    setError('')
    if (!selected.length) return setError('Nie zaznaczyłeś żadnej transakcji.')
    setSaving(true)
    try {
      await createExpensesBulk(selected.map((r) => ({
        amount: r.amount,
        date: r.date,
        description: r.description || null,
        type: 'receipt',
        context: 'private',
        category: bulkCategory || null,
        imported: true,
      })))
      reset()
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title="Import wyciągu CSV" onClose={() => { reset(); onClose() }}>
      <div className="stack">
        {!rows ? (
          <>
            <p className="muted">
              Wgraj plik CSV z bankowości. Każdy bank ma inny format, więc po wgraniu
              wskażesz, która kolumna jest datą, kwotą i opisem.
            </p>
            <label className="field">
              <span>Plik CSV</span>
              <input type="file" accept=".csv,text/csv" onChange={handleFile} />
            </label>
          </>
        ) : (
          <>
            <label className="switch-row" style={{ cursor: 'pointer' }}>
              <span className="switch-label">Pierwszy wiersz to nagłówki</span>
              <button type="button" className={'switch' + (hasHeader ? ' is-on' : '')}
                onClick={() => setHasHeader((v) => !v)} aria-pressed={hasHeader} />
            </label>

            <div className="field-grid">
              {[
                ['date', 'Kolumna z datą'],
                ['amount', 'Kolumna z kwotą'],
                ['description', 'Kolumna z opisem'],
              ].map(([key, label]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <select value={map[key]} onChange={(e) => setMap((m) => ({ ...m, [key]: Number(e.target.value) }))}>
                    <option value={-1}>—</option>
                    {header.map((h, i) => (
                      <option key={i} value={i}>{hasHeader ? h || `Kolumna ${i + 1}` : `Kolumna ${i + 1}`}</option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="field">
                <span>Kategoria dla wszystkich</span>
                <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
                  <option value="">—</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>

            {parsedRows.length === 0 ? (
              <EmptyState>Wskaż kolumnę z datą i kwotą, żeby zobaczyć podgląd.</EmptyState>
            ) : (
              <>
                <p className="muted">
                  {selected.length} do zaimportowania
                  {duplicates > 0 && ` · ${duplicates} duplikatów pominięto`}
                  {invalid > 0 && ` · ${invalid} nieczytelnych`}
                </p>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Data</th>
                        <th>Opis</th>
                        <th className="text-right">Kwota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 60).map((r) => (
                        <tr key={r.i} className={r.duplicate || !r.valid ? 'is-dupe' : ''}>
                          <td>
                            {r.valid && !r.duplicate && (
                              <input type="checkbox" checked={!skipped.has(r.i)} onChange={() => toggle(r.i)} />
                            )}
                          </td>
                          <td>{r.date ? formatDatePl(r.date) : '—'}</td>
                          <td>
                            {r.description || '—'}
                            {r.duplicate && <span className="badge is-warn" style={{ marginLeft: '.4rem' }}>duplikat</span>}
                          </td>
                          <td className="text-right">{r.amount != null ? formatPLN(r.amount) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 60 && (
                  <p className="muted">Podgląd pokazuje 60 pierwszych wierszy, zaimportowane zostaną wszystkie zaznaczone.</p>
                )}
              </>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}

            <div className="action-bar" style={{ marginBottom: 0 }}>
              <button className="btn btn-ghost" onClick={reset}>Wybierz inny plik</button>
              <button className="btn btn-primary" onClick={submit} disabled={saving || !selected.length}>
                {saving ? 'Importowanie…' : `Importuj ${selected.length}`}
              </button>
            </div>
          </>
        )}

        {error && !rows && <p className="form-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  )
}
