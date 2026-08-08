import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface DayTrade {
  id: string
  asset: string
  pnl: number | null
  entry_at: string
}

function localDateKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CalendarPage() {
  const { user } = useAuth()
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [trades, setTrades] = useState<DayTrade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString()
    const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1).toISOString()
    setLoading(true)
    // Query strictly on entry_at, matching Trades page — the earlier bug was
    // trades having entry_at set but the calendar filtering on a different field.
    supabase
      .from('trades')
      .select('id, asset, pnl, entry_at')
      .not('entry_at', 'is', null)
      .gte('entry_at', start)
      .lt('entry_at', end)
      .then(({ data }) => {
        setTrades((data ?? []) as DayTrade[])
        setLoading(false)
      })
  }, [user, monthDate])

  const byDay = useMemo(() => {
    const map = new Map<string, DayTrade[]>()
    for (const t of trades) {
      const key = localDateKey(t.entry_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    return map
  }, [trades])

  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
  const startWeekday = firstOfMonth.getDay()
  const cells: (number | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
          Calendar
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
            className="px-2 py-1 rounded-lg text-sm"
            style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
          >
            ←
          </button>
          <span className="text-sm font-mono" style={{ color: 'var(--color-text)' }}>
            {monthDate.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
            className="px-2 py-1 rounded-lg text-sm"
            style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
          >
            →
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Loading…
        </p>
      )}

      <div className="grid grid-cols-7 gap-2 text-center text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayTrades = byDay.get(key) ?? []
          const dayPnl = dayTrades.reduce((s, t) => s + (t.pnl ?? 0), 0)
          return (
            <div
              key={i}
              className="rounded-lg p-2 min-h-[64px] text-left"
              style={{
                backgroundColor: dayTrades.length ? 'var(--color-elevated)' : 'var(--color-elevated-2)',
                border: '1px solid var(--color-border)',
              }}
            >
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                {day}
              </p>
              {dayTrades.length > 0 && (
                <p
                  className="text-xs font-mono"
                  style={{ color: dayPnl >= 0 ? 'var(--color-teal)' : 'var(--color-danger)' }}
                >
                  {dayPnl >= 0 ? '+' : ''}
                  {dayPnl.toFixed(1)}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
