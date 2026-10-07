import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** iOS-style bottom sheet: drag handle to dismiss, Escape closes, page scroll locked. */
export const IosSheet = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => {
  const [dragY, setDragY] = useState(0);
  const start = useRef<number | null>(null);
  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [close]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={close}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className="relative w-full max-w-md bg-background rounded-t-[28px] md:rounded-[28px] px-5 max-h-[92%] overflow-auto"
        style={{
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: start.current === null ? 'transform .25s cubic-bezier(.2,.8,.2,1)' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}>
        <div className="pt-3 pb-3 -mx-5 px-5 touch-none"
          onTouchStart={(e) => { start.current = e.touches[0].clientY; }}
          onTouchMove={(e) => { if (start.current !== null) setDragY(Math.max(0, e.touches[0].clientY - start.current)); }}
          onTouchEnd={() => { if (dragY > 110) close(); else setDragY(0); start.current = null; }}>
          <div className="mx-auto w-10 h-[5px] rounded-full bg-border md:hidden mb-4" />
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[20px] font-bold">{title}</h3>
            <button onClick={close} className="text-[15px] font-semibold px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ color: 'hsl(var(--primary))' }}>Cancel</button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
};
