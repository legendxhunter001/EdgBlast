import { lazy, Suspense } from "react";
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
import { BrandLoading } from "./components/BrandLoading";

const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
import Dashboard from "./pages/Dashboard";
const NotFound = lazy(() => import("./pages/NotFound"));

import { loaders } from "./lib/routes";
const Trades = lazy(loaders.trades);
const NewTrade = lazy(loaders.newTrade);
const TradeDetail = lazy(loaders.tradeDetail);
const Calendar = lazy(loaders.calendar);
const Analytics = lazy(loaders.analytics);
const Reviews = lazy(loaders.reviews);
const Settings = lazy(loaders.settings);
const Connections = lazy(loaders.connections);
const TradingTools = lazy(loaders.tools);
const MT5 = lazy(loaders.mt5);
const AICoach = lazy(loaders.coach);
const Journey = lazy(loaders.journey);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const Shell = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute><AccountScopeProvider><AppLayout>{children}</AppLayout></AccountScopeProvider></ProtectedRoute>
);

const RootRoute = () => {
  const { session, loading } = useAuth();
  if (loading) return <BrandLoading />;
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
            <Suspense fallback={<BrandLoading />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<RootRoute />} />
              <Route path="/trades" element={<Shell><Trades /></Shell>} />
              <Route path="/trades/new" element={<Shell><NewTrade /></Shell>} />
              <Route path="/trades/:id" element={<Shell><TradeDetail /></Shell>} />
              <Route path="/calendar" element={<Shell><Calendar /></Shell>} />
              <Route path="/analytics" element={<Shell><Analytics /></Shell>} />
              <Route path="/reviews" element={<Shell><Reviews /></Shell>} />
              <Route path="/ai-coach" element={<Shell><AICoach /></Shell>} />
              <Route path="/settings" element={<Shell><Settings /></Shell>} />
              <Route path="/connections" element={<Shell><Connections /></Shell>} />
              <Route path="/trading-tools" element={<Shell><TradingTools /></Shell>} />
              <Route path="/mt5" element={<Shell><MT5 /></Shell>} />
              <Route path="/journey" element={<Shell><Journey /></Shell>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
