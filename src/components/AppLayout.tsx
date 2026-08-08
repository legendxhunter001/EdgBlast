import type { ReactNode } from 'react'
import Sidebar from './Sidebar'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Sidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
