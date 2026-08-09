import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MT5Connection {
  id: string;
  account_number: string;
  broker_server: string;
  label: string | null;
  status: "connecting" | "connected" | "error" | "disconnected";
  is_primary: boolean;
  last_synced_at: string | null;
}

interface AccountScopeContextValue {
  connections: MT5Connection[];
  loading: boolean;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selectedConnection: MT5Connection | null;
  refresh: () => Promise<void>;
}

const AccountScopeContext = createContext<AccountScopeContextValue | undefined>(undefined);

export function AccountScopeProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<MT5Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("eb-account-scope") || null;
  });

  const setSelectedId = (id: string | null) => {
    setSelectedIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem("eb-account-scope", id);
      else window.localStorage.removeItem("eb-account-scope");
    }
  };

  const refresh = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setConnections([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("mt5_connections")
      .select("id, account_number, broker_server, label, status, is_primary, last_synced_at")
      .eq("user_id", user.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    const rows = (data ?? []) as MT5Connection[];
    setConnections(rows);

    if (selectedId && !rows.some((r) => r.id === selectedId)) {
      setSelectedId(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedConnection = selectedId ? connections.find((c) => c.id === selectedId) ?? null : null;

  return (
    <AccountScopeContext.Provider
      value={{ connections, loading, selectedId, setSelectedId, selectedConnection, refresh }}
    >
      {children}
    </AccountScopeContext.Provider>
  );
}

export function useAccountScope() {
  const ctx = useContext(AccountScopeContext);
  if (!ctx) throw new Error("useAccountScope must be used within an AccountScopeProvider");
  return ctx;
}

export function applyAccountScope<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  selectedId: string | null,
): T {
  return selectedId ? query.eq("mt5_connection_id", selectedId) : query;
}
