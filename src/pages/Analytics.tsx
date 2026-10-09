import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStrategies, useTrades, type Trade } from '@/hooks/useTrades';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCountUp } from '@/hooks/useCountUp';
import {
  Area, AreaChart, Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { format, parseISO, getDay, differenceInMinutes, startOfMonth, endOfMonth, subMonths, subDays, isBefore } from 'date-fns';
import { formatCurrency } from '@/lib/format';
import { plannedRiskReward, fmtRiskReward } from '@/lib/traderProfile';
import { ArrowDownRight, ArrowUpRight, BarChart3, Camera, ChevronRight, Layers, Plus } from 'lucide-react';
import { toast } from 'sonner';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SURFACE = 'bg-card border border-border rounded-[24px]';
const SHADOW = { boxShadow: 'var(--ios-sh, 0 1px 2px rgba(0,0,0,.05))' } as const;
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const BULL = 'hsl(var(--bull))', BEAR = 'hsl(var(--bear))', MUTED = 'hsl(var(--muted-foreground))';
const tap = () => { try { navigator.vibrate?.(8); } catch { /* not supported */ } };
const tint = (col: string, a: number) => `color-mix(in srgb, ${col} ${Math.round(a * 100)}%, transparent)`;
const money = (n: number) => formatCurrency(n, { sign: true });
const plain = (n: number) => formatCurrency(n);
const tone = (n: number) => (n >= 0 ? BULL : BEAR);

type Range = '7' | '30' | '90' | 'all';
const RANGES: [Range, string][] = [['7', '7D'], ['30', '30D'], ['90', '90D'], ['all', 'All']];

const Tip = ({ active, payload, label, fmt }: { active?: boolean; payload?: { value: number; payload: Record<string, unknown> }[]; label?: string; fmt: (v: number, row: Record<string, unknown>) => string }) =>
  active && payload?.length ? (
    <div className="rounded-2xl bg-card/95 backdrop-blur border border-border px-3 py-2 shadow-lg text-[13px]">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{fmt(payload[0].value, payload[0].payload)}</div>
    </div>
  ) : null;

const Section = ({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) => (
  <section>
    <div className="flex items-end justify-between px-1.5 pt-2 pb-2">
      <h2 className="text-[13px] font-semibold text-muted-foreground">{title}</h2>
      {aside}
    </div>
    {children}
  </section>
);

const Tile = ({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) => (
  <div className={`${SURFACE} p-4`} style={SHADOW}>
    <div className="text-[12.5px] text-muted-foreground">{label}</div>
    <div className="font-display text-[26px] leading-tight font-bold tracking-tight tabular-nums mt-0.5" style={color ? { color } : undefined}>{value}</div>
    <div className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{sub}</div>
  </div>
);

const Analytics = () => {
  const { user } = useAuth();
  const { data: trades, isLoading } = useTrades();
  const { data: strategies = [] } = useStrategies();
  const allClosed = useMemo(() => (trades ?? []).filter((t) => t.status === 'closed' && t.pnl !== null), [trades]);
  const closed = allClosed; // snapshot logic below reads every closed trade, not just the chosen range
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState<Range>('all');
  const [showAllPairs, setShowAllPairs] = useState(false);

  const computeStatsFor = (start: Date, end: Date) => {
    const inRange = closed.filter(t => {
      if (!t.exit_at) return false;
      const d = parseISO(t.exit_at);
      return d >= start && d <= end;
    });
    const wins = inRange.filter(t => Number(t.pnl) > 0).length;
    const losses = inRange.filter(t => Number(t.pnl) < 0).length;
    const total_pnl = inRange.reduce((s, t) => s + Number(t.pnl ?? 0), 0);
    const rrs = inRange.map(t => Number(t.risk_reward)).filter(v => !isNaN(v) && v !== 0);
    const avg_rr = rrs.length ? rrs.reduce((a, b) => a + b, 0) / rrs.length : null;
    return {
      total_trades: inRange.length,
      wins,
      losses,
      win_rate: inRange.length ? (wins / inRange.length) * 100 : null,
      total_pnl,
      avg_rr,
    };
  };

  const loadSnapshots = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('analytics_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .eq('period_type', 'monthly')
      .order('period_start', { ascending: true });
    setSnapshots(data ?? []);
  };

  useEffect(() => { loadSnapshots(); }, [user?.id]);

  // Auto-capture every fully completed month that doesn't have a snapshot yet,
  // so progress accumulates automatically just from using the app over time.
  useEffect(() => {
    if (!user || closed.length === 0) return;
    (async () => {
      const now = new Date();
      const earliest = closed.reduce((min, t) => {
        const d = parseISO(t.exit_at!);
        return d < min ? d : min;
      }, new Date());
      let cursor = startOfMonth(earliest);
      const currentMonthStart = startOfMonth(now);
      const toInsert: any[] = [];
      while (isBefore(cursor, currentMonthStart)) {
        const start = cursor;
        const end = endOfMonth(cursor);
        const key = format(start, 'yyyy-MM-dd');
        if (!snapshots.some(s => s.period_start === key)) {
          const stats = computeStatsFor(start, end);
          if (stats.total_trades > 0) {
            toInsert.push({
              user_id: user.id,
              period_type: 'monthly',
              period_start: key,
              period_end: format(end, 'yyyy-MM-dd'),
              is_final: true,
              ...stats,
            });
          }
        }
        cursor = startOfMonth(subMonths(cursor, -1));
      }
      if (toInsert.length > 0) {
        await supabase.from('analytics_snapshots').upsert(toInsert, { onConflict: 'user_id,period_type,period_start' });
        loadSnapshots();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, closed.length, snapshots.length]);

  const saveCurrentMonthSnapshot = async () => {
    if (!user) return;
    setSaving(true);
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const stats = computeStatsFor(start, end);
    const { error } = await supabase.from('analytics_snapshots').upsert(
      {
        user_id: user.id,
        period_type: 'monthly',
        period_start: format(start, 'yyyy-MM-dd'),
        period_end: format(end, 'yyyy-MM-dd'),
        is_final: false,
        ...stats,
      },
      { onConflict: 'user_id,period_type,period_start' }
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Snapshot saved for this month');
    loadSnapshots();
  };

  /* ───────── everything below is computed from the closed trades in the chosen range ───────── */
  const { list, prev } = useMemo(() => {
    const exit = (t: Trade) => { const d = t.exit_at ?? t.entry_at; return d ? parseISO(d) : null; }; // a closed trade with no exit date still counts, placed by its entry date
    const sorted = [...allClosed].filter((t) => exit(t)).sort((a, b) => exit(a)!.getTime() - exit(b)!.getTime());
    if (range === 'all') return { list: sorted, prev: null as Trade[] | null };
    const d = Number(range), now = new Date(), a = subDays(now, d), b = subDays(now, d * 2);
    return {
      list: sorted.filter((t) => exit(t)! >= a),
      prev: sorted.filter((t) => exit(t)! >= b && exit(t)! < a),
    };
  }, [allClosed, range]);

  const S = useMemo(() => {
    const pnl = (t: Trade) => Number(t.pnl ?? 0);
    const n = list.length;
    const net = list.reduce((s, t) => s + pnl(t), 0);
    const winsL = list.filter((t) => pnl(t) > 0), lossL = list.filter((t) => pnl(t) < 0);
    const gp = winsL.reduce((s, t) => s + pnl(t), 0), gl = Math.abs(lossL.reduce((s, t) => s + pnl(t), 0));

    let cum = 0, peak = 0, maxDd = 0, curW = 0, curL = 0, bestW = 0, bestL = 0;
    const curve = [{ label: 'Start', v: 0 }];
    list.forEach((t) => {
      cum += pnl(t);
      peak = Math.max(peak, cum);
      maxDd = Math.max(maxDd, peak - cum);
      curve.push({ label: format(parseISO((t.exit_at ?? t.entry_at)!), 'MMM d'), v: Math.round(cum * 100) / 100 });
      if (pnl(t) > 0) { curW++; curL = 0; } else if (pnl(t) < 0) { curL++; curW = 0; } else { curW = 0; curL = 0; }
      bestW = Math.max(bestW, curW); bestL = Math.max(bestL, curL);
    });

    const dow = DAYS.map((day) => ({ day, pnl: 0, count: 0 }));
    list.forEach((t) => { const k = getDay(parseISO((t.exit_at ?? t.entry_at)!)); dow[k].pnl += pnl(t); dow[k].count++; });
    const dowActive = dow.filter((d) => d.count > 0);
    const bestDow = dowActive.length >= 2 ? dowActive.reduce((a, b) => (a.pnl > b.pnl ? a : b)) : null;

    const sym: Record<string, { n: number; net: number; w: number }> = {};
    list.forEach((t) => { const s = (sym[t.asset] ??= { n: 0, net: 0, w: 0 }); s.n++; s.net += pnl(t); if (pnl(t) > 0) s.w++; });
    const pairs = Object.entries(sym).map(([asset, v]) => ({ asset, ...v })).sort((a, b) => b.net - a.net);

    const side = (dir: 'long' | 'short') => {
      const l = list.filter((t) => (dir === 'short' ? t.direction === 'short' : t.direction !== 'short'));
      return { n: l.length, net: l.reduce((s, t) => s + pnl(t), 0), wr: l.length ? (l.filter((t) => pnl(t) > 0).length / l.length) * 100 : null };
    };

    const emo: Record<string, { n: number; net: number }> = {};
    list.forEach((t) => { const k = t.emotional_state ?? 'not set'; const e = (emo[k] ??= { n: 0, net: 0 }); e.n++; e.net += pnl(t); });
    const emotions = Object.entries(emo).map(([k, v]) => ({ k, n: v.n, avg: v.net / v.n })).sort((a, b) => b.avg - a.avg);

    const strat: Record<string, { n: number; net: number; w: number }> = {};
    list.forEach((t) => { if (!t.strategy_id) return; const s = (strat[t.strategy_id] ??= { n: 0, net: 0, w: 0 }); s.n++; s.net += pnl(t); if (pnl(t) > 0) s.w++; });

    const holds = list.filter((t) => t.entry_at && t.exit_at).map((t) => differenceInMinutes(parseISO(t.exit_at!), parseISO(t.entry_at!)));
    const avgHold = holds.length ? holds.reduce((a, b) => a + b, 0) / holds.length : null;
    const rrs = list.map((t) => Number(t.risk_reward)).filter((v) => !isNaN(v) && v !== 0);

    return {
      n, net, wins: winsL.length, losses: lossL.length, be: n - winsL.length - lossL.length,
      winRate: n ? (winsL.length / n) * 100 : null,
      pf: gl > 0 ? gp / gl : null, noLosses: n > 0 && gl === 0 && gp > 0,
      expectancy: n ? net / n : null,
      avgWin: winsL.length ? gp / winsL.length : null, avgLoss: lossL.length ? gl / lossL.length : null,
      maxDd, bestW, bestL, curve, dow, bestDow, pairs, long: side('long'), short: side('short'), emotions, strat,
      planned: plannedRiskReward(list), avgHold, avgRr: rrs.length ? rrs.reduce((a, b) => a + b, 0) / rrs.length : null,
    };
  }, [list]);

  const prevNet = prev ? prev.reduce((s, t) => s + Number(t.pnl ?? 0), 0) : null;
  const netDelta = prevNet !== null && prev && prev.length > 0 ? S.net - prevNet : null;
  const shownNet = useCountUp(S.n ? S.net : null);
  const eqColor = tone(S.net);
  const rangeWord = range === 'all' ? 'all your closed trades' : `the last ${range} days`;
  const emptyAll = !isLoading && allClosed.length === 0;

  const progressData = useMemo(
    () => snapshots.map((s) => ({
      month: format(parseISO(s.period_start), 'MMM yyyy'),
      pnl: Number(s.total_pnl),
      winRate: s.win_rate !== null ? Number(s.win_rate) : null,
    })),
    [snapshots],
  );
  const holdText = S.avgHold === null ? '—' : S.avgHold >= 1440 ? `${(S.avgHold / 1440).toFixed(1)}d` : S.avgHold >= 60 ? `${(S.avgHold / 60).toFixed(1)}h` : `${Math.round(S.avgHold)}m`;
  const pairRows = showAllPairs ? S.pairs : S.pairs.slice(0, 5);
  const pairMax = Math.max(1, ...S.pairs.map((p) => Math.abs(p.net)));
  const emoMax = Math.max(1, ...S.emotions.map((e) => Math.abs(e.avg)));
  const stratRows = Object.entries(S.strat).map(([id, v]) => ({ id, name: strategies.find((x) => x.id === id)?.name ?? 'Deleted strategy', ...v })).sort((a, b) => b.net - a.net);

  return (
    <div className="px-4 md:px-8 pt-4 pb-10 max-w-5xl mx-auto">
      <h1 className="font-display text-[34px] leading-[1.1] font-bold tracking-tight">Analytics</h1>
      <p className="text-[14px] text-muted-foreground mt-1 mb-4">A straight look at how your trades have actually gone.</p>

      <div className="flex p-[3px] rounded-[12px] bg-secondary mb-5" role="group" aria-label="Time range">
        {RANGES.map(([k, label]) => (
          <button key={k} onClick={() => { tap(); setRange(k); }} aria-pressed={range === k}
            className={`${FOCUS} flex-1 rounded-[10px] py-2 text-[14px] font-semibold transition ${range === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{label}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4" aria-busy="true">
          <div className="h-[330px] rounded-[24px] bg-secondary animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[104px] rounded-[24px] bg-secondary animate-pulse" />)}</div>
        </div>
      ) : emptyAll ? (
        <div className={`${SURFACE} p-8 text-center`} style={SHADOW}>
          <div className="size-12 rounded-[14px] grid place-items-center mx-auto mb-3" style={{ background: tint('hsl(var(--primary))', 0.15), color: 'hsl(var(--primary))' }}><BarChart3 className="size-6" /></div>
          <div className="font-display text-[18px] font-bold">Nothing to chart yet</div>
          <p className="text-[14px] text-muted-foreground mt-1">Close a few trades and your numbers will fill in here.</p>
          <Link to="/trades/new" className={`${FOCUS} inline-flex mt-4 h-11 items-center gap-2 px-5 rounded-[14px] font-semibold text-[15px] text-primary-foreground`} style={{ background: 'hsl(var(--primary))' }}><Plus className="size-4" /> Log a trade</Link>
        </div>
      ) : (
        <div key={range} className="space-y-4 animate-fade-up">
          {S.n === 0 ? (
            <div className={`${SURFACE} p-8 text-center text-[14px] text-muted-foreground`} style={SHADOW}>You haven't closed any trades in {rangeWord}. Try a longer range.</div>
          ) : (
            <>
              {/* hero: net result and the curve behind it */}
              <div className={`${SURFACE} pt-5 pb-3 overflow-hidden`} style={SHADOW}>
                <div className="px-5">
                  <div className="text-[13px] text-muted-foreground">Net result, {range === 'all' ? 'all time' : `last ${range} days`}</div>
                  <div className="font-display text-[44px] leading-none font-bold tracking-tight tabular-nums mt-1" style={{ color: eqColor }}>{money(shownNet)}</div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap text-[13px] text-muted-foreground">
                    <span>{S.n} trade{S.n === 1 ? '' : 's'}</span>
                    {netDelta !== null && (
                      <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold" style={{ background: tint(tone(netDelta), 0.15), color: tone(netDelta) }}>
                        {netDelta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                        {plain(Math.abs(netDelta))} vs the {range} days before
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-[190px] mt-3" role="img" aria-label="Cumulative profit and loss over your closed trades">
                  <ResponsiveContainer>
                    <AreaChart data={S.curve} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" style={{ stopColor: eqColor }} stopOpacity={0.3} />
                          <stop offset="100%" style={{ stopColor: eqColor }} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" hide />
                      <YAxis hide domain={['dataMin', 'dataMax']} />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                      <Tooltip cursor={{ stroke: 'hsl(var(--border))' }} content={<Tip fmt={(v) => money(v)} />} />
                      <Area type="monotone" dataKey="v" stroke={eqColor} strokeWidth={2.5} fill="url(#eqFill)" animationDuration={800} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="px-5 pt-1 text-[11.5px] text-muted-foreground">Running total of your closed trades, in the order they closed.</div>
              </div>

              {S.n < 10 && <p className="text-[13px] px-1.5" style={{ color: 'hsl(var(--gold))' }}>Only {S.n} trade{S.n === 1 ? '' : 's'} here, so treat these numbers as a rough read for now.</p>}

              {/* the numbers that matter */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Tile label="Win rate" value={S.winRate === null ? '—' : `${S.winRate.toFixed(0)}%`} sub={`${S.wins} won, ${S.losses} lost${S.be ? `, ${S.be} flat` : ''}`} />
                <Tile label="Profit factor" value={S.pf !== null ? S.pf.toFixed(2) : S.noLosses ? 'No losses' : '—'}
                  sub={S.pf !== null ? `You made ${plain(S.pf)} for every $1 you lost` : S.noLosses ? 'You have no losing trades in this range' : 'Needs at least one win and one loss'} />
                <Tile label="Average trade" value={S.expectancy === null ? '—' : money(S.expectancy)} color={S.expectancy === null ? undefined : tone(S.expectancy)} sub="What a typical trade has paid" />
                <Tile label="Avg win vs loss" value={S.avgWin !== null && S.avgLoss !== null ? `${(S.avgWin / S.avgLoss).toFixed(2)}x` : '—'}
                  sub={S.avgWin !== null && S.avgLoss !== null ? `${plain(S.avgWin)} won, ${plain(S.avgLoss)} lost` : 'Needs a win and a loss'} />
                <Tile label="Biggest dip" value={S.maxDd > 0 ? `-${plain(S.maxDd)}` : '$0'} color={S.maxDd > 0 ? BEAR : undefined} sub="Largest fall from a peak in your running total" />
                <Tile label="Avg hold" value={holdText} sub="Entry to exit" />
                <Tile label="Streaks" value={`${S.bestW} / ${S.bestL}`} sub="Longest run of wins / losses" />
                <Tile label="Risk : reward" value={fmtRiskReward(S.planned.ratio)} sub={S.planned.ratio === null ? 'Needs a stop and a target on your trades' : `Planned reward for every 1 risked${S.avgRr === null ? '' : `. You actually made ${S.avgRr.toFixed(1)}R per trade`}`} />
              </div>

              <div className="grid lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3">
                  <Section title="By day of the week">
                    <div className={`${SURFACE} p-4 pb-2`} style={SHADOW}>
                      <div className="h-[210px]">
                        <ResponsiveContainer>
                          <BarChart data={S.dow} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                            <XAxis dataKey="day" stroke={MUTED} fontSize={11.5} tickLine={false} axisLine={false} />
                            <YAxis hide />
                            <ReferenceLine y={0} stroke="hsl(var(--border))" />
                            <Tooltip cursor={{ fill: 'hsl(var(--secondary) / .6)' }}
                              content={<Tip fmt={(v, row) => `${money(v)} over ${row.count as number} trade${row.count === 1 ? '' : 's'}`} />} />
                            <Bar dataKey="pnl" radius={[8, 8, 8, 8]} animationDuration={700}>
                              {S.dow.map((d, i) => <Cell key={i} fill={d.count === 0 ? 'hsl(var(--secondary))' : tone(d.pnl)} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      {S.bestDow && <p className="text-[13px] text-muted-foreground px-1 pb-2">{S.bestDow.day} has been your best day, {money(S.bestDow.pnl)} over {S.bestDow.count} trades.</p>}
                    </div>
                  </Section>
                </div>
                <div className="lg:col-span-2">
                  <Section title="Wins and losses">
                    <div className={`${SURFACE} p-4`} style={SHADOW}>
                      <div className="relative h-[190px]">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={[{ v: S.wins, c: BULL }, { v: S.losses, c: BEAR }, { v: S.be, c: MUTED }].filter((x) => x.v > 0)} dataKey="v" innerRadius={58} outerRadius={82} cornerRadius={8} paddingAngle={3} stroke="none" animationDuration={800}>
                              {[BULL, BEAR, MUTED].map((c, i) => <Cell key={i} fill={c} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 grid place-items-center pointer-events-none text-center">
                          <div><div className="font-display text-[30px] font-bold tabular-nums leading-none">{S.winRate?.toFixed(0)}%</div><div className="text-[12px] text-muted-foreground mt-1">win rate</div></div>
                        </div>
                      </div>
                      <div className="flex justify-center gap-4 text-[13px] mt-1">
                        <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{ background: BULL }} />{S.wins} wins</span>
                        <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{ background: BEAR }} />{S.losses} losses</span>
                      </div>
                    </div>
                  </Section>
                </div>
              </div>

              <Section title="Long vs short">
                <div className="grid grid-cols-2 gap-3">
                  {([['Long', S.long], ['Short', S.short]] as const).map(([name, d]) => (
                    <div key={name} className={`${SURFACE} p-4`} style={SHADOW}>
                      <div className="text-[12.5px] text-muted-foreground">{name} trades</div>
                      {d.n === 0 ? <div className="text-[14px] text-muted-foreground mt-2">None in this range</div> : (
                        <>
                          <div className="font-display text-[24px] font-bold tabular-nums mt-0.5" style={{ color: tone(d.net) }}>{money(d.net)}</div>
                          <div className="text-[12.5px] text-muted-foreground">{d.n} trade{d.n === 1 ? '' : 's'}, {d.wr?.toFixed(0)}% won</div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="By pair" aside={S.pairs.length > 5 ? <button onClick={() => setShowAllPairs((v) => !v)} className={`${FOCUS} text-[13px] font-semibold rounded`} style={{ color: 'hsl(var(--primary))' }}>{showAllPairs ? 'Show less' : `Show all ${S.pairs.length}`}</button> : undefined}>
                <div className={`${SURFACE} px-4`} style={SHADOW}>
                  {pairRows.map((p) => (
                    <div key={p.asset} className="py-3 border-t border-border first:border-t-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[15px] font-semibold">{p.asset}</span>
                        <span className="text-[15px] font-semibold tabular-nums" style={{ color: tone(p.net) }}>{money(p.net)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${(Math.abs(p.net) / pairMax) * 100}%`, background: tone(p.net) }} /></div>
                        <span className="text-[12px] text-muted-foreground tabular-nums whitespace-nowrap">{p.n} trade{p.n === 1 ? '' : 's'}, {Math.round((p.w / p.n) * 100)}% won</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="By strategy">
                {stratRows.length === 0 ? (
                  <Link to="/reviews?tab=strategies" className={`${FOCUS} ${SURFACE} flex items-center gap-3 p-4 active:scale-[.98] transition`} style={SHADOW}>
                    <div className="size-10 rounded-[12px] grid place-items-center shrink-0" style={{ background: tint('hsl(var(--primary))', 0.15), color: 'hsl(var(--primary))' }}><Layers className="size-5" /></div>
                    <div className="flex-1 text-[14px]"><div className="font-semibold text-[15px]">No trades are tagged to a strategy yet</div><div className="text-muted-foreground">Tag them and you can see which setup is actually paying you.</div></div>
                    <ChevronRight className="size-[18px] text-muted-foreground" />
                  </Link>
                ) : (
                  <div className={`${SURFACE} px-4`} style={SHADOW}>
                    {stratRows.map((s) => (
                      <div key={s.id} className="flex items-baseline justify-between gap-3 py-3 border-t border-border first:border-t-0">
                        <div><div className="text-[15px] font-semibold">{s.name}</div><div className="text-[12.5px] text-muted-foreground">{s.n} trade{s.n === 1 ? '' : 's'}, {Math.round((s.w / s.n) * 100)}% won</div></div>
                        <span className="text-[15px] font-semibold tabular-nums" style={{ color: tone(s.net) }}>{money(s.net)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="How you felt going in">
                <div className={`${SURFACE} px-4 py-1`} style={SHADOW}>
                  {S.emotions.map((e) => (
                    <div key={e.k} className="flex items-center gap-3 py-3 border-t border-border first:border-t-0">
                      <div className="w-[92px]"><div className="text-[15px] capitalize">{e.k}</div><div className="text-[12px] text-muted-foreground">{e.n} trade{e.n === 1 ? '' : 's'}</div></div>
                      <div className="flex-1 relative h-1.5 rounded-full bg-secondary">
                        <div className="absolute top-0 h-full rounded-full transition-all duration-500" style={{ background: tone(e.avg), width: `${(Math.abs(e.avg) / emoMax) * 50}%`, [e.avg >= 0 ? 'left' : 'right']: '50%' }} />
                        <div className="absolute left-1/2 -top-0.5 w-px h-2.5 bg-border" />
                      </div>
                      <div className="w-[84px] text-right text-[14px] font-semibold tabular-nums" style={{ color: tone(e.avg), opacity: e.n < 3 ? 0.55 : 1 }}>{money(e.avg)}</div>
                    </div>
                  ))}
                  <p className="text-[12px] text-muted-foreground pb-3">Average result per trade for each mood you logged. Anything under 3 trades is too few to judge.</p>
                </div>
              </Section>
            </>
          )}

          <Section title="Month by month" aside={
            <button onClick={saveCurrentMonthSnapshot} disabled={saving} className={`${FOCUS} inline-flex items-center gap-1.5 text-[13px] font-semibold rounded disabled:opacity-50`} style={{ color: 'hsl(var(--primary))' }}>
              <Camera className="size-3.5" /> {saving ? 'Saving…' : 'Save this month'}
            </button>}>
            <div className={`${SURFACE} p-4`} style={SHADOW}>
              {progressData.length === 0 ? (
                <p className="text-[14px] text-muted-foreground py-5 text-center">Finished months are saved on their own. Once you've closed trades in a full month, it shows up here.</p>
              ) : (
                <>
                  <div className="h-[170px]">
                    <ResponsiveContainer>
                      <LineChart data={progressData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                        <XAxis dataKey="month" stroke={MUTED} fontSize={11.5} tickLine={false} axisLine={false} minTickGap={24} />
                        <YAxis hide domain={['dataMin', 'dataMax']} />
                        <Tooltip cursor={{ stroke: 'hsl(var(--border))' }} content={<Tip fmt={(v, row) => `${money(v)}${row.winRate !== null ? `, ${Math.round(row.winRate as number)}% won` : ''}`} />} />
                        <Line type="monotone" dataKey="pnl" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 0, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} animationDuration={800} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-1">Each point is one month's net result. This chart always shows every saved month, whatever range you picked above.</p>
                </>
              )}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
};

export default Analytics;
