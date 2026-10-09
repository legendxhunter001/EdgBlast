import { Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { useLocation, useNavigate, useNavigationType, useOutlet } from 'react-router-dom';

/**
 * iOS-style page transitions.
 *  push : deeper page slides in from the right, the page underneath drifts left and dims
 *  pop  : the reverse (also for browser back and the edge-swipe)
 *  tab  : sibling pages cross-fade with a soft scale, like switching tabs
 * The shell (sidebar, dock, top bar) stays mounted; only the page animates.
 */
type Kind = 'push' | 'pop' | 'tab' | 'open' | 'close';
type Custom = { kind: Kind; scroll: number; reduce: boolean; origin: string };

/** Opening a trade zooms out of the card you tapped; going back shrinks it into place. */
const isTrade = (p: string) => /^\/trades\/(?!new$)[^/]+$/.test(p);
let lastTap = { x: 0, y: 0 };
let openOrigin = '50% 40%';

const depth = (p: string) => p.split('/').filter(Boolean).length;
const within = (child: string, parent: string) => child.startsWith(parent === '/' ? '/x' : `${parent}/`);

const classify = (from: string, to: string): Kind => {
  if (isTrade(to) && !isTrade(from)) return 'open';
  if (isTrade(from) && !isTrade(to)) return 'close';
  const a = depth(from), b = depth(to);
  if (b > a && within(to, from)) return 'push';
  if (b < a && within(from, to)) return 'pop';
  return 'tab';
};

/** Each page gets its own entrance personality for its content. */
const FLAVOR: Record<string, string> = {
  calendar: 'scale', analytics: 'scale', mt5: 'scale',
  journey: 'fade', 'ai-coach': 'fade',
  trades: 'list',
};

const SPRING = { type: 'spring', stiffness: 420, damping: 42, mass: 0.9 } as const;
const EASE = [0.2, 0.8, 0.2, 1] as const;
const EDGE = '-12px 0 40px rgba(0,0,0,.28)';
const NONE = '0 0 0 rgba(0,0,0,0)';

const variants: Variants = {
  enter: (c: Custom) =>
    c.reduce ? { opacity: 0 }
    : c.kind === 'push' ? { x: '100%', zIndex: 2, boxShadow: EDGE }
    : c.kind === 'pop' ? { x: '-28%', opacity: 0.55, zIndex: 1 }
    : c.kind === 'open' ? { opacity: 0, scale: 0.88, y: 24, zIndex: 2, transformOrigin: c.origin }
    : c.kind === 'close' ? { opacity: 0, scale: 0.97, zIndex: 1 }
    : { opacity: 0, scale: 0.985, y: 6, zIndex: 1 },
  center: (c: Custom) =>
    c.reduce ? { opacity: 1, transition: { duration: 0.14 } }
    : { x: 0, y: 0, scale: 1, opacity: 1, zIndex: 1, boxShadow: NONE, transition: c.kind === 'tab' ? { duration: 0.28, ease: EASE } : SPRING },
  exit: (c: Custom) =>
    c.reduce ? { opacity: 0, y: -c.scroll, transition: { duration: 0.1, y: { duration: 0 } } }
    : c.kind === 'push' ? { x: '-28%', y: -c.scroll, opacity: 0.55, zIndex: 1, transition: { ...SPRING, y: { duration: 0 } } }
    : c.kind === 'pop' ? { x: '100%', y: -c.scroll, zIndex: 2, boxShadow: EDGE, transition: { ...SPRING, y: { duration: 0 } } }
    : c.kind === 'open' ? { opacity: 0, scale: 0.96, y: -c.scroll, zIndex: 1, transition: { ...SPRING, y: { duration: 0 } } }
    : c.kind === 'close' ? { opacity: 0, scale: 0.9, y: -c.scroll, zIndex: 2, transformOrigin: c.origin, transition: { ...SPRING, y: { duration: 0 } } }
    : { opacity: 0, y: -c.scroll, transition: { duration: 0.14, y: { duration: 0 } } },
};

const Fallback = () => (
  <div className="p-4 md:p-8 space-y-4" aria-busy="true">
    <div className="h-9 w-48 rounded-xl bg-muted/70 animate-pulse" />
    <div className="h-40 rounded-2xl bg-muted/50 animate-pulse" />
  </div>
);

export const AnimatedOutlet = () => {
  const outlet = useOutlet();
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();
  const reduce = !!useReducedMotion();

  const scrollMap = useRef(new Map<string, number>());
  const currentPath = useRef(pathname);
  const prevPath = useRef(pathname);
  const kindRef = useRef<Kind>('tab');
  const exitScroll = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  if (prevPath.current !== pathname) {
    const k = classify(prevPath.current, pathname);
    kindRef.current = k;
    exitScroll.current = scrollMap.current.get(prevPath.current) ?? 0;
    if (kindRef.current === 'open') {
      const top = wrapRef.current ? wrapRef.current.getBoundingClientRect().top + window.scrollY : 0;
      openOrigin = `${Math.round(lastTap.x)}px ${Math.round(lastTap.y + window.scrollY - top)}px`;
    }
    prevPath.current = pathname;
  }

  useEffect(() => {
    const onDown = (e: PointerEvent) => { lastTap = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    return () => window.removeEventListener('pointerdown', onDown, { capture: true } as EventListenerOptions);
  }, []);

  // remember where each page was scrolled, restore it when you come back
  useEffect(() => {
    const onScroll = () => scrollMap.current.set(currentPath.current, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useLayoutEffect(() => {
    currentPath.current = pathname;
    window.scrollTo(0, kindRef.current === 'pop' || kindRef.current === 'close' ? scrollMap.current.get(pathname) ?? 0 : 0);
  }, [pathname]);

  // iOS edge-swipe to go back on detail pages
  useEffect(() => {
    let sx = 0, sy = 0, armed = false;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      armed = t.clientX <= 22 && depth(window.location.pathname) >= 2 && (window.history.state?.idx ?? 0) > 0;
      sx = t.clientX; sy = t.clientY;
    };
    const end = (e: TouchEvent) => {
      if (!armed) return;
      armed = false;
      const t = e.changedTouches[0];
      if (t.clientX - sx > 80 && Math.abs(t.clientY - sy) < 60) navigate(-1);
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchend', end, { passive: true });
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchend', end); };
  }, [navigate]);

  const custom: Custom = { kind: kindRef.current, scroll: exitScroll.current, reduce, origin: openOrigin };
  const seg = pathname.split('/')[1] ?? '';
  const flavor = depth(pathname) >= 2 ? 'rise' : FLAVOR[seg] ?? 'rise';

  return (
    <div ref={wrapRef} className="relative flex-1 overflow-x-clip">
      <AnimatePresence mode="popLayout" initial={false} custom={custom}>
        <motion.div key={pathname} custom={custom} variants={variants} initial="enter" animate="center" exit="exit"
          className="eb-page-in bg-background min-h-[70vh]" data-flavor={flavor}>
          <Suspense fallback={<Fallback />}>{outlet}</Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
