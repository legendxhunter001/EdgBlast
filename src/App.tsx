import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import { AccountScopeProvider } from "./contexts/AccountScopeContext";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Trades from "./pages/Trades";
import Calendar from "./pages/Calendar";
import Analytics from "./pages/Analytics";
import Reviews from "./pages/Reviews";
import Settings from "./pages/Settings";
import Connections from "./pages/Connections";
import TradingTools from "./pages/TradingTools";
import Journey from "./pages/Journey";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const Shell = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute><AccountScopeProvider><AppLayout>{children}</AppLayout></AccountScopeProvider></ProtectedRoute>
);

const RootRoute = () => {
  const { session, loading } = useAuth();
  if (loading) return null;
  return session ? <Shell><Dashboard /></Shell> : <Landing />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<RootRoute />} />
              <Route path="/trades" element={<Shell><Trades /></Shell>} />
              <Route path="/calendar" element={<Shell><Calendar /></Shell>} />
              <Route path="/analytics" element={<Shell><Analytics /></Shell>} />
              <Route path="/reviews" element={<Shell><Reviews /></Shell>} />
              <Route path="/settings" element={<Shell><Settings /></Shell>} />
              <Route path="/connections" element={<Shell><Connections /></Shell>} />
              <Route path="/trading-tools" element={<Shell><TradingTools /></Shell>} />
              <Route path="/journey" element={<Shell><Journey /></Shell>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
