import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

type Mode = 'password' | 'otp-request' | 'otp-verify'

export default function Auth() {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { signIn, signUp, signInWithGoogle, sendOtp, verifyOtp } = useAuth()
  const navigate = useNavigate()

  const inputStyle = {
    backgroundColor: 'var(--color-elevated-2)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
  }

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = authMode === 'signin' ? await signIn(email, password) : await signUp(email, password)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    navigate('/dashboard')
  }

  const handleGoogle = async () => {
    setError(null)
    const result = await signInWithGoogle()
    if (result.error) setError(result.error)
    // On success, Supabase redirects the browser to Google — no further action here.
  }

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await sendOtp(email)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setInfo(`Code sent to ${email}`)
    setMode('otp-verify')
  }

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await verifyOtp(email, otpCode)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
            Edge Blast
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {mode === 'otp-verify' ? 'Enter the code we sent you' : authMode === 'signin' ? 'Sign in to your journal' : 'Create your account'}
          </p>
        </div>

        <div className="rounded-xl p-6 space-y-4" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
          {/* Google OAuth — always available, one tap */}
          {mode !== 'otp-verify' && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium"
                style={{ backgroundColor: 'var(--color-elevated-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              >
                <svg width="16" height="16" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35.4 27 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.5 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-3.5z" />
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>or</span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('password')}
                  className="flex-1 py-1.5 rounded-lg text-xs"
                  style={{
                    backgroundColor: mode === 'password' ? 'var(--color-teal)' : 'var(--color-elevated-2)',
                    color: mode === 'password' ? '#0A0A0C' : 'var(--color-text-muted)',
                  }}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setMode('otp-request')}
                  className="flex-1 py-1.5 rounded-lg text-xs"
                  style={{
                    backgroundColor: mode === 'otp-request' ? 'var(--color-teal)' : 'var(--color-elevated-2)',
                    color: mode === 'otp-request' ? '#0A0A0C' : 'var(--color-text-muted)',
                  }}
                >
                  Email code
                </button>
              </div>
            </>
          )}

          {mode === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Email</label>
                <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="password" className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Password</label>
                <input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
              </div>
              {error && <p role="alert" className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>}
              <button type="submit" disabled={submitting} className="w-full rounded-lg py-2.5 text-sm font-medium disabled:opacity-60" style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-blue))', color: '#0A0A0C' }}>
                {submitting ? 'Please wait…' : authMode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
              <button type="button" onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')} className="w-full text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {authMode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <span style={{ color: 'var(--color-teal)' }}>{authMode === 'signin' ? 'Sign up' : 'Sign in'}</span>
              </button>
            </form>
          )}

          {mode === 'otp-request' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label htmlFor="otp-email" className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Email</label>
                <input id="otp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
              </div>
              {error && <p role="alert" className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>}
              <button type="submit" disabled={submitting} className="w-full rounded-lg py-2.5 text-sm font-medium disabled:opacity-60" style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-blue))', color: '#0A0A0C' }}>
                {submitting ? 'Sending…' : 'Send code'}
              </button>
            </form>
          )}

          {mode === 'otp-verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {info && <p className="text-sm" style={{ color: 'var(--color-teal)' }}>{info}</p>}
              <div>
                <label htmlFor="otp-code" className="block text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>6-digit code</label>
                <input id="otp-code" type="text" inputMode="numeric" required value={otpCode} onChange={(e) => setOtpCode(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono tracking-widest text-center" style={inputStyle} />
              </div>
              {error && <p role="alert" className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>}
              <button type="submit" disabled={submitting} className="w-full rounded-lg py-2.5 text-sm font-medium disabled:opacity-60" style={{ background: 'linear-gradient(135deg, var(--color-teal), var(--color-blue))', color: '#0A0A0C' }}>
                {submitting ? 'Verifying…' : 'Verify & sign in'}
              </button>
              <button type="button" onClick={() => { setMode('otp-request'); setError(null); setInfo(null) }} className="w-full text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
