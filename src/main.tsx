import { StrictMode, useEffect, useState } from 'react'
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

// Guaranteed boot flash — runs from inside React itself once JS takes over,
// so it always plays regardless of how long the OS's own native splash
// (a flat, static icon Android generates from the manifest) stuck around first.
function BootFlash() {
  const [hide, setHide] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setHide(true), 900)
    return () => clearTimeout(t)
  }, [])
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0A0A0C',
        opacity: hide ? 0 : 1,
        visibility: hide ? 'hidden' : 'visible',
        transition: 'opacity 320ms ease, visibility 320ms ease',
        pointerEvents: hide ? 'none' : 'auto',
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 512 512" style={{ width: 96, height: 96, overflow: 'visible' }}>
        <defs>
          <linearGradient id="bootGrad" x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="#14C9AE" />
            <stop offset="100%" stopColor="#3D6FE5" />
          </linearGradient>
        </defs>
        <style>{`
          .bf-piece { opacity: 0; transform-origin: center; animation: bf-flash 480ms cubic-bezier(0.22,1,0.36,1) forwards; }
          .bf-1 { animation-delay: 0ms; } .bf-2 { animation-delay: 90ms; }
          .bf-3 { animation-delay: 180ms; } .bf-4 { animation-delay: 270ms; }
          .bf-mark { animation: bf-settle 900ms cubic-bezier(0.22,1,0.36,1) 520ms both; }
          @keyframes bf-flash {
            0% { opacity: 0; transform: scale(0.6); filter: drop-shadow(0 0 0 transparent); }
            55% { opacity: 1; transform: scale(1.12); filter: drop-shadow(0 0 10px rgba(20,201,174,0.55)); }
            100% { opacity: 1; transform: scale(1); filter: drop-shadow(0 0 0 transparent); }
          }
          @keyframes bf-settle { 0% { transform: scale(1); } 50% { transform: scale(1.045); } 100% { transform: scale(1); } }
          @media (prefers-reduced-motion: reduce) { .bf-piece, .bf-mark { animation: none !important; opacity: 1 !important; } }
        `}</style>
        <g className="bf-mark">
          <rect className="bf-piece bf-1" x="132" y="96" width="54" height="320" rx="10" fill="url(#bootGrad)" />
          <polygon className="bf-piece bf-2" points="132,96 391,125 132,154" fill="url(#bootGrad)" />
          <polygon className="bf-piece bf-3" points="132,227 351,256 132,285" fill="url(#bootGrad)" />
          <polygon className="bf-piece bf-4" points="132,358 316,387 132,416" fill="url(#bootGrad)" />
        </g>
      </svg>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {supabaseConfigError ? (
        <ConfigError message={supabaseConfigError} />
      ) : (
        <>
          <BootFlash />
          <App />
        </>
      )}
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
