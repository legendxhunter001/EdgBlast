import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { BROKERS } from '../data/brokers'

interface MT5Connection {
  id: string
  account_number: string
  broker_server: string
  status: string
  label: string | null
  is_primary: boolean
  last_synced_at: string | null
}

export default function Connections() {
  const { user } = useAuth()
  const [connections, setConnections] = useState<MT5Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  // Add-account form state
  const [brokerQuery, setBrokerQuery] = useState('')
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null)
  const [serverQuery, setServerQuery] = useState('')
  const [selectedServer, setSelectedServer] = useState<string | null>(null)
  const [accountNumber, setAccountNumber] = useState('')
  const [password, setPassword] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadConnections = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('mt5_connections')
      .select('id, account_number, broker_server, status, label, is_primary, last_synced_at')
      .order('is_primary', { ascending: false })
    setConnections(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadConnections()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const filteredBrokers = BROKERS.filter((b) => b.name.toLowerCase().includes(brokerQuery.toLowerCase()))
  const brokerServers = BROKERS.find((b) => b.name === selectedBroker)?.servers ?? []
  const filteredServers = brokerServers.filter((s) => s.toLowerCase().includes(serverQuery.toLowerCase()))

  const resetForm = () => {
    setBrokerQuery('')
    setSelectedBroker(null)
    setServerQuery('')
    setSelectedServer(null)
    setAccountNumber('')
    setPassword('')
    setSubmitError(null)
  }

  const handleAdd = async () => {
    if (!user || !selectedServer || !accountNumber || !password) return
    setSubmitting(true)
    setSubmitError(null)
    // NOTE: actual provisioning happens via the connect-mt5 edge function
    // (MetaApi call) — not yet deployed to this independent project.
    // This inserts the connection row; wiring the edge function is the next step.
    const { error } = await supabase.from('mt5_connections').insert({
      user_id: user.id,
      account_number: accountNumber,
      broker_server: selectedServer,
      status: 'pending',
      is_primary: connections.length === 0,
    })
    setSubmitting(false)
    if (error) {
      setSubmitError(error.message)
      return
    }
    resetForm()
    setShowAdd(false)
    loadConnections()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
          MT5 Connections
        </h1>
      </div>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Manage every MT5 account feeding this journal.
      </p>

      <button
        onClick={() => setShowAdd(!showAdd)}
        className="rounded-lg px-4 py-2.5 text-sm font-medium mb-6"
        style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-blue))', color: '#0A0A0C' }}
      >
        {showAdd ? 'Cancel' : '+ Add Account'}
      </button>

      {showAdd && (
        <div
          className="rounded-xl p-5 mb-6 space-y-4"
          style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
        >
          {/* Step 1: broker search */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
              Broker
            </label>
            <input
              type="text"
              placeholder="Search brokers…"
              value={selectedBroker ?? brokerQuery}
              onChange={(e) => {
                setBrokerQuery(e.target.value)
                setSelectedBroker(null)
                setSelectedServer(null)
              }}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
            {brokerQuery && !selectedBroker && (
              <div className="mt-1 rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                {filteredBrokers.length === 0 && (
                  <p className="px-3 py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    No brokers match "{brokerQuery}"
                  </p>
                )}
                {filteredBrokers.map((b) => (
                  <button
                    key={b.name}
                    onClick={() => {
                      setSelectedBroker(b.name)
                      setBrokerQuery('')
                    }}
                    className="w-full text-left px-3 py-2 text-sm"
                    style={{ backgroundColor: 'var(--color-elevated-2)', color: 'var(--color-text)' }}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: server search, only shown once broker chosen */}
          {selectedBroker && (
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Server
              </label>
              <input
                type="text"
                placeholder="Search servers…"
                value={selectedServer ?? serverQuery}
                onChange={(e) => {
                  setServerQuery(e.target.value)
                  setSelectedServer(null)
                }}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
              {serverQuery && !selectedServer && (
                <div className="mt-1 rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                  {filteredServers.length === 0 && (
                    <p className="px-3 py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      No servers match "{serverQuery}"
                    </p>
                  )}
                  {filteredServers.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSelectedServer(s)
                        setServerQuery('')
                      }}
                      className="w-full text-left px-3 py-2 text-sm font-mono"
                      style={{ backgroundColor: 'var(--color-elevated-2)', color: 'var(--color-text)' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedServer && (
            <>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  Account number
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono"
                  style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  Investor / read-only password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
              {submitError && (
                <p role="alert" className="text-sm" style={{ color: 'var(--color-danger)' }}>
                  {submitError}
                </p>
              )}
              <button
                onClick={handleAdd}
                disabled={submitting || !accountNumber || !password}
                className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-blue))', color: '#0A0A0C' }}
              >
                {submitting ? 'Connecting…' : 'Connect account'}
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      ) : connections.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No MT5 accounts connected yet.</p>
      ) : (
        <div className="space-y-3">
          {connections.map((c) => (
            <div
              key={c.id}
              className="rounded-xl p-5"
              style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{c.label ?? 'Account'}</span>
                  {c.is_primary && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--color-blue)', color: '#0A0A0C' }}
                    >
                      PRIMARY
                    </span>
                  )}
                </div>
                <span
                  className="text-xs"
                  style={{ color: c.status === 'connected' ? 'var(--color-teal)' : 'var(--color-danger)' }}
                >
                  ● {c.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Account</p>
                  <p className="font-mono" style={{ color: 'var(--color-text)' }}>••••{c.account_number.slice(-4)}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Server</p>
                  <p className="font-mono" style={{ color: 'var(--color-text)' }}>{c.broker_server}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Last synced</p>
                  <p style={{ color: 'var(--color-text)' }}>{c.last_synced_at ?? 'never'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
