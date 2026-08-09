import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

type Ctx = {
  collapsed: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
};

const SidebarCtx = createContext<Ctx | null>(null);
const KEY = 'eb-sidebar-collapsed';

export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(KEY) === '1';
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const setCollapsed = useCallback((v: boolean) => setCollapsedState(v), []);
  const toggleCollapsed = useCallback(() => setCollapsedState(v => !v), []);

  return (
    <SidebarCtx.Provider value={{ collapsed, toggleCollapsed, setCollapsed, mobileOpen, setMobileOpen }}>
      {children}
    </SidebarCtx.Provider>
  );
};

export const useSidebarState = () => {
  const ctx = useContext(SidebarCtx);
  if (!ctx) throw new Error('useSidebarState must be used within SidebarProvider');
  return ctx;
};
