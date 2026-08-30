import { useState } from 'react'
import { createDebt, deleteDebt, updateDebt, togglePayment, debtProgress } from './api'
import { formatPLN, parseAmount } from '../../lib/money'
import { todayISO, addMonthsISO, formatDatePl } from '../../lib/date'
import { Card, CardHead, ProgressBar, EmptyState, Sheet, Kebab } from '../../components/ui'
import { IconEdit, IconTrash } from '../../components/icons'

function currentMonthKey(today) {
  return today.slice(0, 8) + '01'
}

export default function DebtsSection({ debts, payments, onChanged }) {
  const [addOpen, setAddOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const today = todayISO()
  const monthKey = currentMonthKey(today)

  const active = debts.filter((d) => d.active)
  const monthlyTotal = active.reduce((s, d) => s + Number(d.monthly_payment), 0)

  async function handleTogglePaid(debt) {
    const existing = payments.find((p) => p.debt_id === debt.id && p.month === monthKey)
    await togglePayment({
      debtId: debt.id,
      month: monthKey,
      paid: !existing?.paid,
      paidDate: today,
    })
    onChanged()
  }

  return (
    <>
      <Card>
        <CardHead
          title="Spłaty i zobowiązania"
          hint={active.length ? `${active.length} aktywnych · ${formatPLN(monthlyTotal)}/mies.` : 'Brak zobowiązań'}
          action={<button className="chip is-active" onClick={() => setAddOpen(true)}>Dodaj</button>}
        />

        {active.length === 0 ? (
          <EmptyState>Nie masz aktywnych zobowiązań.</EmptyState>
        ) : (
          <ul className="row-list">
            {active.map((debt) => {
              const prog = debtProgress(debt, payments)
              const paidThisMonth = payments.find((p) => p.debt_id === debt.id && p.month === monthKey)?.paid
              return (
                <li key={debt.id}>
                  <div className="entry">
                    <div className="entry-head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flex: 1, minWidth: 0 }}>
                        <button className="row-title" onClick={() => setDetail(debt)}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit', fontWeight: 700 }}>
                          {debt.name}
                        </button>
                        <span className="row-value">{formatPLN(debt.monthly_payment)}</span>
                      </div>
                      <Kebab items={[
                        { label: 'Edytuj', icon: <IconEdit />, onClick: () => setDetail(debt) },
                        {
                          label: 'Usuń', icon: <IconTrash />, tone: 'danger',
                          onClick: async () => { await deleteDebt(debt.id); onChanged() },
                        },
                      ]} />
                    </div>
                    <div style={{ margin: '.6rem 0 .4rem' }}>
                      <ProgressBar value={prog.paidAmount} max={prog.total} />
                    </div>
                    <div className="entry-head">
                      <span className="row-sub">
                        {formatPLN(prog.paidAmount, { short: true })} z {formatPLN(prog.total, { short: true })}
                        {debt.end_date && ` · do ${formatDatePl(debt.end_date)}`}
                      </span>
                      <button
                        className={'chip' + (paidThisMonth ? ' is-active' : '')}
                        onClick={() => handleTogglePaid(debt)}
                      >
                        {paidThisMonth ? 'Zapłacona ✓' : 'Oznacz jako zapłaconą'}
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <AddDebtSheet open={addOpen} onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); onChanged() }} />

      <Sheet open={!!detail} title={detail?.name ?? ''} onClose={() => setDetail(null)}>
        {detail && (
          <div className="stack">
            <p className="muted">
              Rata {formatPLN(detail.monthly_payment)} miesięcznie
              {detail.end_date && <> · jeszcze do {formatDatePl(detail.end_date)}</>}
            </p>
            <button className="btn btn-ghost btn-block" onClick={async () => {
              await updateDebt(detail.id, { active: false })
              setDetail(null); onChanged()
            }}>Oznacz jako spłacone</button>
            <button className="btn btn-ghost btn-block" style={{ color: 'var(--danger)' }} onClick={async () => {
              await deleteDebt(detail.id)
              setDetail(null); onChanged()
            }}>Usuń zobowiązanie</button>
          </div>
        )}
      </Sheet>
    </>
  )
}

function AddDebtSheet({ open, onClose, onDone }) {
  const [form, setForm] = useState({ name: '', monthly_payment: '', months_left: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    const monthly = parseAmount(form.monthly_payment)
    const months = Number(form.months_left)
    if (!form.name.trim()) return setError('Podaj nazwę.')
    if (!monthly || monthly <= 0) return setError('Podaj miesięczną ratę.')
    if (!months || months <= 0) return setError('Podaj, ile miesięcy jeszcze zostało.')

    setSaving(true)
    try {
      const today = todayISO()
      await createDebt({
        name: form.name.trim(),
        monthly_payment: monthly,
        total_amount: monthly * months,
        start_date: today,
        end_date: addMonthsISO(today, months),
        payment_day: Math.min(28, Number(today.slice(8))),
      })
      setForm({ name: '', monthly_payment: '', months_left: '' })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title="Nowe zobowiązanie" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Nazwa</span>
          <input type="text" placeholder="np. Rata za PC" value={form.name} onChange={set('name')} />
        </label>
        <div className="field-grid">
          <label className="field">
            <span>Rata miesięczna</span>
            <input type="text" inputMode="decimal" value={form.monthly_payment} onChange={set('monthly_payment')} />
          </label>
          <label className="field">
            <span>Ile miesięcy jeszcze</span>
            <input type="number" min="1" inputMode="numeric" value={form.months_left} onChange={set('months_left')} />
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Zapisywanie…' : 'Dodaj'}
        </button>
      </form>
    </Sheet>
  )
}
