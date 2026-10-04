import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, LayoutDashboard, ListOrdered, CalendarDays, BarChart3, NotebookPen, Sparkles,
  Compass, Plug, LineChart, Wrench, Settings, Plus,
} from 'lucide-react';

const commands = [
  { to: '/trades/new', label: 'New trade', hint: 'Action', icon: Plus },
  { to: '/', label: 'Dashboard', hint: 'Page', icon: LayoutDashboard },
  { to: '/trades', label: 'Trades', hint: 'Page', icon: ListOrdered },
  { to: '/calendar', label: 'Calendar', hint: 'Page', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', hint: 'Page', icon: BarChart3 },
  { to: '/reviews', label: 'Reviews', hint: 'Page', icon: NotebookPen },
  { to: '/ai-coach', label: 'AI Coach', hint: 'Page', icon: Sparkles },
  { to: '/journey', label: 'Journey', hint: 'Page', icon: Compass },
  { to: '/connections', label: 'Connections', hint: 'Page', icon: Plug },
  { to: '/mt5', label: 'MT5', hint: 'Page', icon: LineChart },
  { to: '/trading-tools', label: 'Trading Tools', hint: 'Page', icon: Wrench },
  { to: '/settings', label: 'Settings', hint: 'Page', icon: Settings },
];

/** Spotlight-style jump menu: ⌘K / Ctrl+K, type, Enter. */
export const CommandPalette = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => commands.filter((c) => c.label.toLowerCase().includes(q.trim().toLowerCase())),
    [q]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('eb:palette', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('eb:palette', onOpen); };
  }, []);

  useEffect(() => { if (open) { setQ(''); setSel(0); requestAnimationFrame(() => inputRef.current?.focus()); } }, [open]);
  useEffect(() => setSel(0), [q]);

  const go = (to: string) => { setOpen(false); navigate(to); };

  if (!open) return null;
  return (
    <div className="eb-palette-scrim" onClick={() => setOpen(false)} role="presentation">
      <div className="eb-palette" role="dialog" aria-label="Jump to" onClick={(e) => e.stopPropagation()}>
        <div className="eb-palette-input">
          <Search className="size-4" />
          <input
            ref={inputRef} value={q} placeholder="Jump to a page or action…" aria-label="Search"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              if (e.key === 'Enter' && results[sel]) go(results[sel].to);
            }}
          />
          <kbd>esc</kbd>
        </div>
        <div className="eb-palette-list">
          {results.length === 0 && <div className="eb-palette-empty">No results</div>}
          {results.map((c, i) => (
            <button key={c.to} className={i === sel ? 'on' : ''} onMouseEnter={() => setSel(i)} onClick={() => go(c.to)}>
              <c.icon className="size-4" /><span>{c.label}</span><em>{c.hint}</em>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
