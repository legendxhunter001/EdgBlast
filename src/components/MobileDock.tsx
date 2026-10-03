import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ListOrdered, CalendarDays, BarChart3, NotebookPen,
  Sparkles, Compass, LineChart, Wrench, Plug,
} from 'lucide-react';

/** Every main page lives in the dock. Settings lives in the top-bar three-dots menu. */
const tabs = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/trades', label: 'Trades', icon: ListOrdered },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/reviews', label: 'Reviews', icon: NotebookPen },
  { to: '/ai-coach', label: 'Coach', icon: Sparkles },
  { to: '/journey', label: 'Journey', icon: Compass },
  { to: '/mt5', label: 'MT5', icon: LineChart },
  { to: '/trading-tools', label: 'Tools', icon: Wrench },
  { to: '/connections', label: 'Connect', icon: Plug },
];

export const MobileDock = () => {
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const lastY = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const scroller = useRef<HTMLDivElement>(null);

  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  // hide on scroll down, show on scroll up, go extra-glassy while moving
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (Math.abs(dy) > 6) setHidden(dy > 0 && y > 120);
      lastY.current = y;
      setScrolling(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setScrolling(false), 220);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // keep the active tab centered, smoothly
  useEffect(() => {
    setHidden(false);
    scroller.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [pathname]);

  return (
    <>
      <div className={`ios-dockfade md:hidden ${hidden ? 'hide' : ''}`} aria-hidden />
      <nav className={`ios-dock md:hidden ${scrolling ? 'scrolling' : ''} ${hidden ? 'hide' : ''}`} aria-label="Primary">
        <div className="ios-dock-track" ref={scroller}>
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} aria-current={isActive(to) ? 'page' : undefined}>
              <Icon strokeWidth={1.9} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
};
