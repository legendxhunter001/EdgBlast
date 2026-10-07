import { useEffect, useRef, useState } from 'react';

/** Eases a number from its last value to the new one. Jumps straight there when reduced motion is on. */
export const useCountUp = (to: number | null, ms = 650) => {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (to === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); from.current = to; return; }
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setV(a + (to - a) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step); else from.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
};
