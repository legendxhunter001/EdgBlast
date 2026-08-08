import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface JournalEntry {
  id: string
  title: string
  content: string
  is_shared: boolean
  created_at: string
}

export default function Journey() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const load = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('journal_entries').select('*').order('created_at', { ascending: false })
    setEntries((data ?? []) as JournalEntry[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleCreate = async () => {
    if (!user || !title.trim()) return
    await supabase.from('journal_entries').insert({ user_id: user.id, title, content })
    setTitle('')
    setContent('')
    setShowNew(false)
    load()
  }

  return (
    <div>
      <h1 className="text-2xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
        Journey
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Your trading story, in your own words — not tied to any single trade.
      </p>

      <button
        onClick={() => setShowNew(!showNew)}
        className="rounded-lg px-4 py-2.5 text-sm font-medium mb-6"
        style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-blue))', color: '#0A0A0C' }}
      >
        {showNew ? 'Cancel' : '+ New Entry'}
      </button>

      {showNew && (
        <div className="rounded-xl p-5 mb-6 space-y-4" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
          <input
            type="text"
            placeholder="Entry title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          <textarea
            rows={6}
            placeholder="Write freely…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
            style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          <button
            onClick={handleCreate}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-blue))', color: '#0A0A0C' }}
          >
            Save entry
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No entries yet — start writing.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <div key={e.id} className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between mb-2">
                <h3 style={{ color: 'var(--color-text)', fontWeight: 500 }}>{e.title}</h3>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {new Date(e.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-muted)' }}>
                {e.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
