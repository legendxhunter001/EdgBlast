import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAccountScope } from '@/hooks/useAccountScope';

/* ---------------- TradingView embeds ---------------- */

const TVWidget = ({
  script,
  config,
  height,
}: {
  script: string;
  config: Record<string, unknown>;
  height: number | string;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container__widget';
    container.style.height = '100%';
    host.appendChild(container);

    const s = document.createElement('script');
    s.src = `https://s3.tradingview.com/external-embedding/embed-widget-${script}.js`;
    s.type = 'text/javascript';
    s.async = true;
    s.innerHTML = JSON.stringify(config);
    host.appendChild(s);

    return () => { host.innerHTML = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script, JSON.stringify(config)]);

  return (
    <div
      ref={ref}
      className="tradingview-widget-container"
      style={{ height, width: '100%' }}
    />
  );
};

/* ---------------- Lot size calculator ---------------- */

// Pip value per 1.00 standard lot, quoted in USD (approximate for USD-quoted pairs).
const SYMBOLS: { symbol: string; pipValue: number; pipSize: number }[] = [
  { symbol: 'EURUSD', pipValue: 10, pipSize: 0.0001 },
  { symbol: 'GBPUSD', pipValue: 10, pipSize: 0.0001 },
  { symbol: 'AUDUSD', pipValue: 10, pipSize: 0.0001 },
  { symbol: 'NZDUSD', pipValue: 10, pipSize: 0.0001 },
  { symbol: 'USDCAD', pipValue: 7.4, pipSize: 0.0001 },
  { symbol: 'USDCHF', pipValue: 11.2, pipSize: 0.0001 },
  { symbol: 'USDJPY', pipValue: 6.7, pipSize: 0.01 },
  { symbol: 'EURJPY', pipValue: 6.7, pipSize: 0.01 },
  { symbol: 'GBPJPY', pipValue: 6.7, pipSize: 0.01 },
  { symbol: 'EURGBP', pipValue: 12.7, pipSize: 0.0001 },
  { symbol: 'XAUUSD', pipValue: 10, pipSize: 0.1 },
];

const LotCalculator = ({ suggestedBalance }: { suggestedBalance: number | null }) => {
  const [balance, setBalance] = useState('10000');
  const [risk, setRisk] = useState('1');
  const [slPips, setSlPips] = useState('20');
  const [symbol, setSymbol] = useState('EURUSD');
  const [customPip, setCustomPip] = useState('');

  const meta = SYMBOLS.find((s) => s.symbol === symbol)!;
  const pipValue = customPip ? Number(customPip) : meta.pipValue;

  const b = Number(balance) || 0;
  const r = Number(risk) || 0;
  const sl = Number(slPips) || 0;

  const riskAmount = (b * r) / 100;
  const lots = sl > 0 && pipValue > 0 ? riskAmount / (sl * pipValue) : 0;
  const valid = b > 0 && r > 0 && sl > 0 && pipValue > 0;

  return (
    <div className="tt-card">
      <div className="tt-card-head">
        <h2>Lot size calculator</h2>
        <span className="tt-hint mono">risk ÷ (SL pips × pip value)</span>
      </div>

      <div className="tt-fields">
        <label className="tt-field">
          <span>Account balance</span>
          <input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^\d.]/g, ''))} />
          {suggestedBalance !== null && (
            <button type="button" className="tt-mini" onClick={() => setBalance(String(Math.round(suggestedBalance)))}>
              Use journal equity ({suggestedBalance.toFixed(0)})
            </button>
          )}
        </label>

        <label className="tt-field">
          <span>Risk %</span>
          <input inputMode="decimal" value={risk} onChange={(e) => setRisk(e.target.value.replace(/[^\d.]/g, ''))} />
        </label>

        <label className="tt-field">
          <span>Stop loss (pips)</span>
          <input inputMode="decimal" value={slPips} onChange={(e) => setSlPips(e.target.value.replace(/[^\d.]/g, ''))} />
        </label>

        <label className="tt-field">
          <span>Symbol</span>
          <select value={symbol} onChange={(e) => { setSymbol(e.target.value); setCustomPip(''); }}>
            {SYMBOLS.map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}
          </select>
        </label>

        <label className="tt-field">
          <span>Pip value / lot (USD)</span>
          <input
            inputMode="decimal"
            placeholder={String(meta.pipValue)}
            value={customPip}
            onChange={(e) => setCustomPip(e.target.value.replace(/[^\d.]/g, ''))}
          />
        </label>
      </div>

      <div className="tt-result">
        <div>
          <span>Position size</span>
          <b className="mono">{valid ? `${lots.toFixed(2)} lots` : '—'}</b>
        </div>
        <div>
          <span>Risk amount</span>
          <b className="mono">{valid ? `$${riskAmount.toFixed(2)}` : '—'}</b>
        </div>
        <div>
          <span>Units</span>
          <b className="mono">{valid ? Math.round(lots * 100000).toLocaleString() : '—'}</b>
        </div>
      </div>
    </div>
  );
};

/* ---------------- MT5 live positions ---------------- */

type Position = {
  connection_id: string;
  connection_label: string;
  symbol: string;
  type: string;
  volume: number | null;
  openPrice: number | null;
  currentPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  profit: number | null;
  swap: number | null;
  commission: number | null;
  openTime: string | null;
};

const LivePositions = () => {
  const { scope, connections } = useAccountScope();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('mt5-positions', {
        body: scope === 'all' ? {} : { connection_id: scope },
      });
      if (fnErr || !data?.success) throw new Error(data?.message || fnErr?.message || 'Could not load positions');
      setPositions((data.positions ?? []) as Position[]);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load positions');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const total = positions.reduce((a, p) => a + Number(p.profit ?? 0), 0);

  return (
    <div className="tt-card">
      <div className="tt-card-head">
        <h2>
          <span className="tt-tag">MT5</span> Live trades
        </h2>
        <div className="tt-head-right">
          <span className="tt-hint mono">
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : 'Loading…'}
          </span>
          <button type="button" className="tt-refresh" onClick={load} disabled={loading} aria-label="Refresh positions">
            <span className={loading ? 'tt-spin' : ''}>⟳</span>
          </button>
        </div>
      </div>

      <div className="tt-scope-note">
        {scope === 'all'
          ? `All connected accounts (${connections.length})`
          : connections.find((c) => c.id === scope)?.label ?? 'Selected account'}
      </div>

      {error && <div className="tt-alert">{error}</div>}

      {!error && positions.length === 0 && !loading && (
        <div className="tt-empty">No open MT5 positions right now.</div>
      )}

      {positions.length > 0 && (
        <div className="tt-table-wrap">
          <table className="tt-table">
            <thead>
              <tr>
                <th>Symbol</th><th>Side</th><th>Vol</th><th>Open</th><th>Current</th><th>P&amp;L</th><th>Account</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => {
                const pnl = Number(p.profit ?? 0);
                return (
                  <tr key={`${p.connection_id}-${p.symbol}-${i}`} style={{ animationDelay: `${i * 40}ms` }}>
                    <td className="mono strong">{p.symbol}</td>
                    <td>
                      <span className={`tt-side ${String(p.type).toLowerCase() === 'short' ? 'sell' : 'buy'}`}>
                        {String(p.type).toLowerCase() === 'short' ? 'SELL' : 'BUY'}
                      </span>
                    </td>
                    <td className="mono">{p.volume ?? '—'}</td>
                    <td className="mono">{p.openPrice ?? '—'}</td>
                    <td className="mono">{p.currentPrice ?? '—'}</td>
                    <td className={`mono ${pnl >= 0 ? 'pos' : 'neg'}`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                    </td>
                    <td className="dim">{p.connection_label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="tt-total">
            <span>Floating P&amp;L</span>
            <b className={`mono ${total >= 0 ? 'pos' : 'neg'}`}>{total >= 0 ? '+' : ''}{total.toFixed(2)}</b>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------- Page ---------------- */

export default function TradingTools() {
  const { scope } = useAccountScope();
  const [equity, setEquity] = useState<number | null>(null);
  const [chartSymbol, setChartSymbol] = useState('FX:EURUSD');

  useEffect(() => {
    (async () => {
      let q = supabase.from('trades').select('pnl').eq('status', 'closed');
      if (scope !== 'all') q = q.eq('mt5_connection_id', scope);
      const { data } = await q;
      if (!data || data.length === 0) { setEquity(null); return; }
      setEquity(data.reduce((a, t: { pnl: number | null }) => a + Number(t.pnl ?? 0), 0));
    })();
  }, [scope]);

  const chartConfig = useMemo(
    () => ({
      autosize: true,
      symbol: chartSymbol,
      interval: '60',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(19,19,22,1)',
      gridColor: 'rgba(255,255,255,0.06)',
      hide_side_toolbar: false,
      allow_symbol_change: true,
      support_host: 'https://www.tradingview.com',
    }),
    [chartSymbol]
  );

  return (
    <div className="tt">
      <style>{styles}</style>

      <header className="tt-hd">
        <div className="tt-inner">
          <h1>Trading Tools</h1>
          <p className="tt-sub">
            Charts, position sizing, macro events and your live MT5 exposure — all in one workspace.
          </p>
        </div>
      </header>

      <div className="tt-inner tt-body">
        <div className="tt-card tt-chart-card">
          <div className="tt-card-head">
            <h2>Chart</h2>
            <div className="tt-symbols">
              {['FX:EURUSD', 'FX:GBPUSD', 'OANDA:XAUUSD', 'FX:USDJPY'].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`tt-chip ${chartSymbol === s ? 'on' : ''}`}
                  onClick={() => setChartSymbol(s)}
                >
                  {s.split(':')[1]}
                </button>
              ))}
            </div>
          </div>
          <div className="tt-chart">
            <TVWidget script="advanced-chart" config={chartConfig} height="100%" />
          </div>
        </div>

        <div className="tt-two">
          <LotCalculator suggestedBalance={equity !== null ? Math.max(equity, 0) + 10000 : null} />
          <LivePositions />
        </div>

        <div className="tt-card">
          <div className="tt-card-head">
            <h2>Economic calendar</h2>
            <span className="tt-hint">High-impact events, live</span>
          </div>
          <div className="tt-cal">
            <TVWidget
              script="events"
              config={{
                colorTheme: 'dark',
                isTransparent: true,
                width: '100%',
                height: '100%',
                locale: 'en',
                importanceFilter: '0,1',
                countryFilter: 'us,eu,gb,jp,ca,au,ch,nz',
              }}
              height="100%"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = `
.tt, .tt *{ box-sizing:border-box; }
.tt{
  --bg:#0A0A0C; --elev:#131316; --teal:#14C9AE; --blue:#3D6FE5; --rose:#C98A93;
  --text:#F3F1EC; --dim:#9B9A97; --dim2:#66655F;
  --line:rgba(255,255,255,.08); --line2:rgba(255,255,255,.16);
  background:var(--bg); color:var(--text); min-height:100%;
  font-family:'Inter',-apple-system,sans-serif; padding-bottom:4rem;
}
.tt .mono{ font-family:'IBM Plex Mono',ui-monospace,monospace; }
.tt-inner{ max-width:1180px; margin:0 auto; padding:0 1.25rem; }
.tt-hd{ padding:2.2rem 0 1.3rem; border-bottom:1px solid var(--line); margin-bottom:1.5rem; }
.tt-hd h1{ font-family:'Newsreader',serif; font-size:2rem; font-weight:600; letter-spacing:-.01em; }
.tt-sub{ color:var(--dim); margin-top:.45rem; font-size:.92rem; max-width:56ch; line-height:1.55; }
.tt-body{ display:grid; gap:1.15rem; }

.tt-card{
  background:var(--elev); border:1px solid var(--line); border-radius:16px; padding:1.15rem;
  animation:tt-in .45s cubic-bezier(.22,1,.36,1) both;
  transition:border-color .25s ease;
}
.tt-card:hover{ border-color:var(--line2); }
@keyframes tt-in{ from{opacity:0; transform:translateY(10px);} to{opacity:1; transform:none;} }

.tt-card-head{ display:flex; align-items:center; justify-content:space-between; gap:.75rem; flex-wrap:wrap; margin-bottom:.9rem; }
.tt-card-head h2{ font-size:1rem; font-weight:650; display:flex; align-items:center; gap:.5rem; }
.tt-hint{ color:var(--dim2); font-size:.72rem; }
.tt-head-right{ display:flex; align-items:center; gap:.6rem; }
.tt-tag{
  font-size:.6rem; letter-spacing:.12em; font-weight:800; padding:.2rem .42rem; border-radius:5px;
  background:rgba(61,111,229,.18); color:#94B0F5;
}
.tt-refresh{
  width:30px; height:30px; border-radius:8px; border:1px solid var(--line2);
  background:rgba(255,255,255,.02); color:var(--dim); cursor:pointer; font-size:.95rem; line-height:1;
  transition:color .2s ease, border-color .2s ease, transform .15s ease;
}
.tt-refresh:hover:not(:disabled){ color:var(--teal); border-color:var(--teal); }
.tt-refresh:disabled{ opacity:.6; cursor:default; }
.tt-spin{ display:inline-block; animation:tt-rot .9s linear infinite; }
@keyframes tt-rot{ to{ transform:rotate(360deg);} }

.tt-symbols{ display:flex; gap:.4rem; flex-wrap:wrap; }
.tt-chip{
  border:1px solid var(--line2); background:rgba(255,255,255,.02); color:var(--dim);
  border-radius:999px; padding:.3rem .75rem; font-size:.76rem; cursor:pointer; font-family:inherit;
  transition:color .2s ease, background .2s ease, border-color .2s ease, transform .15s ease;
}
.tt-chip:hover{ color:var(--text); transform:translateY(-1px); }
.tt-chip.on{ color:#06110E; background:linear-gradient(135deg,var(--teal),var(--blue)); border-color:transparent; font-weight:650; }

.tt-chart{ height:clamp(320px, 52vh, 620px); border-radius:12px; overflow:hidden; border:1px solid var(--line); }
.tt-cal{ height:clamp(360px, 55vh, 560px); border-radius:12px; overflow:hidden; border:1px solid var(--line); }

.tt-two{ display:grid; gap:1.15rem; grid-template-columns:1fr; }
@media (min-width: 980px){ .tt-two{ grid-template-columns:minmax(340px,.85fr) 1.15fr; } }

.tt-fields{ display:grid; gap:.85rem; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); }
.tt-field{ display:flex; flex-direction:column; gap:.35rem; }
.tt-field > span{ font-size:.7rem; letter-spacing:.09em; text-transform:uppercase; color:var(--dim2); font-weight:650; }
.tt-field input, .tt-field select{
  background:rgba(255,255,255,.03); border:1px solid var(--line2); border-radius:9px;
  padding:.6rem .7rem; color:var(--text); font-family:'IBM Plex Mono',monospace; font-size:.9rem;
  transition:border-color .2s ease, background .2s ease; width:100%;
}
.tt-field input:focus, .tt-field select:focus{ outline:none; border-color:var(--teal); background:rgba(20,201,174,.05); }
.tt-field select{ font-family:'Inter',sans-serif; }
.tt-field option{ background:#131316; }
.tt-mini{
  align-self:flex-start; background:none; border:none; color:var(--teal); font-size:.7rem;
  cursor:pointer; padding:0; font-family:inherit; text-decoration:underline; text-underline-offset:2px;
}

.tt-result{
  margin-top:1.1rem; display:grid; gap:.6rem; grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
  border-top:1px solid var(--line); padding-top:1rem;
}
.tt-result > div{ display:flex; flex-direction:column; gap:.25rem; }
.tt-result span{ font-size:.7rem; letter-spacing:.08em; text-transform:uppercase; color:var(--dim2); }
.tt-result b{ font-size:1.15rem; font-weight:650; }
.tt-result > div:first-child b{ color:var(--teal); font-size:1.5rem; }

.tt-scope-note{ font-size:.75rem; color:var(--dim2); margin-bottom:.7rem; }
.tt-alert{ border:1px solid rgba(201,138,147,.35); background:rgba(201,138,147,.08); color:var(--rose); border-radius:10px; padding:.65rem .8rem; font-size:.82rem; }
.tt-empty{ color:var(--dim); font-size:.85rem; padding:1.4rem 0; text-align:center; border:1px dashed var(--line); border-radius:12px; }

.tt-table-wrap{ overflow-x:auto; }
.tt-table{ width:100%; border-collapse:collapse; font-size:.83rem; min-width:560px; }
.tt-table th{
  text-align:left; font-size:.66rem; letter-spacing:.1em; text-transform:uppercase; color:var(--dim2);
  font-weight:650; padding:.4rem .55rem; border-bottom:1px solid var(--line);
}
.tt-table td{ padding:.6rem .55rem; border-bottom:1px solid rgba(255,255,255,.04); }
.tt-table tbody tr{ animation:tt-row .35s ease both; }
@keyframes tt-row{ from{opacity:0; transform:translateY(5px);} to{opacity:1;transform:none;} }
.tt-table .strong{ font-weight:600; }
.tt-table .dim{ color:var(--dim); }
.tt-table .pos{ color:var(--teal); }
.tt-table .neg{ color:var(--rose); }
.tt-side{ font-size:.64rem; font-weight:750; letter-spacing:.08em; padding:.18rem .42rem; border-radius:5px; }
.tt-side.buy{ background:rgba(61,111,229,.16); color:#94B0F5; }
.tt-side.sell{ background:rgba(201,138,147,.16); color:var(--rose); }
.tt-total{ display:flex; justify-content:space-between; align-items:center; padding-top:.8rem; margin-top:.2rem; }
.tt-total span{ font-size:.7rem; letter-spacing:.09em; text-transform:uppercase; color:var(--dim2); }
.tt-total b{ font-size:1.05rem; }
.tt-total .pos{ color:var(--teal); }
.tt-total .neg{ color:var(--rose); }
`;
