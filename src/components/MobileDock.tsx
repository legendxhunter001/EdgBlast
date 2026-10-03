import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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

/** Press and hold this long, then slide: the highlight follows your finger. */
const HOLD_MS = 350;
const MOVE_CANCEL_PX = 10;
const EDGE_PX = 44;

export const MobileDock = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [holding, setHolding] = useState(false);
  const [moving, setMoving] = useState(false);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [ind, setInd] = useState({ x: 0, w: 0 });
  const [edge, setEdge] = useState({ l: false, r: true });

  const lastY = useRef(0);
  const scrollTimer = useRef<number | undefined>(undefined);
  const moveTimer = useRef<number | undefined>(undefined);
  const track = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLAnchorElement | null)[]>([]);

  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));
  const activeIndex = tabs.findIndex((t) => isActive(t.to));
  const shown = scrubIndex ?? activeIndex;

  // hide on scroll down, show on scroll up, extra glassy while moving
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (Math.abs(dy) > 6) setHidden(dy > 0 && y > 120);
      lastY.current = y;
      setScrolling(true);
      window.clearTimeout(scrollTimer.current);
      scrollTimer.current = window.setTimeout(() => setScrolling(false), 220);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // show the blurred glass edge only on the side that has more tabs
  const updateEdges = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft < el.scrollWidth - el.clientWidth - 4 });
    // icons blur + fade in proportion to how much of them is clipped by the glass edge
    const box = el.getBoundingClientRect();
    items.current.forEach((a) => {
      if (!a) return;
      const r = a.getBoundingClientRect();
      const hidden = Math.max(0, box.left - r.left, r.right - box.right) / r.width;
      a.style.setProperty('--eb', Math.min(1, hidden * 1.15).toFixed(3));
    });
  }, []);
  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [updateEdges]);

  // center the active tab on route change
  useEffect(() => {
    setHidden(false);
    items.current[activeIndex]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [pathname, activeIndex]);

  // highlight pill follows the shown tab
  const measure = useCallback(() => {
    const el = shown >= 0 ? items.current[shown] : null;
    if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
  }, [shown]);
  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // stretch animation whenever the highlight lands on a new tab
  useEffect(() => {
    setMoving(true);
    window.clearTimeout(moveTimer.current);
    moveTimer.current = window.setTimeout(() => setMoving(false), 600);
  }, [shown]);

  // hold-and-slide scrubbing (native listeners so we can block scroll once the hold starts)
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let timer: number | undefined;
    let held = false;
    let sx = 0, sy = 0;
    let current: number | null = null;

    const indexAt = (x: number, y: number) => {
      const hit = document.elementFromPoint(x, y)?.closest('a');
      const i = hit ? items.current.indexOf(hit as HTMLAnchorElement) : -1;
      return i;
    };
    const reset = () => {
      window.clearTimeout(timer);
      held = false; current = null;
      setHolding(false); setScrubIndex(null);
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        held = true;
        const i = indexAt(sx, sy);
        current = i >= 0 ? i : null;
        setHolding(true);
        setScrubIndex(current);
        navigator.vibrate?.(14);
      }, HOLD_MS);
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!held) {
        if (Math.hypot(t.clientX - sx, t.clientY - sy) > MOVE_CANCEL_PX) window.clearTimeout(timer);
        return; // normal horizontal scroll
      }
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (t.clientX < rect.left + EDGE_PX) el.scrollBy({ left: -10 });
      else if (t.clientX > rect.right - EDGE_PX) el.scrollBy({ left: 10 });
      const i = indexAt(Math.min(Math.max(t.clientX, rect.left + 2), rect.right - 2), rect.top + rect.height / 2);
      if (i >= 0 && i !== current) {
        current = i;
        setScrubIndex(i);
        navigator.vibrate?.(8);
      }
    };
    const onEnd = (e: TouchEvent) => {
      window.clearTimeout(timer);
      if (held) {
        e.preventDefault(); // block the synthetic click
        const target = current;
        reset();
        if (target !== null && !isActive(tabs[target].to)) navigate(tabs[target].to);
      }
    };
    const block = (e: Event) => { if (held) e.preventDefault(); };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: false });
    el.addEventListener('touchcancel', reset);
    el.addEventListener('contextmenu', block);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', reset);
      el.removeEventListener('contextmenu', block);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, pathname]);

  return (
    <>
      <div className={`ios-dockfade md:hidden ${hidden ? 'hide' : ''}`} aria-hidden />
      <nav
        className={`ios-dock md:hidden ${scrolling ? 'scrolling' : ''} ${hidden ? 'hide' : ''} ${holding ? 'hold' : ''} ${edge.l ? 'can-l' : ''} ${edge.r ? 'can-r' : ''}`}
        aria-label="Primary"
      >
        <div className="ios-dock-track" ref={track} onScroll={updateEdges}>
          <span
            className={`ios-dock-ind ${moving ? 'move' : ''}`}
            style={{ transform: `translateX(${ind.x}px)`, width: ind.w, opacity: shown >= 0 ? 1 : 0 }}
            aria-hidden
          />
          {tabs.map(({ to, label, icon: Icon }, i) => (
            <NavLink
              key={to}
              to={to}
              ref={(n) => { items.current[i] = n; }}
              aria-current={i === shown ? 'page' : undefined}
              draggable={false}
            >
              <Icon strokeWidth={1.9} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
};
