import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

const navSections: { label?: string; items: { to: string; label: string }[] }[] = [
  {
    items: [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/trades', label: 'Trades' },
      { to: '/calendar', label: 'Calendar' },
      { to: '/analytics', label: 'Analytics' },
      { to: '/reviews', label: 'Reviews' },
    ],
  },
  { label: 'Journey', items: [{ to: '/journey', label: 'Journey' }] },
  { label: 'Connections', items: [{ to: '/connections', label: 'Connections' }] },
  { label: 'Trading Tools', items: [{ to: '/trading-tools', label: 'Trading Tools' }] },
  { items: [{ to: '/settings', label: 'Settings' }] },
]

function linkStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'block',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '14px',
    color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
    backgroundColor: isActive ? 'var(--color-elevated-2)' : 'transparent',
    fontWeight: isActive ? 500 : 400,
  }
}

export default function Sidebar() {
  const { signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <aside
      className="w-56 shrink-0 h-screen sticky top-0 flex flex-col p-4"
      style={{ backgroundColor: 'var(--color-elevated)', borderRight: '1px solid var(--color-border)' }}
    >
      <div className="mb-6 px-2">
        <span className="text-lg" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
          Edge Blast
        </span>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto">
        {navSections.map((section, i) => (
          <div key={i}>
            {section.label && (
              <div
                className="px-3 pb-1 text-[10px] tracking-wider uppercase"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} style={({ isActive }) => linkStyle(isActive)}>
                  {item.label}
                </NavLink>
              ))}
            </div>
            {i < navSections.length - 1 && (
              <div className="my-3" style={{ borderTop: '1px solid var(--color-border)' }} />
            )}
          </div>
        ))}
      </nav>

      <div className="pt-3 space-y-1" style={{ borderTop: '1px solid var(--color-border)' }}>
        <button
          onClick={toggleTheme}
          className="w-full text-left px-3 py-2 rounded-lg text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        </button>
        <button
          onClick={() => signOut()}
          className="w-full text-left px-3 py-2 rounded-lg text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
