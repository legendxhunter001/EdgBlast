import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Plus, Search, X } from 'lucide-react';
import { useStrategies, useTrades, type Trade } from '@/hooks/useTrades';
import { formatCurrency } from '@/lib/format';
import { SymbolLogo } from '@/components/SymbolLogo';
import { Skeleton } from '@/components/ui/skeleton';

const SURFACE = 'bg-card border border-border rounded-[24px]';
const SHADOW = { boxShadow: 'var(--ios-sh, 0 1px 2px rgba(0,0,0,.05))' } as const;
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const tap = () => { try { navigator.vibrate?.(8); } catch { /* not supported */ } };
const tone = (n: number) => (n >= 0 ? 'hsl(var(--bull))' : 'hsl(var(--bear))');
const money = (n: number) => formatCurrency(n, { sign: true });

type Filter = 'all' | 'open' | 'wins' | 'losses' | 'long' | 'short';
type Sort = 'date' | 'pnl' | 'asset';
const FILTERS: [Filter, string][] = [['all', 'All'], ['open', 'Open'], ['wins', 'Wins'], ['losses', 'Losses'], ['long', 'Long'], ['short', 'Short']];
const SORTS: [Sort, string][] = [['date', 'Newest'], ['pnl', 'Best result'], ['asset', 'A to Z']];

type Row = { kind: 'head'; id: string; label: string } | { kind: 'trade'; id: string; trade: Trade };

const Trades = () => {
  const { data: trades, isLoading } = useTrades();
  const { data: strategies = [] } = useStrategies();
  const reduce = !!useReducedMotion();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('date');

  const all = trades ?? [];
  const when = (t: Trade) => t.entry_at || t.created_at;

  const list = useMemo(() => {
    let l = all;
    const q = search.trim().toLowerCase();
    if (q) l = l.filter((t) => t.asset.toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q));
    if (filter === 'open') l = l.filter((t) => t.status === 'open');
    if (filter === 'wins') l = l.filter((t) => Number(t.pnl ?? 0) > 0);
    if (filter === 'losses') l = l.filter((t) => Number(t.pnl ?? 0) < 0);
    if (filter === 'long') l = l.filter((t) => t.direction === 'long');
    if (filter === 'short') l = l.filter((t) => t.direction === 'short');
    return [...l].sort((a, b) =>
      sort === 'pnl' ? Number(b.pnl ?? 0) - Number(a.pnl ?? 0)
      : sort === 'asset' ? a.asset.localeCompare(b.asset)
      : when(b).localeCompare(when(a)));
  }, [all, search, filter, sort]);

  const net = list.filter((t) => t.pnl !== null).reduce((s, t) => s + Number(t.pnl), 0);
  const hasResults = list.some((t) => t.pnl !== null);
  const maxAbs = Math.max(1, ...list.map((t) => Math.abs(Number(t.pnl ?? 0))));

  // one flat list of month headers and trade cards, so every item can glide to its new place
  const rows = useMemo<Row[]>(() => {
    if (sort !== 'date') return list.map((t) => ({ kind: 'trade' as const, id: t.id, trade: t }));
    const out: Row[] = [];
    let last = '';
    list.forEach((t) => {
      const label = format(parseISO(when(t)), 'MMMM yyyy');
      if (label !== last) { out.push({ kind: 'head', id: `h-${label}`, label }); last = label; }
      out.push({ kind: 'trade', id: t.id, trade: t });
    });
    return out;
  }, [list, sort]);

  const animate = list.length <= 120 && !reduce; // layout animation is only worth it on a normal-size list
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.9 };
  const stratName = (id: string | null) => strategies.find((s) => s.id === id)?.name;
  const filtering = search.trim() !== '' || filter !== 'all';

  return (
    <div className="px-4 md:px-8 pt-4 pb-10 max-w-3xl mx-auto">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] leading-[1.1] font-bold tracking-tight">Trades</h1>
          <p className="text-[14px] text-muted-foreground mt-1 tabular-nums">
            {isLoading ? ' ' : filtering ? `${list.length} of ${all.length} trades` : `${all.length} trade${all.length === 1 ? '' : 's'}`}
            {hasResults && ` · ${money(net)}`}
          </p>
        </div>
        <Link to="/trades/new" className={`${FOCUS} hidden md:inline-flex h-11 items-center gap-2 px-5 rounded-[14px] bg-primary text-primary-foreground text-[15px] font-semibold`}>
          <Plus className="size-4" /> New trade
        </Link>
      </header>

      <div className="relative mt-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-[17px] text-muted-foreground pointer-events-none" aria-hidden />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pair or notes" aria-label="Search trades"
          className="w-full pl-10 pr-10 bg-secondary text-[16px] rounded-[12px] outline-none border border-transparent focus:border-primary" />
        {search && (
          <button onClick={() => setSearch('')} aria-label="Clear search" className={`${FOCUS} absolute right-2 top-1/2 -translate-y-1/2 size-7 rounded-full grid place-items-center text-muted-foreground`}>
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 mt-3" role="group" aria-label="Filter trades">
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => { tap(); setFilter(k); }} aria-pressed={filter === k}
            className={`${FOCUS} relative shrink-0 h-9 px-4 rounded-full text-[14px] font-semibold bg-secondary transition-colors ${filter === k ? 'text-primary-foreground' : 'text-foreground'}`}>
            {filter === k && <motion.span layoutId="trades-filter-pill" className="absolute inset-0 rounded-full bg-primary" transition={spring} />}
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mt-4 mb-1 px-1">
        <span className="text-[13px] text-muted-foreground">Sort by</span>
        <div className="flex p-[2px] rounded-[9px] bg-secondary" role="group" aria-label="Sort trades">
          {SORTS.map(([k, label]) => (
            <button key={k} onClick={() => { tap(); setSort(k); }} aria-pressed={sort === k}
              className={`${FOCUS} relative px-3 py-1 rounded-[7px] text-[12.5px] font-semibold transition-colors ${sort === k ? '' : 'text-muted-foreground'}`}>
              {sort === k && <motion.span layoutId="trades-sort-thumb" className="absolute inset-0 rounded-[7px] bg-card shadow-sm" transition={spring} />}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 mt-3" aria-busy="true">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-[22px]" />)}</div>
      ) : all.length === 0 ? (
        <div className={`${SURFACE} p-8 text-center mt-3`} style={SHADOW}>
          <div className="font-display text-[18px] font-bold">No trades yet</div>
          <p className="text-[14px] text-muted-foreground mt-1">Log your first trade, or connect MT5 and they'll show up on their own.</p>
          <Link to="/trades/new" className={`${FOCUS} inline-flex mt-4 h-11 items-center gap-2 px-5 rounded-[14px] bg-primary text-primary-foreground text-[15px] font-semibold`}><Plus className="size-4" /> Log a trade</Link>
        </div>
      ) : list.length === 0 ? (
        <div className={`${SURFACE} p-8 text-center mt-3`} style={SHADOW}>
          <div className="font-display text-[18px] font-bold">Nothing matches</div>
          <p className="text-[14px] text-muted-foreground mt-1">No trades fit that search and filter.</p>
          <button onClick={() => { setSearch(''); setFilter('all'); }} className={`${FOCUS} mt-4 h-10 px-4 rounded-[12px] bg-secondary text-[14px] font-semibold`}>Clear filters</button>
        </div>
      ) : (
        <div className="relative mt-1">
          <AnimatePresence mode="popLayout" initial>
            {rows.map((r, i) => {
              const motionProps = {
                layout: animate ? ('position' as const) : false,
                initial: reduce ? false : { opacity: 0, y: 14, scale: 0.985 },
                animate: { opacity: 1, y: 0, scale: 1 },
                exit: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 },
                transition: { ...spring, delay: reduce ? 0 : Math.min(i, 9) * 0.03 },
              };
              if (r.kind === 'head') {
                return <motion.h2 key={r.id} {...motionProps} className="text-[13px] font-semibold text-muted-foreground px-1.5 pt-5 pb-2">{r.label}</motion.h2>;
              }
              const t = r.trade;
              const rr = t.risk_reward !== null && Number(t.risk_reward) !== 0 ? Number(t.risk_reward) : null;
              const strat = stratName(t.strategy_id);
              const pnl = t.pnl === null ? null : Number(t.pnl);
              return (
                <motion.div key={r.id} {...motionProps} whileTap={reduce ? undefined : { scale: 0.975 }} className="mb-3">
                  <Link to={`/trades/${t.id}`} className={`${FOCUS} block ${SURFACE} p-4`} style={SHADOW}>
                    <div className="flex items-center gap-3">
                      <SymbolLogo symbol={t.asset} size={38} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[17px] font-semibold truncate">{t.asset}</div>
                        <div className="text-[12.5px] text-muted-foreground truncate">
                          {t.direction === 'short' ? 'Short' : 'Long'} · {format(parseISO(when(t)), 'MMM d, yyyy')}{strat ? ` · ${strat}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {pnl === null
                          ? <span className="inline-flex px-2.5 py-1 rounded-full bg-secondary text-[12px] font-semibold text-muted-foreground">Open</span>
                          : <div className="text-[19px] font-semibold tabular-nums leading-tight" style={{ color: tone(pnl) }}>{money(pnl)}</div>}
                        {rr !== null && <div className="text-[12px] text-muted-foreground tabular-nums">{rr.toFixed(1)}R</div>}
                      </div>
                    </div>
                    {pnl !== null && (
                      <div className="mt-3 h-1 rounded-full bg-secondary overflow-hidden" aria-hidden>
                        <motion.div className="h-full rounded-full" style={{ background: tone(pnl) }}
                          initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.max(4, (Math.abs(pnl) / maxAbs) * 100)}%` }} transition={{ ...spring, delay: reduce ? 0 : 0.1 + Math.min(i, 9) * 0.03 }} />
                      </div>
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default Trades;
