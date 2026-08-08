import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface Review {
  id: string
  period: string
  period_start: string
  period_end: string
  wins: string | null
  losses: string | null
  lessons: string | null
  goals: string | null
  rating: number | null
}

export default function Reviews() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const [wins, setWins] = useState('')
  const [losses, setLosses] = useState('')
  const [lessons, setLessons] = useState('')
  const [goals, setGoals] = useState('')

  const load = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('reviews').select('*').order('period_start', { ascending: false })
    setReviews((data ?? []) as Review[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleCreate = async () => {
    if (!user) return
    const now = new Date()
    const start = period === 'weekly' ? new Date(now.setDate(now.getDate() - now.getDay())) : new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date()
    await supabase.from('reviews').insert({
      user_id: user.id,
      period,
      period_start: start.toISOString().slice(0, 10),
      period_end: end.toISOString().slice(0, 10),
      wins,
      losses,
      lessons,
      goals,
    })
    setWins('')
    setLosses('')
    setLessons('')
    setGoals('')
    setShowNew(false)
    load()
  }

  return (
    <div>
      <h1 className="text-2xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
        Reviews
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Weekly and monthly reflection — what worked, what didn't, what's next.
      </p>

      <button
        onClick={() => setShowNew(!showNew)}
        className="rounded-lg px-4 py-2.5 text-sm font-medium mb-6"
        style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-blue))', color: '#0A0A0C' }}
      >
        {showNew ? 'Cancel' : '+ New Review'}
      </button>

      {showNew && (
        <div className="rounded-xl p-5 mb-6 space-y-4" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
          <div className="flex gap-2">
            {(['weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-3 py-1.5 rounded-full text-xs capitalize"
                style={{
                  backgroundColor: period === p ? 'var(--color-teal)' : 'var(--color-elevated-2)',
                  color: period === p ? '#0A0A0C' : 'var(--color-text-muted)',
                }}
              >
                {p}
              </button>
            ))}
          </div>
          {[
            { label: 'What went well', value: wins, set: setWins },
            { label: 'What went wrong', value: losses, set: setLosses },
            { label: 'Lessons learned', value: lessons, set: setLessons },
            { label: 'Goals for next period', value: goals, set: setGoals },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                {f.label}
              </label>
              <textarea
                rows={2}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
          ))}
          <button
            onClick={handleCreate}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-blue))', color: '#0A0A0C' }}
          >
            Save review
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      ) : reviews.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] px-2 py-0.5 rounded-full uppercase" style={{ backgroundColor: 'var(--color-blue)', color: '#0A0A0C' }}>
                  {r.period}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {r.period_start} → {r.period_end}
                </span>
              </div>
              {r.wins && <p className="text-sm mb-1" style={{ color: 'var(--color-text)' }}><strong>Wins:</strong> {r.wins}</p>}
              {r.losses && <p className="text-sm mb-1" style={{ color: 'var(--color-text)' }}><strong>Losses:</strong> {r.losses}</p>}
              {r.lessons && <p className="text-sm mb-1" style={{ color: 'var(--color-text)' }}><strong>Lessons:</strong> {r.lessons}</p>}
              {r.goals && <p className="text-sm" style={{ color: 'var(--color-text)' }}><strong>Goals:</strong> {r.goals}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
