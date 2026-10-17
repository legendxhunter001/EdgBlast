import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Camera, Maximize2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { TV_INTERVAL, type ChartSnapshot } from '@/lib/chartSnapshots';
import { SaveViewSheet } from '@/components/chart/SaveViewSheet';
import { SavedViewsSheet } from '@/components/chart/SavedViewsSheet';

const DEFAULT_PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'GBPJPY', 'AUDUSD'];

/** Plain pair names to the symbol TradingView understands. */
const tvSymbol = (s: string) => {
  const x = s.trim().toUpperCase();
  if (!x) return 'FX:EURUSD';
  if (x.includes(':')) return x;
  if (/^(XAU|XAG)/.test(x)) return `OANDA:${x}`;
  if (/^[A-Z]{6}$/.test(x)) return `FX:${x}`;
  return x;
};

/**
 * The real TradingView chart: TradingView's own candles, full history, indicators and drawing tools (all of them
 * customisable inside the chart). Nothing is built or fetched by us. Saving keeps your screenshot of it, the pair and your notes.
 */
export const TradingViewChart = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const host = useRef<HTMLDivElement>(null);
  const [symbol, setSymbol] = useState('EURUSD');
  const [interval, setIntervalCode] = useState('60');
  const [timeframe, setTimeframe] = useState('1h');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [focus, setFocus] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase.from('trading_tool_preferences').select('favorite_symbols').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setFavorites(data?.favorite_symbols ?? []));
  }, [user?.id]);

  const config = useMemo(() => ({
    autosize: true,
    symbol: tvSymbol(symbol),
    interval,
    timezone: 'Etc/UTC',
    theme: isDark ? 'dark' : 'light',
    style: '1', // candlesticks
    locale: 'en',
    backgroundColor: isDark ? 'rgba(19,19,22,1)' : 'rgba(255,255,255,1)',
    gridColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    hide_side_toolbar: false, // the drawing tools, on phones too
    hide_top_toolbar: false,
    allow_symbol_change: true,
    withdateranges: true,
    details: false,
    hotlist: false,
    calendar: false,
    support_host: 'https://www.tradingview.com',
  }), [symbol, interval, isDark]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'tradingview-widget-container__widget';
    box.style.height = '100%';
    el.appendChild(box);
    const s = document.createElement('script');
    s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    s.type = 'text/javascript';
    s.async = true;
    s.innerHTML = JSON.stringify(config);
    el.appendChild(s);
    return () => { el.innerHTML = ''; };
  }, [config]);

  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocus(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focus]);

  const openSaved = (snap: ChartSnapshot) => {
    setSavedOpen(false);
    setSymbol(snap.symbol);
    setTimeframe(snap.timeframe);
    setIntervalCode(TV_INTERVAL[snap.timeframe] ?? '60');
  };

  const pairs = favorites.length ? favorites : DEFAULT_PAIRS;
  const btn = 'h-8 px-3 rounded-lg border text-xs flex items-center gap-1.5 transition-colors shrink-0';

  return (
    <>
      {/* one wrapper that only changes its look for full screen, so the chart is never reloaded and your drawings stay */}
      <div className={cn(focus ? 'fixed inset-0 z-[250] flex flex-col bg-background' : 'space-y-3')} style={focus ? { paddingTop: 'env(safe-area-inset-top)' } : undefined}>
        <div className={cn('flex items-center gap-2', focus && 'px-4 py-2 border-b border-border')}>
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scrollbar-thin">
            {pairs.map((p) => (
              <button key={p} onClick={() => setSymbol(p)}
                className={cn('h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors', symbol === p ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={() => setSaveOpen(true)} className={cn(btn, 'border-primary/40 bg-primary/10 text-primary font-medium')} title="Save this view">
            <Camera className="size-3.5" /> <span className="hidden sm:inline">Save view</span>
          </button>
          <button onClick={() => setSavedOpen(true)} className={cn(btn, 'border-border text-muted-foreground')} title="Saved views">
            <Bookmark className="size-3.5" /> <span className="hidden sm:inline">Saved</span>
          </button>
          <button onClick={() => setFocus((f) => !f)} className={cn(btn, 'border-border text-muted-foreground')} title={focus ? 'Exit full screen' : 'Full screen'}>
            {focus ? <X className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        </div>
        <div className={cn('overflow-hidden border border-border bg-card', focus ? 'flex-1 border-0' : 'rounded-xl')} style={focus ? undefined : { height: 'min(72vh, 680px)', minHeight: 440 }}>
          <div ref={host} className="tradingview-widget-container h-full w-full" />
        </div>
      </div>

      {saveOpen && <SaveViewSheet defaults={{ symbol: symbol.replace(/^.*:/, ''), timeframe }} onClose={() => setSaveOpen(false)} onSaved={() => setSaveOpen(false)} />}
      {savedOpen && <SavedViewsSheet onClose={() => setSavedOpen(false)} onOpenOnChart={openSaved} />}
    </>
  );
};
