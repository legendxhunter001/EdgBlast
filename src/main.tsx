import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { supabaseConfigError } from './integrations/supabase/client.ts'

function ConfigError({ message }: { message: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0C', color: '#F2F2F0', padding: 24, fontFamily: 'monospace' }}>
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>Configuration error</h1>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#E2585F', background: '#131316', padding: 12, borderRadius: 8 }}>
        {message}
      </pre>
      <p style={{ fontSize: 13, marginTop: 12, color: '#8A8A93' }}>
        Set these in Vercel → Project Settings → Environment Variables, then redeploy without build cache.
      </p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {supabaseConfigError ? <ConfigError message={supabaseConfigError} /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)
