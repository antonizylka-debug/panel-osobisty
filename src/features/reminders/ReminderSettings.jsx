import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../auth/AuthContext'
import { Card, CardHead } from '../../components/ui'

const pushSupported =
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator

export default function ReminderSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState(null)
  const [permission, setPermission] = useState(pushSupported ? Notification.permission : 'unsupported')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('reminder_time, reminder_push_enabled, reminder_email_enabled, reminder_gratitude, reminder_work_hours')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setSettings(data)
      })
  }, [user.id])

  async function patch(changes) {
    const next = { ...settings, ...changes }
    setSettings(next)
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').update(changes).eq('user_id', user.id)
      if (error) throw error
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function enablePush() {
    setError('')
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') {
        setError('Bez zgody na powiadomienia nie wyślemy przypomnień.')
        return
      }
      await patch({ reminder_push_enabled: true })
    } catch (err) {
      setError(err.message)
    }
  }

  if (!settings) return null

  return (
    <Card>
      <CardHead
        title="Przypomnienia"
        hint="Wieczorem, tylko gdy brakuje wpisu"
      />

      <div className="switch-row">
        <div>
          <div className="switch-label">Godzina</div>
          <div className="switch-hint">O tej porze przyjdzie przypomnienie</div>
        </div>
        <input
          type="time"
          className="chip"
          style={{ padding: '.4rem .7rem' }}
          value={settings.reminder_time?.slice(0, 5) ?? '20:00'}
          onChange={(e) => patch({ reminder_time: e.target.value })}
        />
      </div>

      <div className="switch-row">
        <div>
          <div className="switch-label">Powiadomienia w telefonie</div>
          <div className="switch-hint">
            {permission === 'unsupported'
              ? 'Ta przeglądarka nie obsługuje powiadomień'
              : permission === 'denied'
                ? 'Zablokowane — odblokuj w ustawieniach przeglądarki'
                : 'Działa po dodaniu apki do ekranu początkowego'}
          </div>
        </div>
        {permission === 'granted' ? (
          <button
            className={'switch' + (settings.reminder_push_enabled ? ' is-on' : '')}
            aria-pressed={!!settings.reminder_push_enabled}
            aria-label="Powiadomienia push"
            onClick={() => patch({ reminder_push_enabled: !settings.reminder_push_enabled })}
          />
        ) : (
          <button className="chip is-active" onClick={enablePush}
            disabled={permission === 'unsupported' || permission === 'denied'}>
            Włącz
          </button>
        )}
      </div>

      <div className="switch-row">
        <div>
          <div className="switch-label">Przypominaj o wdzięczności</div>
          <div className="switch-hint">Tylko gdy nie ma wpisu z dziś</div>
        </div>
        <button
          className={'switch' + (settings.reminder_gratitude ? ' is-on' : '')}
          aria-pressed={!!settings.reminder_gratitude}
          aria-label="Przypomnienie o wdzięczności"
          onClick={() => patch({ reminder_gratitude: !settings.reminder_gratitude })}
        />
      </div>

      <div className="switch-row">
        <div>
          <div className="switch-label">Przypominaj o godzinach</div>
          <div className="switch-hint">Tylko gdy nie ma zapisanych godzin</div>
        </div>
        <button
          className={'switch' + (settings.reminder_work_hours ? ' is-on' : '')}
          aria-pressed={!!settings.reminder_work_hours}
          aria-label="Przypomnienie o godzinach pracy"
          onClick={() => patch({ reminder_work_hours: !settings.reminder_work_hours })}
        />
      </div>

      {error && <p className="form-error mt-1" role="alert">{error}</p>}
      {saving && <p className="muted mt-1">Zapisywanie…</p>}
    </Card>
  )
}
