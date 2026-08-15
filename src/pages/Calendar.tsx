import { useMemo, useState } from 'react';
import { useTrades } from '@/hooks/useTrades';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  format, isSameMonth, isSameDay, parseISO, addMonths, subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, X, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, pnlClass } from '@/lib/format';
import { Link } from 'react-router-dom';
import { SymbolLogo } from '@/components/SymbolLogo';
import { cn } from '@/lib/utils';

type DayData = { pnl: number; count: number; wins: number; trades: any[] };

const Calendar = () => {
  const { data: trades } = useTrades();
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const byDay = useMemo(() => {
    const m = new Map<string, DayData>();
    (trades ?? []).forEach(t => {
      if (!t.exit_at) return;
      const k = format(parseISO(t.exit_at), 'yyyy-MM-dd');
      const cur = m.get(k) ?? { pnl: 0, count: 0, wins: 0, trades: [] };
      cur.pnl += Number(t.pnl ?? 0);
      cur.count += 1;
      if (Number(t.pnl ?? 0) > 0) cur.wins += 1;
      cur.trades.push(t);
      m.set(k, cur);
    });
    return m;
  }, [trades]);

  const monthly = useMemo(() => {
    let pnl = 0, count = 0, wins = 0;
    days.filter(d => isSameMonth(d, cursor)).forEach(d => {
      const v = byDay.get(format(d, 'yyyy-MM-dd'));
      if (v) { pnl += v.pnl; count += v.count; wins += v.wins; }
    });
    return { pnl, count, wins, winRate: count ? (wins / count) * 100 : 0 };
  }, [days, byDay, cursor]);

  const maxAbs = useMemo(() => {
    let m = 0;
    days.forEach(d => {
      const v = byDay.get(format(d, 'yyyy-MM-dd'));
      if (v) m = Math.max(m, Math.abs(v.pnl));
    });
    return m || 1;
  }, [days, byDay]);

  const tier = (pnl: number): 'sm' | 'md' | 'lg' => {
    const r = Math.abs(pnl) / maxAbs;
    if (r >= 0.66) return 'lg';
    if (r >= 0.33) return 'md';
    return 'sm';
  };

  const selectedData = selected ? byDay.get(selected) : null;

  const goPrev = () => { setDir(-1); setCursor(subMonths(cursor, 1)); };
  const goNext = () => { setDir(1); setCursor(addMonths(cursor, 1)); };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5 md:space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4 animate-fade-up">
        <div>
          <h1 className="font-display text-display-xl">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Daily P&L · {monthly.count} trades · {monthly.winRate.toFixed(0)}% win rate</p>
        </div>
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/50 border border-border/60">
          <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={goPrev}><ChevronLeft className="size-4" /></Button>
          <div className="font-display font-semibold text-base w-36 text-center">{format(cursor, 'MMMM yyyy')}</div>
          <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={goNext}><ChevronRight className="size-4" /></Button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3 md:gap-4 animate-fade-up">
        <Stat label="Net P&L" value={formatCurrency(monthly.pnl, { sign: true })} valueClass={pnlClass(monthly.pnl)} />
        <Stat label="Trades" value={String(monthly.count)} />
        <Stat label="Win rate" value={`${monthly.winRate.toFixed(0)}%`} />
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        <div className="luxe-card p-4 md:p-5 flex-1 min-w-0">
          <div className="grid grid-cols-7 md:grid-cols-[repeat(7,minmax(0,1fr))_auto] gap-2 mb-2">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} className="text-center text-[10px] uppercase tracking-wider text-muted-foreground/80 py-1.5 font-semibold">{d}</div>
            ))}
            <div className="hidden md:block text-center text-[10px] uppercase tracking-wider text-muted-foreground/80 py-1.5 font-semibold w-24">Week</div>
          </div>

          <div
            key={format(cursor, 'yyyy-MM')}
            className="space-y-1.5 md:space-y-2.5"
            style={{ animation: `${dir > 0 ? 'cal-in-right' : 'cal-in-left'} 0.32s cubic-bezier(0.22,1,0.36,1) both` }}
          >
            {Array.from({ length: Math.ceil(days.length / 7) }).map((_, wi) => {
              const week = days.slice(wi * 7, wi * 7 + 7);
              const wkStats = week.reduce((s, d) => {
                const v = byDay.get(format(d, 'yyyy-MM-dd'));
                if (v) { s.pnl += v.pnl; s.count += v.count; s.wins += v.wins; }
                return s;
              }, { pnl: 0, count: 0, wins: 0 });
              const wkWinRate = wkStats.count ? Math.round((wkStats.wins / wkStats.count) * 100) : 0;

              return (
                <div key={wi} className="grid grid-cols-7 md:grid-cols-[repeat(7,minmax(0,1fr))_auto] gap-1.5 md:gap-2.5">
                  {week.map(d => {
                    const k = format(d, 'yyyy-MM-dd');
                    const data = byDay.get(k);
                    const inMonth = isSameMonth(d, cursor);
                    const today = isSameDay(d, new Date());
                    const isSel = selected === k;
                    const positive = !!data && data.pnl > 0;
                    const negative = !!data && data.pnl < 0;
                    const evenDay = !!data && data.pnl === 0;
                    const filled = positive || negative || evenDay;
                    const t = data && (positive || negative) ? tier(data.pnl) : null;
                    const richFill = t === 'lg';

                    const fillStyle = positive && t
                      ? { backgroundColor: `hsl(var(--cal-win-${t}))`, borderColor: `hsl(var(--cal-win-${t === 'sm' ? 'md' : t}) / 0.5)` }
                      : negative && t
                        ? { backgroundColor: `hsl(var(--cal-loss-${t}))`, borderColor: `hsl(var(--cal-loss-${t === 'sm' ? 'md' : t}) / 0.5)` }
                        : evenDay
                          ? { backgroundColor: 'hsl(var(--cal-even))', borderColor: 'hsl(var(--border))' }
                          : undefined;

                    const textColor = richFill
                      ? 'text-white'
                      : positive
                        ? 'text-[hsl(var(--cal-win-fg-soft))]'
                        : negative
                          ? 'text-[hsl(var(--cal-loss-fg-soft))]'
                          : 'text-foreground';

                    return (
                      <button
                        key={d.toISOString()}
                        onClick={() => setSelected(isSel ? null : k)}
                        style={fillStyle}
                        className={cn(
                          'relative aspect-square rounded-2xl p-1.5 md:p-2 text-left border transition-all duration-300 ease-out press',
                          'hover:-translate-y-0.5 hover:shadow-md',
                          inMonth ? 'opacity-100' : 'opacity-35',
                          !filled && 'bg-card border-border/50 hover:border-border',
                          isSel && 'ring-2 ring-primary/70 ring-offset-2 ring-offset-card',
                          today && !isSel && 'outline outline-1 outline-primary/50',
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <span className={cn(
                            'text-[11px] md:text-xs font-semibold tabular-nums',
                            filled ? textColor : (today ? 'text-primary' : 'text-foreground/70'),
                          )}>{format(d, 'd')}</span>
                          {data && (
                            positive
                              ? <TrendingUp className={cn('size-2.5 md:size-3', richFill ? 'text-white/85' : 'text-[hsl(var(--cal-win-fg-soft))]/70')} />
                              : negative
                                ? <TrendingDown className={cn('size-2.5 md:size-3', richFill ? 'text-white/85' : 'text-[hsl(var(--cal-loss-fg-soft))]/70')} />
                                : <Minus className="size-2.5 md:size-3 text-muted-foreground" />
                          )}
                        </div>
                        {data && (
                          <div className="absolute inset-x-1.5 bottom-1 md:bottom-1.5">
                            <div className={cn('text-[10px] md:text-[11px] font-mono font-semibold leading-none', textColor)}>
                              {data.pnl >= 0 ? '+' : ''}{Math.round(data.pnl)}
                            </div>
                            <div className={cn(
                              'text-[8px] md:text-[9px] mt-0.5 leading-none',
                              richFill ? 'text-white/70' : filled ? `${textColor} opacity-60` : 'text-muted-foreground',
                            )}>{data.count}t</div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                  <div className="hidden md:flex w-24 flex-col justify-center rounded-2xl bg-card border border-border/60 px-2.5 py-2 shadow-xs">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Wk {wi + 1}</div>
                    <div className={cn('text-[12px] font-mono font-semibold tabular-nums mt-1', pnlClass(wkStats.pnl))}>
                      {wkStats.pnl >= 0 ? '+' : ''}{Math.round(wkStats.pnl)}
                    </div>
                    <div className="flex items-center justify-between mt-1 gap-1.5">
                      <span className="text-[9px] font-mono tabular-nums text-foreground/70">{wkWinRate}%</span>
                      <span className="text-[9px] font-mono tabular-nums text-muted-foreground">{wkStats.count}t</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end flex-wrap gap-3 mt-4 text-[10px] text-muted-foreground">
            <Dot color="bg-[hsl(var(--cal-win-lg))]" /> Profit
            <Dot color="bg-[hsl(var(--cal-loss-lg))]" /> Loss
            <Dot color="bg-[hsl(var(--cal-even))]" /> Break-even
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full border border-border bg-card" /> No trades</span>
          </div>
        </div>

        <aside
          className={cn(
            'lg:w-80 shrink-0 transition-all duration-300',
            selectedData ? 'opacity-100 translate-x-0' : 'opacity-0 lg:translate-x-2 pointer-events-none hidden lg:block',
          )}
          style={{ animation: selectedData ? 'slide-in-right 0.3s cubic-bezier(0.22,1,0.36,1) both' : undefined }}
        >
          {selectedData && selected && (
            <div className="luxe-card p-5 sticky top-20 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{format(parseISO(selected), 'EEEE')}</div>
                  <div className="font-display text-xl font-semibold mt-0.5">{format(parseISO(selected), 'MMM d, yyyy')}</div>
                </div>
                <Button variant="ghost" size="icon" className="size-7 rounded-md" onClick={() => setSelected(null)}><X className="size-4" /></Button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat label="P&L" value={formatCurrency(selectedData.pnl, { sign: true })} valueClass={pnlClass(selectedData.pnl)} />
                <MiniStat label="Trades" value={String(selectedData.count)} />
                <MiniStat label="Win rate" value={`${Math.round((selectedData.wins / selectedData.count) * 100)}%`} />
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Trades</div>
                {selectedData.trades.map((t: any) => (
                  <Link key={t.id} to={`/trades/${t.id}`} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 hover:bg-secondary/70 transition-colors">
                    <div>
                      <div className="text-sm font-medium inline-flex items-center gap-1.5"><SymbolLogo symbol={t.asset} />{t.asset}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{t.direction}</div>
                    </div>
                    <div className={cn('font-mono text-sm font-semibold', pnlClass(t.pnl))}>{formatCurrency(t.pnl, { sign: true })}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {selectedData && selected && (
        <div className="lg:hidden luxe-card p-5 space-y-4 animate-slide-up">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{format(parseISO(selected), 'EEEE')}</div>
              <div className="font-display text-lg font-semibold mt-0.5">{format(parseISO(selected), 'MMM d, yyyy')}</div>
            </div>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setSelected(null)}><X className="size-4" /></Button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat label="P&L" value={formatCurrency(selectedData.pnl, { sign: true })} valueClass={pnlClass(selectedData.pnl)} />
            <MiniStat label="Trades" value={String(selectedData.count)} />
            <MiniStat label="Win rate" value={`${Math.round((selectedData.wins / selectedData.count) * 100)}%`} />
          </div>
          <div className="space-y-1.5">
            {selectedData.trades.map((t: any) => (
              <Link key={t.id} to={`/trades/${t.id}`} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40">
                <div className="text-sm font-medium inline-flex items-center gap-1.5"><SymbolLogo symbol={t.asset} />{t.asset}</div>
                <div className={cn('font-mono text-sm font-semibold', pnlClass(t.pnl))}>{formatCurrency(t.pnl, { sign: true })}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes cal-in-right { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes cal-in-left { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slide-in-right { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
};

const Stat = ({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) => (
  <div className="luxe-card p-3 md:p-4">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
    <div className={cn('font-mono text-lg md:text-xl font-semibold mt-1', valueClass)}>{value}</div>
  </div>
);

const MiniStat = ({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) => (
  <div className="p-2.5 rounded-lg bg-secondary/40">
    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
    <div className={cn('font-mono text-sm font-semibold mt-0.5', valueClass)}>{value}</div>
  </div>
);

const Dot = ({ color }: { color: string }) => (
  <span className="inline-flex items-center gap-1"><span className={cn('size-2 rounded-full', color)} /></span>
);

export default Calendar;
