import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface Trade {
  id: string
  asset: string
  direction: string
  status: string
  entry_price: number | null
  exit_price: number | null
  pnl: number | null
  entry_at: string | null
  emotional_state: string | null
  confidence_rating: number | null
  notes: string | null
}

const EMOTIONS = ['calm', 'confident', 'anxious', 'fearful', 'greedy', 'frustrated', 'excited', 'neutral']

export default function Trades() {
  const { user } = useAuth()
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('trades')
      .select('id, asset, direction, status, entry_price, exit_price, pnl, entry_at, emotional_state, confidence_rating, notes')
      .order('entry_at', { ascending: false })
      .limit(100)
    setTrades(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const updateTrade = async (id: string, patch: Partial<Trade>) => {
    setSavingId(id)
    setTrades((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    await supabase.from('trades').update(patch).eq('id', id)
    setSavingId(null)
  }

  return (
    <div>
      <h1 className="text-2xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
        Trades
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Every trade, synced from MT5 or logged manually. Click a row to edit the journal side — emotional state, confidence, and notes.
      </p>

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      ) : trades.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No trades yet — connect an MT5 account or log one manually.</p>
      ) : (
        <div className="space-y-2">
          {trades.map((t) => {
            const isEditing = editingId === t.id
            return (
              <div
                key={t.id}
                className="rounded-xl p-4"
                style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
              >
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setEditingId(isEditing ? null : t.id)}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full uppercase"
                      style={{
                        backgroundColor: t.direction === 'long' ? 'var(--color-teal)' : 'var(--color-rose)',
                        color: '#0A0A0C',
                      }}
                    >
                      {t.direction}
                    </span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{t.asset}</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {t.entry_at ? new Date(t.entry_at).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <span
                    className="font-mono text-sm"
                    style={{ color: (t.pnl ?? 0) >= 0 ? 'var(--color-teal)' : 'var(--color-danger)' }}
                  >
                    {t.pnl != null ? `${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}` : '—'}
                  </span>
                </button>

                {isEditing && (
                  <div className="mt-4 pt-4 grid grid-cols-2 gap-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                        Emotional state
                      </label>
                      <select
                        value={t.emotional_state ?? ''}
                        onChange={(e) => updateTrade(t.id, { emotional_state: e.target.value || null })}
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none capitalize"
                        style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                      >
                        <option value="">—</option>
                        {EMOTIONS.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                        Confidence (1–10)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={t.confidence_rating ?? ''}
                        onChange={(e) =>
                          updateTrade(t.id, { confidence_rating: e.target.value ? Number(e.target.value) : null })
                        }
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono"
                        style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                        Notes
                      </label>
                      <textarea
                        rows={3}
                        value={t.notes ?? ''}
                        onChange={(e) => setTrades((prev) => prev.map((x) => (x.id === t.id ? { ...x, notes: e.target.value } : x)))}
                        onBlur={(e) => updateTrade(t.id, { notes: e.target.value })}
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                        style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                      />
                    </div>
                    {savingId === t.id && (
                      <p className="col-span-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Saving…
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
