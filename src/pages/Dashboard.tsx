import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface Stats {
  totalTrades: number
  openTrades: number
  totalPnl: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('trades')
      .select('status, pnl')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!data) return
        setStats({
          totalTrades: data.length,
          openTrades: data.filter((t) => t.status === 'open').length,
          totalPnl: data.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0),
        })
      })
  }, [user])

  const cards = [
    { label: 'Total trades', value: stats?.totalTrades ?? '—' },
    { label: 'Open positions', value: stats?.openTrades ?? '—' },
    {
      label: 'Total P&L',
      value: stats ? `${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}` : '—',
      accent: stats && stats.totalPnl >= 0 ? 'var(--color-teal)' : 'var(--color-danger)',
    },
  ]

  return (
    <div>
      <h1 className="text-2xl mb-6" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
        Dashboard
      </h1>
      <div className="grid grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl p-5"
            style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
          >
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
              {card.label}
            </p>
            <p
              className="text-2xl"
              style={{ fontFamily: 'var(--font-mono)', color: card.accent ?? 'var(--color-text)' }}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
