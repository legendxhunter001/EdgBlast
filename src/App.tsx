import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { AppLayout } from "./components/AppLayout";
import { AccountScopeProvider } from "./contexts/AccountScopeContext";
import { BrandLoading } from "./components/BrandLoading";
import { AnimatedOutlet } from "./components/PageTransition";

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

/** One persistent shell for every signed-in page: only the page inside animates, the dock and sidebar never remount. */
const ShellLayout = () => {
  const { session, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <BrandLoading />;
  if (!session) return pathname === "/" ? <Landing /> : <Navigate to="/auth" replace />;
  return <AccountScopeProvider><AppLayout><AnimatedOutlet /></AppLayout></AccountScopeProvider>;
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
              <Route element={<ShellLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/trades" element={<Trades />} />
                <Route path="/trades/new" element={<NewTrade />} />
                <Route path="/trades/:id" element={<TradeDetail />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/reviews" element={<Reviews />} />
                <Route path="/ai-coach" element={<AICoach />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/connections" element={<Connections />} />
                <Route path="/trading-tools" element={<TradingTools />} />
                <Route path="/mt5" element={<MT5 />} />
                <Route path="/journey" element={<Journey />} />
              </Route>
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
