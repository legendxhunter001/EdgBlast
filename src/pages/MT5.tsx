import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountScope } from '@/hooks/useAccountScope';
import { functionErrorMessage } from '@/lib/functionError';
import { toast } from 'sonner';
import {
  MousePointer2, TrendingUp, Minus, Save, Trash2,
  ChevronDown, Palette, Maximize2, X, Star, List, RefreshCw, LineChart, Camera, Bookmark,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { TradingViewChart } from '@/components/chart/TradingViewChart';

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
        .mt5-refresh{
          width:30px; height:30px; display:flex; align-items:center; justify-content:center;
          background:var(--mt5-card); border:1px solid var(--mt5-line); border-radius:8px; color:var(--mt5-dim);
          transition:color .2s cubic-bezier(0.22,1,0.36,1), border-color .2s cubic-bezier(0.22,1,0.36,1), transform .15s cubic-bezier(0.22,1,0.36,1);
        }
        .mt5-refresh:hover{ color:var(--mt5-blue); border-color:var(--mt5-blue); }
        .mt5-refresh:active{ transform:scale(.92); }
        .mt5-balance-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(100px,1fr)); gap:.6rem; margin-bottom:1rem; }
        .mt5-balance-card{
          background:var(--mt5-card); border:1px solid var(--mt5-line); border-radius:10px; padding:.7rem .8rem;
          transition:transform .2s cubic-bezier(0.22,1,0.36,1), border-color .2s cubic-bezier(0.22,1,0.36,1);
        }
        .mt5-balance-card:hover{ transform:translateY(-2px); border-color:var(--mt5-blue); }
        .mt5-balance-label{ font-size:.62rem; text-transform:uppercase; letter-spacing:.06em; color:var(--mt5-dim); font-weight:700; }
        .mt5-balance-value{ font-family:'IBM Plex Mono',monospace; font-size:1.05rem; font-weight:600; margin-top:.3rem; }
        .mt5-balance-value.pos{ color:var(--mt5-green); }
        .mt5-balance-value.neg{ color:var(--mt5-red); }
        .mt5-section-label{ font-size:.68rem; text-transform:uppercase; letter-spacing:.08em; color:var(--mt5-dim); font-weight:700; margin:1rem 0 .5rem; }
        .mt5-pos-row{
          display:flex; align-items:center; gap:.7rem; padding:.65rem .1rem; border-bottom:1px solid var(--mt5-line); font-size:.82rem;
          transition:background .18s cubic-bezier(0.22,1,0.36,1);
        }
        .mt5-pos-row:hover{ background:rgba(255,255,255,.02); }
        .mt5-pos-symbol{ font-weight:700; min-width:64px; }
        .mt5-pos-side{ font-size:.62rem; font-weight:800; letter-spacing:.05em; padding:.15rem .4rem; border-radius:8px; }
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
          transition:border-color .2s cubic-bezier(0.22,1,0.36,1);
        }
        .mt5-field input:focus, .mt5-field select:focus{ outline:none; border-color:var(--mt5-blue); }
        .mt5-side-toggle{ display:flex; border-radius:8px; overflow:hidden; border:1px solid var(--mt5-line); }
        .mt5-side-toggle button{ flex:1; padding:.5rem; font-size:.8rem; font-weight:700; background:var(--mt5-card); color:var(--mt5-dim); border:none; transition:background .2s cubic-bezier(0.22,1,0.36,1), color .2s cubic-bezier(0.22,1,0.36,1); }
        .mt5-side-toggle button.buy.on{ background:var(--mt5-green); color:#04120F; }
        .mt5-side-toggle button.sell.on{ background:var(--mt5-red); color:#1A0505; }
        .mt5-submit{
          width:100%; margin-top:.9rem; padding:.7rem; border-radius:10px; border:none; font-weight:700; font-size:.85rem;
          background:linear-gradient(135deg,var(--mt5-blue),#1E5FD8); color:#fff;
          transition:transform .15s cubic-bezier(0.22,1,0.36,1), box-shadow .2s cubic-bezier(0.22,1,0.36,1), opacity .2s cubic-bezier(0.22,1,0.36,1);
        }
        .mt5-submit:not(:disabled):hover{ transform:translateY(-1px); box-shadow:0 8px 20px rgba(46,124,246,.28); }
        .mt5-submit:not(:disabled):active{ transform:translateY(0) scale(.98); }
        .mt5-submit:disabled{ opacity:.4; }
        .mt5-review-backdrop{ position:fixed; inset:0; z-index:300; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; padding:1rem; }
        .mt5-review{ background:var(--mt5-card); border:1px solid var(--mt5-line); border-radius:16px; padding:1.2rem; max-width:320px; width:100%; }
        .mt5-review-row{ display:flex; justify-content:space-between; padding:.35rem 0; font-size:.82rem; border-bottom:1px solid var(--mt5-line); }
        .mt5-review-row span{ color:var(--mt5-dim); }
        .mt5-alert{ font-size:.78rem; color:var(--mt5-red); background:rgba(239,83,80,.1); border:1px solid rgba(239,83,80,.3); border-radius:8px; padding:.6rem .7rem; margin-bottom:.8rem; }
      `}</style>

      <div className="mt5-head">
        <div className="mt5-title"><LineChart size={16} color="var(--mt5-blue)" /> MT5 Account</div>
        <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
          <select className="mt5-select" value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
            {connected.length === 0 && <option value="">No connected account</option>}
            {connected.map((c: any) => <option key={c.id} value={c.id}>{c.label || c.account_number}</option>)}
          </select>
          <button className="mt5-refresh" onClick={load} disabled={loading} aria-label="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
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
        <div className="mt5-empty">Live trading isn't enabled on any account, turn it on in Connections to trade here.</div>
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

export default function MT5() {
  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-semibold">MT5</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your account, positions, and order ticket, plus the TradingView chart to plan and save your setups.
        </p>
      </header>
      <MT5AccountPanel />
      <div className="text-xs text-muted-foreground font-semibold pt-1">Chart & Setups</div>
      <TradingViewChart />
    </div>
  );
}
