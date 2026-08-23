import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi, CandlestickSeries, IPriceLine, Time } from 'lightweight-charts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { MousePointer2, TrendingUp, Minus, Save, Trash2 } from 'lucide-react';

type Tool = 'cursor' | 'trendline' | 'horizontal';
type Point = { time: number; price: number };
type Drawing = {
  id?: string;
  drawing_type: 'trendline' | 'horizontal';
  points: Point[];
  color: string;
  priceLine?: IPriceLine;
};

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

export default function Analyze() {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const [symbol, setSymbol] = useState('EURUSD');
  const [timeframe, setTimeframe] = useState('1h');
  const [tool, setTool] = useState<Tool>('cursor');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [pendingPoint, setPendingPoint] = useState<Point | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;
    const container = containerRef.current;
    if (!canvas || !chart || !series || !container) return;
    const rect = container.getBoundingClientRect();
    if (canvas.width !== rect.width) canvas.width = rect.width;
    if (canvas.height !== rect.height) canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawings.forEach((d) => {
      if (d.drawing_type !== 'trendline') return;
      const [p1, p2] = d.points;
      const x1 = chart.timeScale().timeToCoordinate(p1.time as Time);
      const y1 = series.priceToCoordinate(p1.price);
      const x2 = chart.timeScale().timeToCoordinate(p2.time as Time);
      const y2 = series.priceToCoordinate(p2.price);
      if (x1 == null || y1 == null || x2 == null || y2 == null) return;
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    if (pendingPoint && tool === 'trendline') {
      const x = chart.timeScale().timeToCoordinate(pendingPoint.time as Time);
      const y = series.priceToCoordinate(pendingPoint.price);
      if (x != null && y != null) {
        ctx.fillStyle = '#14C9AE';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [drawings, pendingPoint, tool]);

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#9B9A97' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.06)' }, horzLines: { color: 'rgba(255,255,255,0.06)' } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { timeVisible: true, secondsVisible: false },
      autoSize: true,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#14C9AE', downColor: '#C98A93', borderVisible: false,
      wickUpColor: '#14C9AE', wickDownColor: '#C98A93',
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const handleChange = () => drawOverlay();
    chart.timeScale().subscribeVisibleTimeRangeChange(handleChange);
    window.addEventListener('resize', handleChange);

    return () => {
      window.removeEventListener('resize', handleChange);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load candles on symbol/timeframe change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      const { data, error: fnErr } = await supabase.functions.invoke('get-candles', {
        body: { symbol: symbol.toUpperCase(), timeframe, limit: 300 },
      });
      if (cancelled) return;
      setLoading(false);
      if (fnErr || !data?.success) {
        setError(data?.message || fnErr?.message || 'Could not load candles.');
        return;
      }
      seriesRef.current?.setData(data.candles);
      chartRef.current?.timeScale().fitContent();
      drawOverlay();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe]);

  // Load saved drawings for this symbol/timeframe
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('chart_drawings')
        .select('*')
        .eq('user_id', user.id)
        .eq('symbol', symbol.toUpperCase())
        .eq('timeframe', timeframe);

      const loaded: Drawing[] = (data ?? []).map((d: any) => ({
        id: d.id, drawing_type: d.drawing_type, points: d.points, color: d.color,
      }));

      loaded.forEach((d) => {
        if (d.drawing_type === 'horizontal' && seriesRef.current) {
          d.priceLine = seriesRef.current.createPriceLine({
            price: d.points[0].price, color: d.color, lineWidth: 2, title: 'setup',
          });
        }
      });

      setDrawings(loaded);
      setTimeout(drawOverlay, 50);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, symbol, timeframe]);

  useEffect(() => { drawOverlay(); }, [drawOverlay]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'cursor') return;
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = chart.timeScale().coordinateToTime(x);
    const price = series.coordinateToPrice(y);
    if (time == null || price == null) return;

    if (tool === 'horizontal') {
      const priceLine = series.createPriceLine({ price, color: '#3D6FE5', lineWidth: 2, title: 'setup' });
      setDrawings((d) => [...d, { drawing_type: 'horizontal', points: [{ time: time as number, price }], color: '#3D6FE5', priceLine }]);
      setTool('cursor');
      return;
    }

    if (tool === 'trendline') {
      if (!pendingPoint) {
        setPendingPoint({ time: time as number, price });
      } else {
        setDrawings((d) => [...d, { drawing_type: 'trendline', points: [pendingPoint, { time: time as number, price }], color: '#14C9AE' }]);
        setPendingPoint(null);
        setTool('cursor');
      }
    }
  };

  const saveSetup = async () => {
    if (!user) return;
    const unsaved = drawings.filter((d) => !d.id);
    if (unsaved.length === 0) { toast.info('Nothing new to save'); return; }
    setSaving(true);
    for (const d of unsaved) {
      await supabase.from('chart_drawings').insert({
        user_id: user.id, symbol: symbol.toUpperCase(), timeframe,
        drawing_type: d.drawing_type, points: d.points as any, color: d.color,
      });
    }
    setSaving(false);
    toast.success('Setup saved to your account');
  };

  const clearAll = async () => {
    drawings.forEach((d) => { if (d.priceLine && seriesRef.current) seriesRef.current.removePriceLine(d.priceLine); });
    const ids = drawings.filter((d) => d.id).map((d) => d.id as string);
    if (ids.length && user) {
      await supabase.from('chart_drawings').delete().in('id', ids);
    }
    setDrawings([]);
    setPendingPoint(null);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-semibold">Analyze</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Draw your setup on real price data — it saves to your Edge Blast account, not TradingView's.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="h-9 px-3 rounded-lg border border-border bg-secondary/40 text-sm w-28 uppercase"
        />
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-secondary/40 text-sm"
        >
          {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
        </select>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/40 border border-border">
          <button
            onClick={() => { setTool('cursor'); setPendingPoint(null); }}
            className={`h-8 px-2.5 rounded-md text-xs flex items-center gap-1.5 ${tool === 'cursor' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            <MousePointer2 className="size-3.5" /> Cursor
          </button>
          <button
            onClick={() => setTool('trendline')}
            className={`h-8 px-2.5 rounded-md text-xs flex items-center gap-1.5 ${tool === 'trendline' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            <TrendingUp className="size-3.5" /> Trendline
          </button>
          <button
            onClick={() => setTool('horizontal')}
            className={`h-8 px-2.5 rounded-md text-xs flex items-center gap-1.5 ${tool === 'horizontal' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            <Minus className="size-3.5" /> Level
          </button>
        </div>

        <button onClick={saveSetup} disabled={saving} className="h-9 px-3 rounded-lg bg-gradient-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 ml-auto">
          <Save className="size-3.5" /> {saving ? 'Saving…' : 'Save setup'}
        </button>
        <button onClick={clearAll} className="h-9 px-3 rounded-lg border border-border text-xs text-muted-foreground flex items-center gap-1.5">
          <Trash2 className="size-3.5" /> Clear
        </button>
      </div>

      {tool === 'trendline' && (
        <div className="text-xs text-primary">
          {pendingPoint ? 'Tap the second point to finish the trendline.' : 'Tap the first point to start a trendline.'}
        </div>
      )}
      {error && <div className="text-sm text-bear bg-bear/10 rounded-lg px-3 py-2">{error}</div>}

      <div className="relative rounded-xl border border-border overflow-hidden" style={{ height: 500 }}>
        <div ref={containerRef} className="absolute inset-0" />
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ pointerEvents: tool === 'cursor' ? 'none' : 'auto', cursor: tool !== 'cursor' ? 'crosshair' : 'default' }}
          onClick={handleCanvasClick}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-background/60">
            Loading candles…
          </div>
        )}
      </div>
    </div>
  );
}
