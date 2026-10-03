import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileDock } from './MobileDock';
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

  const hideFab = pathname !== '/' || focusActive;

  return (
    <div className="min-h-screen flex w-full bg-background">
      <Sidebar />
      <MobileDock />
      <main className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <div key={pathname} className="animate-fade-up flex-1">{children}</div>
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
