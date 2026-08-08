import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Auth from './pages/Auth'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Connections from './pages/Connections'
import Trades from './pages/Trades'
import CalendarPage from './pages/Calendar'
import Analytics from './pages/Analytics'
import Reviews from './pages/Reviews'
import Journey from './pages/Journey'
import TradingTools from './pages/TradingTools'
import Settings from './pages/Settings'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/connections"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Connections />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/trades" element={<ProtectedRoute><AppLayout><Trades /></AppLayout></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><AppLayout><CalendarPage /></AppLayout></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AppLayout><Analytics /></AppLayout></ProtectedRoute>} />
            <Route path="/reviews" element={<ProtectedRoute><AppLayout><Reviews /></AppLayout></ProtectedRoute>} />
            <Route path="/journey" element={<ProtectedRoute><AppLayout><Journey /></AppLayout></ProtectedRoute>} />
            <Route path="/trading-tools" element={<ProtectedRoute><AppLayout><TradingTools /></AppLayout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
