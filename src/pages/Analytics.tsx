import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface Trade {
  pnl: number | null
  direction: string
  asset: string
}

export default function Analytics() {
  const { user } = useAuth()
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('trades')
      .select('pnl, direction, asset')
      .eq('status', 'closed')
      .then(({ data }) => {
        setTrades((data ?? []) as Trade[])
        setLoading(false)
      })
  }, [user])

  const closed = trades.filter((t) => t.pnl != null)
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0)
  const losses = closed.filter((t) => (t.pnl ?? 0) < 0)
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0
  const avgWin = wins.length ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((s, t) => s + (t.pnl ?? 0), 0) / losses.length : 0
  const profitFactor = avgLoss !== 0 ? Math.abs((avgWin * wins.length) / (avgLoss * losses.length)) : 0

  const byAsset = new Map<string, number>()
  for (const t of closed) byAsset.set(t.asset, (byAsset.get(t.asset) ?? 0) + (t.pnl ?? 0))
  const topAssets = [...byAsset.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const stats = [
    { label: 'Win rate', value: `${winRate.toFixed(1)}%` },
    { label: 'Avg win', value: avgWin.toFixed(2), accent: 'var(--color-teal)' },
    { label: 'Avg loss', value: avgLoss.toFixed(2), accent: 'var(--color-danger)' },
    { label: 'Profit factor', value: profitFactor ? profitFactor.toFixed(2) : '—' },
  ]

  return (
    <div>
      <h1 className="text-2xl mb-6" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
        Analytics
      </h1>

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      ) : closed.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No closed trades yet — analytics will populate once you have trade history.</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl p-5"
                style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
              >
                <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  {s.label}
                </p>
                <p className="text-xl font-mono" style={{ color: s.accent ?? 'var(--color-text)' }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          <h2 className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Top pairs by net P&L
          </h2>
          <div className="space-y-2">
            {topAssets.map(([asset, pnl]) => (
              <div
                key={asset}
                className="flex items-center justify-between rounded-lg px-4 py-3"
                style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
              >
                <span style={{ color: 'var(--color-text)' }}>{asset}</span>
                <span className="font-mono text-sm" style={{ color: pnl >= 0 ? 'var(--color-teal)' : 'var(--color-danger)' }}>
                  {pnl >= 0 ? '+' : ''}
                  {pnl.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
