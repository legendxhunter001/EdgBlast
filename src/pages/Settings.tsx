import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type Tab = 'profile' | 'rules' | 'notifications' | 'aicoach' | 'account'

export default function Settings() {
  const { user, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('profile')

  const [displayName, setDisplayName] = useState('')
  const [timezone, setTimezone] = useState('')

  const [maxRisk, setMaxRisk] = useState('1')
  const [minRR, setMinRR] = useState('2')
  const [maxTradesDay, setMaxTradesDay] = useState('3')
  const [maxTradesWeek, setMaxTradesWeek] = useState('10')

  const [tradeSynced, setTradeSynced] = useState(true)
  const [ruleViolation, setRuleViolation] = useState(true)
  const [weeklyReport, setWeeklyReport] = useState(true)

  const [aiEnabled, setAiEnabled] = useState(true)
  const [aiFrequency, setAiFrequency] = useState('daily')
  const [aiTone, setAiTone] = useState('direct')

  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('display_name, timezone').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setDisplayName(data.display_name ?? '')
        setTimezone(data.timezone ?? '')
      }
    })
    supabase.from('trading_rules').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setMaxRisk(String(data.max_risk_pct ?? 1))
        setMinRR(String(data.min_rr ?? 2))
        setMaxTradesDay(String(data.max_trades_per_day ?? 3))
        setMaxTradesWeek(String(data.max_trades_per_week ?? 10))
      }
    })
    supabase.from('notification_settings').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setTradeSynced(data.trade_synced)
        setRuleViolation(data.rule_violation)
        setWeeklyReport(data.weekly_report)
      }
    })
    supabase.from('ai_coach_settings').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setAiEnabled(data.enabled)
        setAiFrequency(data.coaching_frequency)
        setAiTone(data.tone)
      }
    })
  }, [user])

  const flashSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const saveProfile = async () => {
    if (!user) return
    await supabase.from('profiles').upsert({ id: user.id, display_name: displayName, timezone })
    flashSaved()
  }
  const saveRules = async () => {
    if (!user) return
    await supabase.from('trading_rules').upsert({
      user_id: user.id,
      max_risk_pct: Number(maxRisk),
      min_rr: Number(minRR),
      max_trades_per_day: Number(maxTradesDay),
      max_trades_per_week: Number(maxTradesWeek),
    })
    flashSaved()
  }
  const saveNotifications = async () => {
    if (!user) return
    await supabase.from('notification_settings').upsert({
      user_id: user.id,
      trade_synced: tradeSynced,
      rule_violation: ruleViolation,
      weekly_report: weeklyReport,
    })
    flashSaved()
  }
  const saveAiCoach = async () => {
    if (!user) return
    await supabase.from('ai_coach_settings').upsert({
      user_id: user.id,
      enabled: aiEnabled,
      coaching_frequency: aiFrequency,
      tone: aiTone,
    })
    flashSaved()
  }

  const inputStyle = {
    backgroundColor: 'var(--color-elevated-2)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
  }
  const labelStyle = { color: 'var(--color-text-muted)' }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'rules', label: 'Trading Rules' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'aicoach', label: 'AI Coach' },
    { id: 'account', label: 'Account & Security' },
  ]

  return (
    <div>
      <h1 className="text-2xl mb-6" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
        Settings
      </h1>

      <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-2 text-sm -mb-px"
            style={{
              color: tab === t.id ? 'var(--color-text)' : 'var(--color-text-muted)',
              borderBottom: tab === t.id ? '2px solid var(--color-teal)' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl p-5 max-w-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
        {tab === 'profile' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5" style={labelStyle}>Display name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={labelStyle}>Timezone</label>
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g. Africa/Cairo" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
            </div>
            <button onClick={saveProfile} className="rounded-lg px-4 py-2 text-sm font-medium" style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-blue))', color: '#0A0A0C' }}>
              Save
            </button>
          </div>
        )}

        {tab === 'rules' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5" style={labelStyle}>Max risk per trade (%)</label>
                <input type="number" value={maxRisk} onChange={(e) => setMaxRisk(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={labelStyle}>Min risk:reward</label>
                <input type="number" value={minRR} onChange={(e) => setMinRR(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={labelStyle}>Max trades / day</label>
                <input type="number" value={maxTradesDay} onChange={(e) => setMaxTradesDay(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={labelStyle}>Max trades / week</label>
                <input type="number" value={maxTradesWeek} onChange={(e) => setMaxTradesWeek(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono" style={inputStyle} />
              </div>
            </div>
            <button onClick={saveRules} className="rounded-lg px-4 py-2 text-sm font-medium" style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-blue))', color: '#0A0A0C' }}>
              Save
            </button>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="space-y-3">
            {[
              { label: 'Trade synced from MT5', value: tradeSynced, set: setTradeSynced },
              { label: 'Rule violation alert', value: ruleViolation, set: setRuleViolation },
              { label: 'Weekly report', value: weeklyReport, set: setWeeklyReport },
            ].map((n) => (
              <label key={n.label} className="flex items-center justify-between text-sm" style={{ color: 'var(--color-text)' }}>
                {n.label}
                <input type="checkbox" checked={n.value} onChange={(e) => n.set(e.target.checked)} />
              </label>
            ))}
            <button onClick={saveNotifications} className="rounded-lg px-4 py-2 text-sm font-medium mt-2" style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-blue))', color: '#0A0A0C' }}>
              Save
            </button>
          </div>
        )}

        {tab === 'aicoach' && (
          <div className="space-y-4">
            <label className="flex items-center justify-between text-sm" style={{ color: 'var(--color-text)' }}>
              Enable AI coach
              <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
            </label>
            <div>
              <label className="block text-xs mb-1.5" style={labelStyle}>Frequency</label>
              <select value={aiFrequency} onChange={(e) => setAiFrequency(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="off">Off</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={labelStyle}>Tone</label>
              <select value={aiTone} onChange={(e) => setAiTone(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle}>
                <option value="direct">Direct</option>
                <option value="encouraging">Encouraging</option>
                <option value="analytical">Analytical</option>
              </select>
            </div>
            <button onClick={saveAiCoach} className="rounded-lg px-4 py-2 text-sm font-medium" style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-blue))', color: '#0A0A0C' }}>
              Save
            </button>
          </div>
        )}

        {tab === 'account' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs mb-1" style={labelStyle}>Email</p>
              <p className="text-sm font-mono" style={{ color: 'var(--color-text)' }}>{user?.email}</p>
            </div>
            <button onClick={() => signOut()} className="rounded-lg px-4 py-2 text-sm font-medium" style={{ backgroundColor: 'var(--color-danger)', color: '#0A0A0C' }}>
              Sign out
            </button>
          </div>
        )}

        {saved && (
          <p className="text-xs mt-3" style={{ color: 'var(--color-teal)' }}>
            Saved.
          </p>
        )}
      </div>
    </div>
  )
}
