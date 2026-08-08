import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { calculatePips, currencyFlags } from '../lib/pips'

const SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF']

export default function TradingTools() {
  const { user } = useAuth()

  // Pip calculator state (journal-side calculator — this is the one that was broken)
  const [symbol, setSymbol] = useState('EURUSD')
  const [priceFrom, setPriceFrom] = useState('')
  const [priceTo, setPriceTo] = useState('')

  // Lot size calculator state (confirmed already working — kept as-is)
  const [accountBalance, setAccountBalance] = useState('')
  const [riskPercent, setRiskPercent] = useState('1')
  const [stopLossPips, setStopLossPips] = useState('')

  // Chart theme preference — independent from app theme
  const [chartTheme, setChartTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    if (!user) return
    supabase
      .from('trading_tool_preferences')
      .select('chart_theme')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.chart_theme) setChartTheme(data.chart_theme as 'dark' | 'light')
      })
  }, [user])

  const saveChartTheme = async (theme: 'dark' | 'light') => {
    setChartTheme(theme)
    if (!user) return
    await supabase.from('trading_tool_preferences').upsert({ user_id: user.id, chart_theme: theme })
  }

  const pips = priceFrom && priceTo ? calculatePips(symbol, Number(priceFrom), Number(priceTo)) : null

  const lotSize = (() => {
    const balance = Number(accountBalance)
    const risk = Number(riskPercent)
    const sl = Number(stopLossPips)
    if (!balance || !risk || !sl) return null
    const riskAmount = balance * (risk / 100)
    const pipValuePerLot = symbol.includes('JPY') ? 1000 : 10 // simplified standard-lot approximation
    return (riskAmount / (sl * pipValuePerLot)).toFixed(2)
  })()

  return (
    <div>
      <h1 className="text-2xl mb-6" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
        Trading Tools
      </h1>

      <div className="grid grid-cols-2 gap-6">
        {/* Pip calculator — the fix */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
          <h2 className="text-sm mb-4" style={{ color: 'var(--color-text)', fontWeight: 500 }}>
            Pip Calculator
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Pair
              </label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              >
                {SYMBOLS.map((s) => (
                  <option key={s} value={s}>
                    {currencyFlags(s)} {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  From price
                </label>
                <input
                  type="number"
                  step="any"
                  value={priceFrom}
                  onChange={(e) => setPriceFrom(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono"
                  style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  To price
                </label>
                <input
                  type="number"
                  step="any"
                  value={priceTo}
                  onChange={(e) => setPriceTo(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono"
                  style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
            </div>
            {pips !== null && (
              <p className="text-lg font-mono pt-2" style={{ color: pips >= 0 ? 'var(--color-teal)' : 'var(--color-danger)' }}>
                {pips >= 0 ? '+' : ''}
                {pips} pips
              </p>
            )}
          </div>
        </div>

        {/* Lot size calculator — kept as-is, already confirmed working */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
          <h2 className="text-sm mb-4" style={{ color: 'var(--color-text)', fontWeight: 500 }}>
            Lot Size Calculator
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Account balance
              </label>
              <input
                type="number"
                value={accountBalance}
                onChange={(e) => setAccountBalance(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono"
                style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  Risk %
                </label>
                <input
                  type="number"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono"
                  style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  Stop loss (pips)
                </label>
                <input
                  type="number"
                  value={stopLossPips}
                  onChange={(e) => setStopLossPips(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono"
                  style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
            </div>
            {lotSize !== null && (
              <p className="text-lg font-mono pt-2" style={{ color: 'var(--color-text)' }}>
                {lotSize} lots
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Chart theme — independent from app theme */}
      <div className="rounded-xl p-5 mt-6" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
        <h2 className="text-sm mb-3" style={{ color: 'var(--color-text)', fontWeight: 500 }}>
          Chart theme
        </h2>
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Independent from Edge Blast's app theme — set your chart background regardless of light/dark mode.
        </p>
        <div className="flex gap-2">
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              onClick={() => saveChartTheme(t)}
              className="px-3 py-1.5 rounded-full text-xs capitalize"
              style={{
                backgroundColor: chartTheme === t ? 'var(--color-teal)' : 'var(--color-elevated-2)',
                color: chartTheme === t ? '#0A0A0C' : 'var(--color-text-muted)',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
