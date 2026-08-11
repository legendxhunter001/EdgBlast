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

// Register the service worker — production only, so local dev always gets
// fresh code with no stale caching to fight against.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal — the app works fine without offline support.
    })
  })
}

// Let the boot splash's flash-in animation finish (~1.4s) before removing it,
// so a fast connection doesn't cut the animation short.
const splash = document.getElementById('boot-splash')
if (splash) {
  window.setTimeout(() => {
    splash.classList.add('hide')
    window.setTimeout(() => splash.remove(), 350)
  }, 1200)
}
