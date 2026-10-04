import { ReactNode, Suspense, useEffect, useState } from 'react';
import { prefetchAll } from '@/lib/routes';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileDock } from './MobileDock';
import { CommandPalette } from './CommandPalette';
import { Link, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarProvider } from '@/hooks/useSidebar';

const LayoutInner = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const [focusActive, setFocusActive] = useState(false);
  useEffect(() => {
    const check = () => setFocusActive(document.body.classList.contains('eb-focus-mode'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => { prefetchAll(); }, []);

  const hideFab = pathname !== '/' || focusActive;

  return (
    <div className="min-h-screen flex w-full bg-background eb-mac-shell">
      <CommandPalette />
      <Sidebar />
      <MobileDock />
      <main className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <div key={pathname} className="animate-fade-up flex-1">
          <Suspense fallback={<div className="p-4 md:p-8 space-y-4"><div className="h-9 w-48 rounded-xl bg-muted/70 animate-pulse" /><div className="h-40 rounded-2xl bg-muted/50 animate-pulse" /></div>}>
            {children}
          </Suspense>
        </div>
      </main>
      {!hideFab && (
        <Link
          to="/trades/new"
          className={cn(
            'fixed bottom-6 md:bottom-8 right-5 md:right-8 z-30 press',
            'h-14 w-14 rounded-full bg-gradient-primary text-primary-foreground',
            'flex items-center justify-center shadow-elevated hover:shadow-lg',
            'transition-all duration-300 hover:scale-105'
          )}
          aria-label="New trade"
        >
          <Plus className="size-6" />
        </Link>
      )}
    </div>
  );
};

export const AppLayout = ({ children }: { children: ReactNode }) => (
  <SidebarProvider>
    <LayoutInner>{children}</LayoutInner>
  </SidebarProvider>
);
