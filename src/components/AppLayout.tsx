import { ReactNode, useEffect, useRef, useState } from 'react';
import { Sidebar, MobileSidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Link, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarProvider, useSidebarState } from '@/hooks/useSidebar';

const EdgeSwipe = () => {
  const { setMobileOpen, mobileOpen } = useSidebarState();
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const tracking = useRef(false);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (mobileOpen) return;
      if (window.innerWidth >= 768) return;
      if (t.clientX <= 24) {
        startX.current = t.clientX;
        startY.current = t.clientY;
        tracking.current = true;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking.current || startX.current == null || startY.current == null) return;
      const t = e.touches[0];
      const dx = t.clientX - startX.current;
      const dy = Math.abs(t.clientY - startY.current);
      if (dx > 60 && dy < 40) {
        setMobileOpen(true);
        tracking.current = false;
      }
    };
    const onEnd = () => { tracking.current = false; startX.current = null; startY.current = null; };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [mobileOpen, setMobileOpen]);
  return null;
};

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
      <MobileSidebar />
      <EdgeSwipe />
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
