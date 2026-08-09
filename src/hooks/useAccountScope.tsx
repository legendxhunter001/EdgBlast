// Compatibility shim: the canonical account-scope context lives in
// src/contexts/AccountScopeContext.tsx. This keeps older call sites working.
import { useAccountScope as useAccountScopeCtx, MT5Connection } from '@/contexts/AccountScopeContext';

export { AccountScopeProvider } from '@/contexts/AccountScopeContext';
export type Mt5Connection = MT5Connection;

export const useAccountScope = () => {
  const { connections, loading, selectedId, setSelectedId, refresh } = useAccountScopeCtx();
  return {
    scope: selectedId ?? 'all',
    setScope: (v: string) => setSelectedId(v === 'all' ? null : v),
    connections,
    isLoading: loading,
    refresh,
  };
};
