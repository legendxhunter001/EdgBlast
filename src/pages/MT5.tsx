import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart, ColorType, CrosshairMode,
  IChartApi, ISeriesApi, CandlestickSeries, IPriceLine, Time,
} from 'lightweight-charts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountScope } from '@/hooks/useAccountScope';
import { functionErrorMessage } from '@/lib/functionError';
import { toast } from 'sonner';
import {
  MousePointer2, TrendingUp, Minus, Save, Trash2,
  ChevronDown, Palette, Maximize2, X, Star, List, RefreshCw, LineChart,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

type MT5Position = {
  connection_id: string; connection_label: string; symbol: string; type: string;
  volume: number | null; openPrice: number | null; currentPrice: number | null;
  profit: number | null;
};
type MT5Account = {
  label: string; balance: number | null; equity: number | null; margin: number | null;
  freeMargin: number | null; marginLevel: number | null; currency: string; leverage: number | null; profit: number | null;
};

const MT5AccountPanel = () => {
  const { connections } = useAccountScope();
  const [connectionId, setConnectionId] = useState('');
  const [account, setAccount] = useState<MT5Account | null>(null);
  const [positions, setPositions] = useState<MT5Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const connected = connections.filter((c: any) => c.status === 'connected');
  const tradable = connections.filter((c: any) => c.can_trade && c.status === 'connected');

  useEffect(() => {
    if (!connectionId && connected.length > 0) setConnectionId(connected[0].id);
  }, [connected, connectionId]);

  const load = useCallback(async () => {
    if (!connectionId) return;
    setLoading(true); setError('');
    const [accRes, posRes] = await Promise.all([
      supabase.functions.invoke('get-account-info', { body: { connection_id: connectionId } }),
      supabase.functions.invoke('mt5-positions', { body: { connection_id: connectionId } }),
    ]);
    setLoading(false);
    if (accRes.error || !accRes.data?.success) {
      setError(await functionErrorMessage(accRes.error, accRes.data, 'Could not load account info.'));
      setAccount(null);
    } else {
      setAccount(accRes.data.account);
    }
    if (!posRes.error && posRes.data?.success) setPositions(posRes.data.positions ?? []);
  }, [connectionId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  // Order ticket
  const [symbol, setSymbol] = useState('EURUSD');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [volume, setVolume] = useState('0.01');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canReview = symbol.trim() && Number(volume) > 0 && (orderType === 'market' || Number(entryPrice) > 0) && tradable.length > 0;

  const submit = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('place-order', {
      body: {
        connection_id: connectionId, symbol: symbol.trim().toUpperCase(), direction, order_type: orderType,
        volume: Number(volume), entry_price: orderType === 'market' ? null : Number(entryPrice),
        stop_loss: stopLoss ? Number(stopLoss) : null, take_profit: takeProfit ? Number(takeProfit) : null,
      },
    });
    setSubmitting(false);
    setReviewOpen(false);
    if (error || !data?.success) {
      const msg = await functionErrorMessage(error, data, 'Order failed.');
      toast.error(msg);
    } else {
      toast.success(`${symbol.toUpperCase()} ${direction} order filled`);
      load();
    }
  };

  const fmt = (n: number | null) => n === null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="mt5-app">
      <style>{`
        .mt5-app, .mt5-app *{ box-sizing:border-box; }
        .mt5-app{
          --mt5-bg:#0B0E14; --mt5-card:#131722; --mt5-line:rgba(255,255,255,.07);
          --mt5-blue:#2E7CF6; --mt5-green:#26A69A; --mt5-red:#EF5350; --mt5-text:#E8EAED; --mt5-dim:#7C8798;
          background:var(--mt5-bg); color:var(--mt5-text); border-radius:16px; padding:1.1rem;
          font-family:'Inter',-apple-system,sans-serif; border:1px solid var(--mt5-line);
        }
        html.light .mt5-app{ --mt5-bg:#0B0E14; --mt5-card:#131722; --mt5-text:#E8EAED; --mt5-dim:#8A93A3; }
        .mt5-head{ display:flex; align-items:center; justify-content:space-between; gap:.6rem; margin-bottom:.9rem; flex-wrap:wrap; }
        .mt5-title{ font-weight:700; font-size:.95rem; display:flex; align-items:center; gap:.5rem; }
        .mt5-select{
          background:var(--mt5-card); border:1px solid var(--mt5-line); color:var(--mt5-text);
          border-radius:8px; padding:.4rem .6rem; font-size:.78rem; max-width:160px;
        }
        .mt5-refresh{ background:var(--mt5-card); border:1px solid var(--mt5-line); border-radius:8px; padding:.4rem; color:var(--mt5-dim); }
        .mt5-balance-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(100px,1fr)); gap:.6rem; margin-bottom:1rem; }
        .mt5-balance-card{ background:var(--mt5-card); border:1px solid var(--mt5-line); border-radius:10px; padding:.7rem .8rem; }
        .mt5-balance-label{ font-size:.62rem; text-transform:uppercase; letter-spacing:.06em; color:var(--mt5-dim); font-weight:700; }
        .mt5-balance-value{ font-family:'IBM Plex Mono',monospace; font-size:1.05rem; font-weight:600; margin-top:.3rem; }
        .mt5-balance-value.pos{ color:var(--mt5-green); }
        .mt5-balance-value.neg{ color:var(--mt5-red); }
        .mt5-section-label{ font-size:.68rem; text-transform:uppercase; letter-spacing:.08em; color:var(--mt5-dim); font-weight:700; margin:1rem 0 .5rem; }
        .mt5-pos-row{
          display:flex; align-items:center; gap:.7rem; padding:.65rem .1rem; border-bottom:1px solid var(--mt5-line); font-size:.82rem;
        }
        .mt5-pos-symbol{ font-weight:700; min-width:64px; }
        .mt5-pos-side{ font-size:.62rem; font-weight:800; letter-spacing:.05em; padding:.15rem .4rem; border-radius:5px; }
        .mt5-pos-side.buy{ background:rgba(38,166,154,.18); color:var(--mt5-green); }
        .mt5-pos-side.sell{ background:rgba(239,83,80,.18); color:var(--mt5-red); }
        .mt5-pos-mid{ flex:1; color:var(--mt5-dim); font-family:'IBM Plex Mono',monospace; font-size:.76rem; }
        .mt5-pos-pnl{ font-family:'IBM Plex Mono',monospace; font-weight:700; }
        .mt5-empty{ color:var(--mt5-dim); font-size:.8rem; padding:1rem 0; text-align:center; }
        .mt5-order-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:.6rem; }
        .mt5-field{ display:flex; flex-direction:column; gap:.3rem; }
        .mt5-field span{ font-size:.65rem; text-transform:uppercase; letter-spacing:.05em; color:var(--mt5-dim); font-weight:700; }
        .mt5-field input, .mt5-field select{
          background:var(--mt5-card); border:1px solid var(--mt5-line); color:var(--mt5-text);
          border-radius:8px; padding:.5rem .6rem; font-size:.85rem; font-family:'IBM Plex Mono',monospace;
        }
        .mt5-side-toggle{ display:flex; border-radius:8px; overflow:hidden; border:1px solid var(--mt5-line); }
        .mt5-side-toggle button{ flex:1; padding:.5rem; font-size:.8rem; font-weight:700; background:var(--mt5-card); color:var(--mt5-dim); border:none; }
        .mt5-side-toggle button.buy.on{ background:var(--mt5-green); color:#04120F; }
        .mt5-side-toggle button.sell.on{ background:var(--mt5-red); color:#1A0505; }
        .mt5-submit{
          width:100%; margin-top:.9rem; padding:.7rem; border-radius:10px; border:none; font-weight:700; font-size:.85rem;
          background:linear-gradient(135deg,var(--mt5-blue),#1E5FD8); color:#fff;
        }
        .mt5-submit:disabled{ opacity:.4; }
        .mt5-review-backdrop{ position:fixed; inset:0; z-index:300; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; padding:1rem; }
        .mt5-review{ background:var(--mt5-card); border:1px solid var(--mt5-line); border-radius:14px; padding:1.2rem; max-width:320px; width:100%; }
        .mt5-review-row{ display:flex; justify-content:space-between; padding:.35rem 0; font-size:.82rem; border-bottom:1px solid var(--mt5-line); }
        .mt5-review-row span{ color:var(--mt5-dim); }
        .mt5-alert{ font-size:.78rem; color:var(--mt5-red); background:rgba(239,83,80,.1); border:1px solid rgba(239,83,80,.3); border-radius:8px; padding:.6rem .7rem; margin-bottom:.8rem; }
      `}</style>

      <div className="mt5-head">
        <div className="mt5-title"><LineChart size={15} color="var(--mt5-blue)" /> MT5 Account</div>
        <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
          <select className="mt5-select" value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
            {connected.length === 0 && <option value="">No connected account</option>}
            {connected.map((c: any) => <option key={c.id} value={c.id}>{c.label || c.account_number}</option>)}
          </select>
          <button className="mt5-refresh" onClick={load} disabled={loading} aria-label="Refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="mt5-alert">{error}</div>}

      {account && (
        <div className="mt5-balance-grid">
          <div className="mt5-balance-card">
            <div className="mt5-balance-label">Balance</div>
            <div className="mt5-balance-value">{fmt(account.balance)}</div>
          </div>
          <div className="mt5-balance-card">
            <div className="mt5-balance-label">Equity</div>
            <div className="mt5-balance-value">{fmt(account.equity)}</div>
          </div>
          <div className="mt5-balance-card">
            <div className="mt5-balance-label">Free Margin</div>
            <div className="mt5-balance-value">{fmt(account.freeMargin)}</div>
          </div>
          <div className="mt5-balance-card">
            <div className="mt5-balance-label">Margin Level</div>
            <div className="mt5-balance-value">{account.marginLevel !== null ? `${account.marginLevel.toFixed(0)}%` : '—'}</div>
          </div>
        </div>
      )}

      <div className="mt5-section-label">Open Positions</div>
      {positions.length === 0 ? (
        <div className="mt5-empty">No open positions.</div>
      ) : (
        positions.map((p, i) => {
          const pnl = Number(p.profit ?? 0);
          const isBuy = String(p.type).toLowerCase() !== 'short';
          return (
            <div key={i} className="mt5-pos-row">
              <span className="mt5-pos-symbol">{p.symbol}</span>
              <span className={`mt5-pos-side ${isBuy ? 'buy' : 'sell'}`}>{isBuy ? 'BUY' : 'SELL'}</span>
              <span className="mt5-pos-mid">{p.volume} lot · {p.currentPrice ?? '—'}</span>
              <span className={`mt5-pos-pnl ${pnl >= 0 ? 'pos' : 'neg'}`} style={{ color: pnl >= 0 ? 'var(--mt5-green)' : 'var(--mt5-red)' }}>
                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
              </span>
            </div>
          );
        })
      )}

      <div className="mt5-section-label">New Order</div>
      {tradable.length === 0 ? (
        <div className="mt5-empty">Live trading isn't enabled on any account — turn it on in Connections to trade here.</div>
      ) : (
        <>
          <div className="mt5-side-toggle" style={{ marginBottom: '.6rem' }}>
            <button className={`buy ${direction === 'long' ? 'on' : ''}`} onClick={() => setDirection('long')}>BUY</button>
            <button className={`sell ${direction === 'short' ? 'on' : ''}`} onClick={() => setDirection('short')}>SELL</button>
          </div>
          <div className="mt5-order-grid">
            <label className="mt5-field"><span>Symbol</span><input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} /></label>
            <label className="mt5-field"><span>Type</span>
              <select value={orderType} onChange={(e) => setOrderType(e.target.value as any)}>
                <option value="market">Market</option><option value="limit">Limit</option><option value="stop">Stop</option>
              </select>
            </label>
            <label className="mt5-field"><span>Volume</span><input type="number" step="0.01" value={volume} onChange={(e) => setVolume(e.target.value)} /></label>
            {orderType !== 'market' && (
              <label className="mt5-field"><span>Entry</span><input type="number" step="any" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} /></label>
            )}
            <label className="mt5-field"><span>Stop loss</span><input type="number" step="any" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} /></label>
            <label className="mt5-field"><span>Take profit</span><input type="number" step="any" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} /></label>
          </div>
          <button className="mt5-submit" disabled={!canReview} onClick={() => setReviewOpen(true)}>Review Order</button>
        </>
      )}

      {reviewOpen && (
        <div className="mt5-review-backdrop" onClick={() => setReviewOpen(false)}>
          <div className="mt5-review" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, marginBottom: '.7rem' }}>Confirm Order</div>
            <div className="mt5-review-row"><span>Symbol</span><b>{symbol.toUpperCase()}</b></div>
            <div className="mt5-review-row"><span>Side</span><b style={{ color: direction === 'long' ? 'var(--mt5-green)' : 'var(--mt5-red)' }}>{direction === 'long' ? 'BUY' : 'SELL'}</b></div>
            <div className="mt5-review-row"><span>Type</span><b>{orderType}</b></div>
            <div className="mt5-review-row"><span>Volume</span><b>{volume} lot</b></div>
            <div className="mt5-review-row"><span>Stop loss</span><b>{stopLoss || '—'}</b></div>
            <div className="mt5-review-row"><span>Take profit</span><b>{takeProfit || '—'}</b></div>
            <p style={{ fontSize: '.72rem', color: 'var(--mt5-red)', marginTop: '.7rem' }}>This places a real order with real money. Risk rules are checked automatically.</p>
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '.8rem' }}>
              <button className="mt5-submit" style={{ background: 'var(--mt5-card)', border: '1px solid var(--mt5-line)' }} onClick={() => setReviewOpen(false)}>Cancel</button>
              <button className="mt5-submit" disabled={submitting} onClick={submit}>{submitting ? 'Placing…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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

export default function MT5() {
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
          <h1 className="font-display text-2xl md:text-3xl font-semibold">MT5</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your account, positions, and order ticket — plus a chart to plan and save your setups.
          </p>
        </header>
        <MT5AccountPanel />
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold pt-1">Chart & Setups</div>
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
