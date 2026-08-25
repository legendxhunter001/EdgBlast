import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart, ColorType, CrosshairMode,
  IChartApi, ISeriesApi, CandlestickSeries, IPriceLine, Time,
} from 'lightweight-charts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { functionErrorMessage } from '@/lib/functionError';
import { toast } from 'sonner';
import {
  MousePointer2, TrendingUp, Minus, Save, Trash2,
  ChevronDown, Palette, Maximize2, X, Star, List,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

const WatchlistWidget = ({ symbols, isDark }: { symbols: string[]; isDark: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host || symbols.length === 0) return;
    host.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container__widget';
    container.style.height = '100%';
    host.appendChild(container);
    const s = document.createElement('script');
    s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
    s.async = true;
    s.innerHTML = JSON.stringify({
      colorTheme: isDark ? 'dark' : 'light',
      dateRange: '12M', showChart: false, locale: 'en', largeChartUrl: '',
      isTransparent: true, showSymbolLogo: true, showFloatingTooltip: false,
      width: '100%', height: '100%',
      tabs: [{ title: 'Watchlist', symbols: symbols.map((s) => ({ s: /XAU|XAG/i.test(s) ? `OANDA:${s}` : `FX:${s}` })) }],
    });
    host.appendChild(s);
    return () => { host.innerHTML = ''; };
  }, [symbols.join(','), isDark]);
  return <div ref={ref} className="tradingview-widget-container" style={{ height: '100%', width: '100%' }} />;
};

type Tool = 'cursor' | 'trendline' | 'horizontal';
type Point = { time: number; price: number };
type Drawing = {
  id?: string;
  drawing_type: 'trendline' | 'horizontal';
  points: Point[];
  color: string;
  priceLine?: IPriceLine;
};

const TIMEFRAMES = [
  { label: '1m', value: '1m' }, { label: '5m', value: '5m' },
  { label: '15m', value: '15m' }, { label: '30m', value: '30m' },
  { label: '1H', value: '1h' }, { label: '4H', value: '4h' },
  { label: '1D', value: '1d' }, { label: '1W', value: '1w' },
];

const SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'GBPJPY', 'AUDUSD'];
const COLORS = ['#14C9AE', '#3D6FE5', '#C98A93', '#F59E0B', '#8B5CF6', '#EC4899', '#10B981', '#F97316'];

export default function Analyze() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const drawingsRef = useRef<Drawing[]>([]);

  const [symbol, setSymbol] = useState('EURUSD');
  const [customSymbol, setCustomSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('1h');
  const [tool, setTool] = useState<Tool>('cursor');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [pendingPoint, setPendingPoint] = useState<Point | null>(null);
  const [activeDraw, setActiveDraw] = useState<Drawing | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistOpen, setWatchlistOpen] = useState(false);

  useEffect(() => { drawingsRef.current = drawings; }, [drawings]);

  // Shares the same saved symbols as TradingTools' watchlist.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('trading_tool_preferences')
        .select('favorite_symbols')
        .eq('user_id', user.id)
        .maybeSingle();
      setWatchlist(data?.favorite_symbols ?? []);
    })();
  }, [user?.id]);

  const toggleWatch = async (sym: string) => {
    if (!user) return;
    const next = watchlist.includes(sym) ? watchlist.filter((s) => s !== sym) : [...watchlist, sym];
    setWatchlist(next);
    await supabase.from('trading_tool_preferences').upsert({ user_id: user.id, favorite_symbols: next }, { onConflict: 'user_id' });
  };

  const isDark = theme === 'dark';

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;
    const container = containerRef.current;
    if (!canvas || !chart || !series || !container) return;
    const rect = container.getBoundingClientRect();
    if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
      canvas.width = Math.floor(rect.width);
      canvas.height = Math.floor(rect.height);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const getCoords = (p: Point) => ({
      x: chart.timeScale().timeToCoordinate(p.time as Time),
      y: series.priceToCoordinate(p.price),
    });

    drawingsRef.current.forEach((d) => {
      if (d.drawing_type !== 'trendline' || d.points.length < 2) return;
      const { x: x1, y: y1 } = getCoords(d.points[0]);
      const { x: x2, y: y2 } = getCoords(d.points[1]);
      if (x1 == null || y1 == null || x2 == null || y2 == null) return;
      ctx.save();
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      [{ x: x1, y: y1 }, { x: x2, y: y2 }].forEach(({ x, y }) => {
        ctx.fillStyle = isDark ? '#131316' : '#fff';
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = d.color;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    });

    // Live preview while drawing
    if (pendingPoint && mousePos && tool === 'trendline') {
      const { x: x1, y: y1 } = getCoords(pendingPoint);
      if (x1 != null && y1 != null) {
        ctx.save();
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();
        ctx.fillStyle = selectedColor;
        ctx.beginPath(); ctx.arc(x1, y1, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  }, [drawings, pendingPoint, mousePos, tool, selectedColor, isDark]);

  // Build chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#9B9A97' : '#6B6B72',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { timeVisible: true, secondsVisible: false, borderVisible: false },
      rightPriceScale: { borderVisible: false },
      autoSize: true,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#14C9AE', downColor: '#C98A93', borderVisible: false,
      wickUpColor: '#14C9AE', wickDownColor: '#C98A93',
    });
    chartRef.current = chart;
    seriesRef.current = series;
    const redraw = () => requestAnimationFrame(drawOverlay);
    chart.timeScale().subscribeVisibleTimeRangeChange(redraw);
    chart.subscribeCrosshairMove(redraw);
    const ro = new ResizeObserver(redraw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; seriesRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw overlay whenever state changes
  useEffect(() => { requestAnimationFrame(drawOverlay); }, [drawOverlay]);

  // Load candles
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    (async () => {
      const sym = (customSymbol.trim() || symbol).toUpperCase();
      const { data, error: fnErr } = await supabase.functions.invoke('get-candles', {
        body: { symbol: sym, timeframe, limit: 500 },
      });
      if (cancelled) return;
      setLoading(false);
      if (fnErr || !data?.success) {
        setError(await functionErrorMessage(fnErr, data, 'Could not load candles.'));
        return;
      }
      seriesRef.current?.setData(data.candles);
      chartRef.current?.timeScale().fitContent();
    })();
    return () => { cancelled = true; };
  }, [symbol, customSymbol, timeframe]);

  // Load saved drawings
  useEffect(() => {
    if (!user) return;
    const sym = (customSymbol.trim() || symbol).toUpperCase();
    (async () => {
      setDrawings((prev) => {
        prev.forEach((d) => { if (d.priceLine && seriesRef.current) seriesRef.current.removePriceLine(d.priceLine); });
        return [];
      });
      const { data } = await supabase
        .from('chart_drawings')
        .select('*')
        .eq('user_id', user.id)
        .eq('symbol', sym)
        .eq('timeframe', timeframe);
      const loaded: Drawing[] = (data ?? []).map((d: any) => {
        const drawing: Drawing = { id: d.id, drawing_type: d.drawing_type, points: d.points, color: d.color };
        if (d.drawing_type === 'horizontal' && seriesRef.current) {
          drawing.priceLine = seriesRef.current.createPriceLine({ price: d.points[0].price, color: d.color, lineWidth: 2 });
        }
        return drawing;
      });
      setDrawings(loaded);
      setTimeout(() => requestAnimationFrame(drawOverlay), 100);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, symbol, customSymbol, timeframe]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const pointFromClient = (clientX: number, clientY: number) => {
    const chart = chartRef.current; const series = seriesRef.current; const canvas = canvasRef.current;
    if (!chart || !series || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left; const y = clientY - rect.top;
    const time = chart.timeScale().coordinateToTime(x);
    const price = series.coordinateToPrice(y);
    if (time == null || price == null) return null;
    return { x, y, time: time as number, price };
  };

  const commitPoint = (time: number, price: number) => {
    if (tool === 'horizontal') {
      const priceLine = seriesRef.current?.createPriceLine({ price, color: selectedColor, lineWidth: 2 });
      const d: Drawing = { drawing_type: 'horizontal', points: [{ time, price }], color: selectedColor, priceLine };
      setDrawings((prev) => [...prev, d]);
      setTool('cursor');
      return;
    }
    if (tool === 'trendline') {
      if (!pendingPoint) {
        setPendingPoint({ time, price });
      } else {
        const d: Drawing = { drawing_type: 'trendline', points: [pendingPoint, { time, price }], color: selectedColor };
        setDrawings((prev) => [...prev, d]);
        setPendingPoint(null);
        setTool('cursor');
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || tool === 'cursor') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const t = e.touches[0];
    if (!t) return;
    setMousePos({ x: t.clientX - rect.left, y: t.clientY - rect.top });
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (tool === 'cursor') return;
    const t = e.changedTouches[0];
    if (!t) return;
    e.preventDefault();
    const p = pointFromClient(t.clientX, t.clientY);
    if (p) commitPoint(p.time, p.price);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'cursor') return;
    const p = pointFromClient(e.clientX, e.clientY);
    if (p) commitPoint(p.time, p.price);
  };

  const saveSetup = async () => {
    if (!user) return;
    const sym = (customSymbol.trim() || symbol).toUpperCase();
    const unsaved = drawings.filter((d) => !d.id);
    if (unsaved.length === 0) { toast.info('No new drawings to save'); return; }
    setSaving(true);
    await Promise.all(unsaved.map((d) =>
      supabase.from('chart_drawings').insert({
        user_id: user.id, symbol: sym, timeframe,
        drawing_type: d.drawing_type, points: d.points as any, color: d.color,
      })
    ));
    setSaving(false);
    toast.success('Setup saved');
    // Reload to get IDs assigned
    const { data } = await supabase.from('chart_drawings').select('*').eq('user_id', user.id).eq('symbol', sym).eq('timeframe', timeframe);
    if (data) setDrawings((prev) => prev.map((d, i) => ({ ...d, id: data[i]?.id ?? d.id })));
  };

  const clearAll = async () => {
    if (!user) return;
    drawings.forEach((d) => { if (d.priceLine && seriesRef.current) seriesRef.current.removePriceLine(d.priceLine); });
    const ids = drawings.filter((d) => d.id).map((d) => d.id as string);
    if (ids.length) await supabase.from('chart_drawings').delete().in('id', ids);
    setDrawings([]);
    setPendingPoint(null);
    setMousePos(null);
    toast.success('Drawings cleared');
  };

  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocusMode(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    document.body.classList.add('eb-focus-mode');
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; document.body.classList.remove('eb-focus-mode'); };
  }, [focusMode]);

  const activeSymbol = (customSymbol.trim() || symbol).toUpperCase();

  const ChartToolbar = () => (
    <div className="flex flex-wrap items-center gap-2">
      {/* Symbol picker */}
      <div className="relative">
        <button
          onClick={() => setSymbolOpen((v) => !v)}
          className="h-9 px-3 rounded-lg border border-border bg-secondary/40 text-sm font-medium flex items-center gap-1.5 min-w-[100px]"
        >
          {activeSymbol} <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
        {symbolOpen && (
          <div className="absolute top-full mt-1 left-0 z-20 bg-popover border border-border rounded-lg shadow-elevated py-1 min-w-[140px]">
            {SYMBOLS.map((s) => (
              <button key={s} onClick={() => { setSymbol(s); setCustomSymbol(''); setSymbolOpen(false); }}
                className={cn('w-full text-left px-3 py-1.5 text-sm hover:bg-secondary/60', s === activeSymbol && 'text-primary')}>
                {s}
              </button>
            ))}
            <div className="border-t border-border mt-1 pt-1 px-2">
              <input
                placeholder="Custom…"
                value={customSymbol}
                onChange={(e) => { setCustomSymbol(e.target.value.toUpperCase()); setSymbolOpen(false); }}
                className="w-full bg-transparent text-sm outline-none py-1"
              />
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => toggleWatch(activeSymbol)}
        className={cn('h-9 w-9 rounded-lg border flex items-center justify-center flex-shrink-0', watchlist.includes(activeSymbol) ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground')}
        title={watchlist.includes(activeSymbol) ? 'Remove from watchlist' : 'Add to watchlist'}
      >
        <Star className="size-4" fill={watchlist.includes(activeSymbol) ? 'currentColor' : 'none'} />
      </button>

      {/* Timeframes */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-border bg-secondary/20">
        {TIMEFRAMES.map((tf) => (
          <button key={tf.value} onClick={() => setTimeframe(tf.value)}
            className={cn('h-8 px-2.5 rounded-md text-xs font-medium transition-all', timeframe === tf.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {tf.label}
          </button>
        ))}
      </div>

      <div className="h-5 w-px bg-border" />

      {/* Drawing tools */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-border bg-secondary/20">
        {[
          { t: 'cursor' as Tool, icon: MousePointer2, label: 'Cursor' },
          { t: 'trendline' as Tool, icon: TrendingUp, label: 'Trendline' },
          { t: 'horizontal' as Tool, icon: Minus, label: 'Level' },
        ].map(({ t, icon: Icon, label }) => (
          <button key={t} onClick={() => { setTool(t); setPendingPoint(null); }}
            className={cn('h-8 px-2.5 rounded-md text-xs flex items-center gap-1.5 transition-all', tool === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            title={label}>
            <Icon className="size-3.5" /> <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Color picker */}
      <div className="relative">
        <button onClick={() => setColorPickerOpen((v) => !v)}
          className="h-8 w-8 rounded-lg border border-border flex items-center justify-center"
          title="Drawing color">
          <div className="size-4 rounded-full" style={{ background: selectedColor }} />
        </button>
        {colorPickerOpen && (
          <div className="absolute top-full mt-1 left-0 z-20 bg-popover border border-border rounded-lg shadow-elevated p-2 flex flex-wrap gap-1.5 w-32">
            {COLORS.map((c) => (
              <button key={c} onClick={() => { setSelectedColor(c); setColorPickerOpen(false); }}
                className={cn('size-5 rounded-full border-2 transition-transform hover:scale-110', selectedColor === c ? 'border-foreground scale-110' : 'border-transparent')}
                style={{ background: c }} />
            ))}
          </div>
        )}
      </div>

      <div className="h-5 w-px bg-border" />

      {/* Actions */}
      <button onClick={saveSetup} disabled={saving}
        className="h-8 px-3 rounded-lg bg-gradient-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 disabled:opacity-60">
        <Save className="size-3.5" /> {saving ? 'Saving…' : 'Save'}
      </button>
      <button onClick={clearAll}
        className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:text-bear hover:border-bear/50 flex items-center gap-1.5 transition-colors">
        <Trash2 className="size-3.5" /> Clear
      </button>
      <button onClick={() => setWatchlistOpen((v) => !v)}
        className={cn('h-8 px-3 rounded-lg border text-xs flex items-center gap-1.5 transition-colors', watchlistOpen ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground')}
        title="Watchlist">
        <List className="size-3.5" /> <span className="hidden sm:inline">Watchlist</span>
      </button>
      <button onClick={() => setFocusMode(true)}
        className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground flex items-center gap-1.5 ml-auto"
        title="Fullscreen focus">
        <Maximize2 className="size-3.5" />
      </button>
    </div>
  );

  const ChartArea = ({ height }: { height: number | string }) => (
    <div className="relative rounded-xl border border-border overflow-hidden bg-card" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ pointerEvents: tool === 'cursor' ? 'none' : 'auto', cursor: tool !== 'cursor' ? 'crosshair' : 'default', touchAction: tool === 'cursor' ? 'auto' : 'none' }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="text-sm text-muted-foreground">Loading candles…</div>
        </div>
      )}
      {!loading && error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-sm text-bear text-center max-w-xs px-4">{error}</div>
        </div>
      )}
      {tool === 'trendline' && !loading && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-card/90 border border-border text-xs text-muted-foreground">
          {pendingPoint ? 'Click second point to finish' : 'Click first point to start trendline'}
        </div>
      )}

      {/* Watchlist drawer — toggled by the chart's own toolbar icon, not a persistent panel */}
      <div
        className={cn(
          'absolute top-0 right-0 h-full w-64 bg-card/95 backdrop-blur border-l border-border flex flex-col transition-transform duration-250 ease-out z-30',
          watchlistOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Watchlist</span>
          <button onClick={() => setWatchlistOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
        {watchlist.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">
            Tap the star next to the symbol picker to add pairs here.
          </div>
        ) : (
          <>
            <div style={{ height: 200 }} className="border-b border-border flex-shrink-0">
              <WatchlistWidget symbols={watchlist} isDark={isDark} />
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-1.5 space-y-1">
              {watchlist.map((s) => (
                <button
                  key={s}
                  onClick={() => { setSymbol(s); setCustomSymbol(''); }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors',
                    activeSymbol === s ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary/50 text-foreground'
                  )}
                >
                  <span>{s}</span>
                  {activeSymbol === s && <span className="text-[10px] uppercase tracking-wide">Viewing</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
        <header>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Analyze</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Draw on real MT5 price data — every setup saves to your Edge Blast account.
          </p>
        </header>
        <ChartToolbar />
        <ChartArea height={560} />
        {drawings.length > 0 && (
          <div className="glass rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Drawings on this setup</div>
            <div className="space-y-1.5">
              {drawings.map((d, i) => (
                <div key={d.id ?? i} className="flex items-center gap-3 text-sm">
                  <div className="size-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="capitalize">{d.drawing_type}</span>
                  <span className="text-muted-foreground text-xs">
                    {d.drawing_type === 'horizontal' ? `@ ${d.points[0].price}` : `${d.points[0].price} → ${d.points[1]?.price ?? '…'}`}
                  </span>
                  {!d.id && <span className="ml-auto text-[10px] text-amber-500">unsaved</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {focusMode && (
        <div className="fixed inset-0 z-[250] bg-background flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background/80 backdrop-blur flex-wrap">
            <ChartToolbar />
            <button onClick={() => setFocusMode(false)} className="h-8 px-3 rounded-lg border border-border text-xs flex items-center gap-1.5 text-muted-foreground ml-2">
              <X className="size-3.5" /> Exit (Esc)
            </button>
          </div>
          <div className="flex-1 relative p-2">
            <ChartArea height="100%" />
          </div>
        </div>
      )}
    </>
  );
}
