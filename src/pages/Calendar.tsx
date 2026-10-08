import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  format, isSameMonth, isSameDay, parseISO, addMonths, subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTrades, type Trade } from '@/hooks/useTrades';
import { useCountUp } from '@/hooks/useCountUp';
import { formatCurrency } from '@/lib/format';
import { SymbolLogo } from '@/components/SymbolLogo';
import { IosSheet } from '@/components/IosSheet';

type DayData = { pnl: number; count: number; wins: number; trades: Trade[] };

const SURFACE = 'bg-card border border-border rounded-[24px]';
const SHADOW = { boxShadow: 'var(--ios-sh, 0 1px 2px rgba(0,0,0,.05))' } as const;
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const tap = () => { try { navigator.vibrate?.(8); } catch { /* not supported */ } };
const money = (n: number) => formatCurrency(n, { sign: true });
const tone = (n: number) => (n >= 0 ? 'hsl(var(--bull))' : 'hsl(var(--bear))');
const short = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1)}k` : Math.round(Math.abs(n))}`;
const dayKey = (t: Trade) => { const d = t.exit_at ?? t.entry_at; return d ? format(parseISO(d), 'yyyy-MM-dd') : null; };

const Calendar = () => {
  const { data: trades } = useTrades();
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
  }), [cursor]);

  // a closed trade is placed on its exit day (or its entry day if the exit date is missing)
  const byDay = useMemo(() => {
    const m = new Map<string, DayData>();
    (trades ?? []).filter((t) => t.status === 'closed' && t.pnl !== null).forEach((t) => {
      const k = dayKey(t);
      if (!k) return;
      const cur = m.get(k) ?? { pnl: 0, count: 0, wins: 0, trades: [] };
      cur.pnl += Number(t.pnl); cur.count += 1; if (Number(t.pnl) > 0) cur.wins += 1; cur.trades.push(t);
      m.set(k, cur);
    });
    return m;
  }, [trades]);

  const month = useMemo(() => {
    let pnl = 0, count = 0, wins = 0, greenDays = 0, redDays = 0;
    let best: { k: string; pnl: number } | null = null, worst: { k: string; pnl: number } | null = null;
    days.filter((d) => isSameMonth(d, cursor)).forEach((d) => {
      const k = format(d, 'yyyy-MM-dd'), v = byDay.get(k);
      if (!v) return;
      pnl += v.pnl; count += v.count; wins += v.wins;
      if (v.pnl > 0) greenDays++; else if (v.pnl < 0) redDays++;
      if (!best || v.pnl > best.pnl) best = { k, pnl: v.pnl };
      if (!worst || v.pnl < worst.pnl) worst = { k, pnl: v.pnl };
    });
    return { pnl, count, wins, winRate: count ? (wins / count) * 100 : null, greenDays, redDays, tradingDays: greenDays + redDays, best, worst };
  }, [days, byDay, cursor]);

  const maxAbs = useMemo(() => Math.max(1, ...days.map((d) => Math.abs(byDay.get(format(d, 'yyyy-MM-dd'))?.pnl ?? 0))), [days, byDay]);
  const tier = (pnl: number): 'sm' | 'md' | 'lg' => { const r = Math.abs(pnl) / maxAbs; return r >= 0.66 ? 'lg' : r >= 0.33 ? 'md' : 'sm'; };
  const shownNet = useCountUp(month.count ? month.pnl : null);
  const sel = selected ? byDay.get(selected) ?? null : null;
  const isCurrentMonth = isSameMonth(cursor, new Date());

  const go = (d: 1 | -1) => { tap(); setDir(d); setCursor(d > 0 ? addMonths(cursor, 1) : subMonths(cursor, 1)); };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; touch.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 55 && Math.abs(dy) < 45) go(dx < 0 ? 1 : -1);
  };

  const pick = (k: string) => { tap(); setSelected(k); };

  return (
    <div className="px-4 md:px-8 pt-4 pb-10 max-w-3xl mx-auto">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[34px] leading-[1.1] font-bold tracking-tight">{format(cursor, 'MMMM')} <span className="text-muted-foreground font-semibold">{format(cursor, 'yyyy')}</span></h1>
          <p className="text-[14px] text-muted-foreground mt-1 tabular-nums">
            {month.count ? `${month.count} trade${month.count === 1 ? '' : 's'} on ${month.tradingDays} day${month.tradingDays === 1 ? '' : 's'}` : 'No closed trades this month'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {!isCurrentMonth && (
            <button onClick={() => { tap(); setDir(cursor > new Date() ? -1 : 1); setCursor(new Date()); }} className={`${FOCUS} h-9 px-3.5 rounded-full bg-secondary text-[13.5px] font-semibold`}>Today</button>
          )}
          <button onClick={() => go(-1)} aria-label="Previous month" className={`${FOCUS} size-9 rounded-full bg-secondary grid place-items-center`}><ChevronLeft className="size-[18px]" /></button>
          <button onClick={() => go(1)} aria-label="Next month" className={`${FOCUS} size-9 rounded-full bg-secondary grid place-items-center`}><ChevronRight className="size-[18px]" /></button>
        </div>
      </header>

      <div className={`${SURFACE} grid grid-cols-3 mt-4`} style={SHADOW}>
        {[
          ['Net result', month.count ? money(shownNet) : '—', month.count ? tone(month.pnl) : undefined],
          ['Win rate', month.winRate === null ? '—' : `${month.winRate.toFixed(0)}%`, undefined],
          ['Green / red days', month.tradingDays ? `${month.greenDays} / ${month.redDays}` : '—', undefined],
        ].map(([l, v, c], i) => (
          <div key={l as string} className={`py-3.5 px-4 ${i ? 'border-l border-border' : ''}`}>
            <div className="text-[12px] text-muted-foreground">{l}</div>
            <div className="text-[18px] font-semibold tabular-nums" style={c ? { color: c as string } : undefined}>{v}</div>
          </div>
        ))}
      </div>

      <div className={`${SURFACE} p-3 md:p-5 mt-4`} style={SHADOW} onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }} onTouchEnd={onTouchEnd}>
        <div className="grid grid-cols-7 md:grid-cols-[repeat(7,minmax(0,1fr))_auto] gap-1.5 md:gap-2 mb-1.5">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="text-center text-[11px] text-muted-foreground py-1 font-semibold">{d}</div>)}
          <div className="hidden md:block w-20" />
        </div>
        <div key={format(cursor, 'yyyy-MM')} className="space-y-1.5 md:space-y-2" style={{ animation: `${dir > 0 ? 'cal-in-right' : 'cal-in-left'} .32s cubic-bezier(.22,1,.36,1) both` }}>
          {Array.from({ length: Math.ceil(days.length / 7) }).map((_, wi) => {
            const week = days.slice(wi * 7, wi * 7 + 7);
            const wk = week.reduce((s, d) => { const v = byDay.get(format(d, 'yyyy-MM-dd')); if (v && isSameMonth(d, cursor)) { s.pnl += v.pnl; s.count += v.count; } return s; }, { pnl: 0, count: 0 });
            return (
              <div key={wi} className="grid grid-cols-7 md:grid-cols-[repeat(7,minmax(0,1fr))_auto] gap-1.5 md:gap-2">
                {week.map((d) => {
                  const k = format(d, 'yyyy-MM-dd'), data = byDay.get(k), inMonth = isSameMonth(d, cursor), today = isSameDay(d, new Date());
                  const win = !!data && data.pnl > 0, loss = !!data && data.pnl < 0, even = !!data && data.pnl === 0;
                  const t = data && (win || loss) ? tier(data.pnl) : null;
                  const rich = t === 'lg';
                  const style = win && t ? { backgroundColor: `hsl(var(--cal-win-${t}))` } : loss && t ? { backgroundColor: `hsl(var(--cal-loss-${t}))` } : even ? { backgroundColor: 'hsl(var(--cal-even))' } : undefined;
                  const ink = rich ? 'text-white' : win ? 'text-[hsl(var(--cal-win-fg-soft))]' : loss ? 'text-[hsl(var(--cal-loss-fg-soft))]' : 'text-foreground';
                  return (
                    <button key={k} disabled={!data} onClick={() => pick(k)} style={style}
                      aria-label={`${format(d, 'EEEE, MMMM d')}${data ? `, ${data.count} trade${data.count === 1 ? '' : 's'}, ${money(data.pnl)}` : ', no trades'}`}
                      className={`${FOCUS} relative aspect-square rounded-[14px] p-1.5 text-left transition active:scale-[.94] disabled:active:scale-100 ${inMonth ? '' : 'opacity-35'} ${data ? '' : 'bg-secondary/40'} ${today ? 'ring-2 ring-primary' : ''}`}>
                      <span className={`text-[12px] font-semibold tabular-nums ${data ? ink : today ? 'text-primary' : 'text-foreground/70'}`}>{format(d, 'd')}</span>
                      {data && <span className={`absolute inset-x-1.5 bottom-1.5 text-[10.5px] md:text-[11.5px] font-semibold tabular-nums leading-none ${ink}`}>{short(data.pnl)}</span>}
                    </button>
                  );
                })}
                <div className="hidden md:flex w-20 flex-col justify-center rounded-[14px] bg-secondary/40 px-2.5">
                  <div className="text-[10px] text-muted-foreground">Week {wi + 1}</div>
                  <div className="text-[13px] font-semibold tabular-nums" style={wk.count ? { color: tone(wk.pnl) } : undefined}>{wk.count ? short(wk.pnl) : '—'}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-4 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{ background: 'hsl(var(--cal-win-lg))' }} />Profit</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{ background: 'hsl(var(--cal-loss-lg))' }} />Loss</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-secondary border border-border" />No trades</span>
        </div>
      </div>

      {month.tradingDays >= 2 && month.best && month.worst && (
        <div className={`${SURFACE} px-4 mt-4`} style={SHADOW}>
          {([['Best day', month.best], ['Hardest day', month.worst]] as [string, { k: string; pnl: number }][]).map(([label, v]) => {
            return (
              <button key={label} onClick={() => pick(v.k)} className={`${FOCUS} w-full flex items-center justify-between py-3.5 border-t border-border first:border-t-0 text-left`}>
                <div><div className="text-[15px]">{label}</div><div className="text-[12.5px] text-muted-foreground">{format(parseISO(v.k), 'EEEE, MMM d')}</div></div>
                <div className="text-[16px] font-semibold tabular-nums" style={{ color: tone(v.pnl) }}>{money(v.pnl)}</div>
              </button>
            );
          })}
        </div>
      )}

      {sel && selected && (
        <IosSheet title={format(parseISO(selected), 'EEEE, MMM d')} onClose={() => setSelected(null)}>
          <div className={`${SURFACE} grid grid-cols-3`} style={SHADOW}>
            {[['Result', money(sel.pnl), tone(sel.pnl)], ['Trades', String(sel.count), undefined], ['Win rate', `${Math.round((sel.wins / sel.count) * 100)}%`, undefined]].map(([l, v, c], i) => (
              <div key={l as string} className={`py-3 px-3.5 ${i ? 'border-l border-border' : ''}`}>
                <div className="text-[12px] text-muted-foreground">{l}</div>
                <div className="text-[17px] font-semibold tabular-nums" style={c ? { color: c as string } : undefined}>{v}</div>
              </div>
            ))}
          </div>
          <div className={`${SURFACE} px-4 mt-3`} style={SHADOW}>
            {[...sel.trades].sort((a, b) => Number(b.pnl) - Number(a.pnl)).map((t) => {
              const note = t.thesis || t.notes;
              return (
                <Link key={t.id} to={`/trades/${t.id}`} onClick={() => setSelected(null)} className={`${FOCUS} flex items-start gap-3 py-3 border-t border-border first:border-t-0 active:opacity-60 transition-opacity`}>
                  <SymbolLogo symbol={t.asset} size={30} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold">{t.asset} <span className="font-normal text-muted-foreground">{t.direction === 'short' ? 'Short' : 'Long'}</span></div>
                    {note && <p className="text-[12.5px] text-muted-foreground line-clamp-2 mt-0.5">{note}</p>}
                  </div>
                  <div className="text-[15px] font-semibold tabular-nums shrink-0" style={{ color: tone(Number(t.pnl)) }}>{money(Number(t.pnl))}</div>
                </Link>
              );
            })}
          </div>
        </IosSheet>
      )}

      <style>{`
        @keyframes cal-in-right { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes cal-in-left { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }
        @media (prefers-reduced-motion: reduce) { [style*="cal-in"] { animation: none !important; } }
      `}</style>
    </div>
  );
};

export default Calendar;
