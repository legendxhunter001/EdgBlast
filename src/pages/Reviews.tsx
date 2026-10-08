import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useTrades, type Trade } from '@/hooks/useTrades';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountScope } from '@/hooks/useAccountScope';
import { StrategiesPanel } from '@/components/StrategiesPanel';
import { computeProfile, plural, type Axis, type RiskRules, type ClosedTrade } from '@/lib/traderProfile';
import { useRiskRules } from '@/hooks/useRiskRules';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import {
  Target, Plus, Trash2, ChevronRight, Flag, DollarSign, Wallet, Scale, Gauge,
  TrendingDown, CheckCircle2, AlertCircle, MessageCircle, ArrowRight, BarChart3, Pencil, Check, Layers, type LucideIcon,
} from 'lucide-react';
import { format, parseISO, differenceInCalendarDays, startOfMonth, subDays } from 'date-fns';

/* ───────────── iOS surface helpers (all colors come from the app tokens) ───────────── */
type Tone = 'primary' | 'bull' | 'bear' | 'gold';
const c = (t: Tone, a = 1) => (a === 1 ? `hsl(var(--${t}))` : `hsl(var(--${t}) / ${a})`);
const SURFACE = 'bg-card border border-border rounded-[24px]';
const SURFACE_SHADOW = { boxShadow: 'var(--ios-sh, 0 1px 2px rgba(0,0,0,.05))' } as const;

const GOAL_DEFS: Record<string, { label: string; format: (n: number) => string; icon: LucideIcon; tone: Tone }> = {
  win_rate: { label: 'Win rate', format: (n) => `${n.toFixed(1)}%`, icon: Target, tone: 'primary' },
  monthly_pnl: { label: 'Monthly P&L', format: (n) => formatCurrency(n), icon: DollarSign, tone: 'bull' },
  account_balance: { label: 'Account balance', format: (n) => formatCurrency(n), icon: Wallet, tone: 'primary' },
  profit_factor: { label: 'Profit factor', format: (n) => `${n.toFixed(2)}x`, icon: Scale, tone: 'gold' },
  avg_rr: { label: 'Average R:R', format: (n) => `${n.toFixed(2)}R`, icon: Gauge, tone: 'gold' },
  max_drawdown_limit: { label: 'Max drawdown limit', format: (n) => `${n.toFixed(1)}%`, icon: TrendingDown, tone: 'bear' },
};

type Goal = {
  id: string; goal_type: string; target_value: number; target_date: string | null;
  starting_value: number | null; starting_at: string;
};

/* ───────────── Heptagon ───────────── */
const HeptagonChart = ({ axes, prev }: { axes: Axis[]; prev?: Axis[] | null }) => {
  const size = 320, cx = size / 2, cy = size / 2 - 4, r = size * 0.32, n = axes.length;
  const pt = (i: number, f: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + r * f * Math.cos(a), cy + r * f * Math.sin(a)] as const;
  };
  const poly = (list: Axis[]) =>
    list.map((ax, i) => pt(i, ax.hasData ? Math.max(0.06, ax.score / 100) : 0.06).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size - 8}`} className="w-full max-w-[360px] mx-auto" role="img" aria-label="Trader profile heptagon">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={axes.map((_, i) => pt(i, f).join(',')).join(' ')} fill="none" stroke="hsl(var(--border))" strokeWidth={1} />
      ))}
      {axes.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="hsl(var(--border))" />; })}
      {prev && <polygon points={poly(prev)} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" strokeLinejoin="round" />}
      <polygon points={poly(axes)} fill={c('primary', 0.2)} stroke={c('primary')} strokeWidth={2.5} strokeLinejoin="round" />
      {axes.map((ax, i) => { const [x, y] = pt(i, ax.hasData ? Math.max(0.06, ax.score / 100) : 0.06); return <circle key={ax.key} cx={x} cy={y} r={3.5} fill={c('primary')} />; })}
      {axes.map((ax, i) => {
        const [x, y] = pt(i, 1.27);
        return (
          <text key={ax.key} x={x} y={y} textAnchor={Math.abs(x - cx) < 6 ? 'middle' : x > cx ? 'start' : 'end'}
            dominantBaseline="middle" fontSize={11.5} fontWeight={600} fill="hsl(var(--muted-foreground))" opacity={ax.hasData ? 1 : 0.45}>{ax.label}</text>
        );
      })}
    </svg>
  );
};

/* ───────────── Goal pace analysis ───────────── */
type Chip = Tone | 'muted';
type Analysis = {
  status: string; tone: Chip; sev: number; prog: number; exp: number | null;
  need: number | null; rate: number | null; proj: number | null; daysLeft: number | null; gap: number | null;
};
const clamp = (x: number) => Math.max(0, Math.min(1, x));

function analyzeGoal(g: Goal, current: number | null): Analysis {
  const now = new Date();
  const daysLeft = g.target_date ? differenceInCalendarDays(parseISO(g.target_date), now) : null;
  const empty = { prog: 0, exp: null, need: null, rate: null, proj: null, daysLeft, gap: null };
  if (current === null) return { ...empty, status: g.goal_type === 'max_drawdown_limit' ? 'Not tracked yet' : 'No data', tone: 'muted', sev: -1 };

  const start = g.starting_value ?? 0;
  const prog = clamp((current - start) / (g.target_value - start || 1));
  const elapsed = Math.max(1, differenceInCalendarDays(now, parseISO(g.starting_at)));
  const total = g.target_date ? Math.max(1, differenceInCalendarDays(parseISO(g.target_date), parseISO(g.starting_at))) : null;
  const exp = total ? clamp(elapsed / total) : null;
  const gap = g.target_value - current;
  const rate = (current - start) / elapsed;
  const need = daysLeft !== null && daysLeft > 0 ? gap / daysLeft : null;
  const proj = daysLeft !== null ? current + rate * Math.max(daysLeft, 0) : null;
  const base = { prog, exp, need, rate, proj, daysLeft, gap };

  if (gap <= 0) return { ...base, status: 'Hit', tone: 'bull', sev: 0 };
  if (daysLeft === null) return { ...base, status: 'In progress', tone: 'primary', sev: 1 };
  if (daysLeft < 0) return { ...base, status: 'Overdue', tone: 'bear', sev: 3 };
  if (proj !== null && proj >= g.target_value) return { ...base, status: 'On track', tone: 'bull', sev: 1 };
  if (exp !== null && prog >= exp * 0.75) return { ...base, status: 'Slightly behind', tone: 'gold', sev: 2 };
  return { ...base, status: 'Behind', tone: 'bear', sev: 3 };
}

const StatusChip = ({ tone, children }: { tone: Chip; children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap"
    style={tone === 'muted'
      ? { background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))' }
      : { background: c(tone, 0.15), color: c(tone) }}>
    {children}
  </span>
);

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const tap = () => { try { navigator.vibrate?.(8); } catch { /* not supported */ } };
const UNIT: Record<string, string> = { win_rate: '%', monthly_pnl: '$', account_balance: '$', profit_factor: 'x', avg_rr: 'R', max_drawdown_limit: '%' };

/** Smooth count-up for the score; jumps straight to the value when reduced motion is on. */
const useCountUp = (to: number | null, ms = 650) => {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (to === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); from.current = to; return; }
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setV(a + (to - a) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step); else from.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
};

const Reviews = () => {
  const { user } = useAuth();
  const { data: trades, isLoading } = useTrades();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const tab: 'review' | 'goals' | 'strategies' = rawTab === 'goals' || rawTab === 'strategies' ? rawTab : 'review';
  const setTab = (t: 'review' | 'goals' | 'strategies') => { tap(); setParams(t === 'review' ? {} : { tab: t }, { replace: true }); };

  const closed = useMemo(() => (trades ?? []).filter((t) => t.status === 'closed' && t.pnl !== null), [trades]);
  const { scope, connections } = useAccountScope();

  /* your saved risk rules (the yardstick for Discipline and Patience) */
  const { rules, loaded: rulesLoaded } = useRiskRules();

  /* live broker balance, only when the goals tab needs it */
  const balConn = useMemo(
    () => (scope !== 'all' ? connections.find((x) => x.id === scope) : connections.find((x) => x.is_primary && x.status === 'connected') ?? connections.find((x) => x.status === 'connected')),
    [scope, connections],
  );
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  useEffect(() => {
    if (tab !== 'goals' || !balConn || balConn.status !== 'connected') { setLiveBalance(null); return; }
    let alive = true;
    supabase.functions.invoke('get-account-info', { body: { connection_id: balConn.id } }).then(({ data, error }) => {
      if (!alive) return;
      const b = data?.account?.balance;
      setLiveBalance(!error && typeof b === 'number' ? b : null);
    });
    return () => { alive = false; };
  }, [tab, balConn]);

  /* period windows: this window vs the equal window before it */
  const [period, setPeriod] = useState<'30' | '90' | 'all'>('all');
  const { cur, prev } = useMemo(() => {
    if (period === 'all') return { cur: computeProfile(closed, rules), prev: null };
    const d = Number(period), now = new Date();
    const a = subDays(now, d), b = subDays(now, d * 2);
    const inWin = (t: ClosedTrade, from: Date, to: Date) => !!t.exit_at && parseISO(t.exit_at) >= from && parseISO(t.exit_at) < to;
    return {
      cur: computeProfile(closed.filter((t) => inWin(t, a, new Date(now.getTime() + 864e5))), rules),
      prev: computeProfile(closed.filter((t) => inWin(t, b, a)), rules),
    };
  }, [closed, period, rules]);
  const allProfile = useMemo(() => computeProfile(closed, rules), [closed, rules]);
  const scoreShown = Math.round(useCountUp(cur.overall));

  const delta = (i: number) =>
    prev && cur.axes[i].hasData && prev.axes[i].hasData ? Math.round(cur.axes[i].score - prev.axes[i].score) : null;
  const overallDelta = prev && cur.overall !== null && prev.overall !== null ? Math.round(cur.overall - prev.overall) : null;

  const insights = useMemo(() => {
    const out: { good: boolean; text: string }[] = [];
    if (cur.strongest) out.push({ good: true, text: `${cur.strongest.label} is your strongest measured axis at ${Math.round(cur.strongest.score)}.` });
    if (cur.weakest && cur.weakest.key !== cur.strongest?.key) out.push({ good: false, text: `${cur.weakest.label} is holding your score down at ${Math.round(cur.weakest.score)}.` });
    const v = cur.viol;
    if (v.noStop) out.push({ good: false, text: `${plural(v.noStop, 'trade')} had no stop loss, which your rules require.` });
    if (v.noStrategy) out.push({ good: false, text: `${plural(v.noStrategy, 'trade')} had no strategy logged, which your rules require.` });
    if (v.oversize) out.push({ good: false, text: `${plural(v.oversize, 'trade')} went over your max lot size.` });
    if (v.lowRr) out.push({ good: false, text: `${plural(v.lowRr, 'trade')} planned less reward than your minimum RR.` });
    if (v.symbol) out.push({ good: false, text: `${plural(v.symbol, 'trade')} were outside your allowed symbols.` });
    if (cur.composedAvg !== null && cur.otherAvg !== null)
      out.push({ good: cur.composedAvg >= cur.otherAvg, text: `Trades entered calm, confident or excited averaged ${formatCurrency(cur.composedAvg)} vs ${formatCurrency(cur.otherAvg)} for other states (${cur.composedN} vs ${cur.otherN} trades).` });
    if (cur.heavyAvg !== null && cur.lightAvg !== null)
      out.push({ good: cur.heavyAvg >= cur.lightAvg, text: `Days with 3+ trades averaged ${formatCurrency(cur.heavyAvg)} per trade vs ${formatCurrency(cur.lightAvg)} on lighter days.` });
    return out;
  }, [cur]);

  /* ───────────── goals ───────────── */
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [newType, setNewType] = useState('win_rate');
  const [newTarget, setNewTarget] = useState('');
  const [newDate, setNewDate] = useState('');

  const loadGoals = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false });
    if (error) toast.error("Couldn't load your goals. Pull to refresh and try again.");
    else setGoals((data ?? []) as Goal[]);
    setGoalsLoading(false);
  }, [user]);
  useEffect(() => { loadGoals(); }, [loadGoals]);

  const closeSheet = useCallback(() => { setSheet(false); setDragY(0); }, []);
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [sheet, closeSheet]);

  const winRate = closed.length ? (closed.filter((t) => Number(t.pnl) > 0).length / closed.length) * 100 : null;
  const grossProfit = closed.filter((t) => Number(t.pnl) > 0).reduce((s, t) => s + Number(t.pnl), 0);
  const grossLoss = Math.abs(closed.filter((t) => Number(t.pnl) < 0).reduce((s, t) => s + Number(t.pnl), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;
  const monthPnl = useMemo(() => {
    const start = startOfMonth(new Date());
    return closed.filter((t) => t.exit_at && parseISO(t.exit_at) >= start).reduce((s, t) => s + Number(t.pnl ?? 0), 0);
  }, [closed]);

  /** What the metric reads right now for each goal type. */
  const liveFor = (type: string): number | null => {
    switch (type) {
      case 'win_rate': return winRate;
      case 'profit_factor': return profitFactor;
      case 'avg_rr': return allProfile.avgRr;
      case 'monthly_pnl': return monthPnl;
      case 'account_balance': return liveBalance;
      default: return null;
    }
  };
  const currentValueFor = (goal: Goal): number | null => liveFor(goal.goal_type);


  const today = format(new Date(), 'yyyy-MM-dd');
  const targetNum = Number(newTarget);
  const validTarget = newTarget !== '' && Number.isFinite(targetNum) && targetNum > 0;
  const validDate = !newDate || newDate >= today;
  const nowReading = liveFor(newType);

  const addGoal = async () => {
    if (!user || !validTarget || !validDate || saving || nowReading === null) return;
    setSaving(true);
    const startFor: Record<string, number | null> = { account_balance: liveBalance, win_rate: winRate, profit_factor: profitFactor, avg_rr: allProfile.avgRr };
    const { error } = await supabase.from('goals').insert({
      user_id: user.id, goal_type: newType, target_value: targetNum,
      target_date: newDate || null, starting_value: startFor[newType] ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    tap(); closeSheet(); setNewTarget(''); setNewDate('');
    toast.success('Goal set');
    loadGoals();
  };

  const removeGoal = async (g: Goal) => {
    tap();
    setGoals((p) => p.filter((x) => x.id !== g.id));
    setOpenId(null);
    const { error } = await supabase.from('goals').update({ is_active: false }).eq('id', g.id);
    if (error) { toast.error(error.message); loadGoals(); return; }
    toast('Goal deleted', {
      action: {
        label: 'Undo',
        onClick: async () => { await supabase.from('goals').update({ is_active: true }).eq('id', g.id); loadGoals(); },
      },
    });
  };

  const saveTarget = async (g: Goal) => {
    const v = Number(editVal);
    if (!Number.isFinite(v) || v <= 0) { toast.error('Enter a target above 0'); return; }
    const { error } = await supabase.from('goals').update({ target_value: v }).eq('id', g.id);
    if (error) { toast.error(error.message); return; }
    tap();
    setGoals((p) => p.map((x) => (x.id === g.id ? { ...x, target_value: v } : x)));
    setEditId(null);
    toast.success('Target updated');
  };

  const analyses = useMemo(
    () => goals.map((g) => ({ g, a: analyzeGoal(g, currentValueFor(g)) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goals, closed, allProfile],
  );
  const focus = analyses.length ? [...analyses].sort((x, y) => y.a.sev - x.a.sev)[0] : null;

  const paceText = (g: Goal, a: Analysis) => {
    const def = GOAL_DEFS[g.goal_type];
    if (a.gap === null) return 'Log closed trades and this goal starts tracking itself.';
    if (a.gap <= 0) return 'Target reached. Raise it to keep pushing.';
    let s = `${def.format(a.gap)} to go.`;
    if (a.need !== null && a.need > 0 && a.daysLeft !== null) s += ` Needs ${def.format(a.need)}/day for ${a.daysLeft}d.`;
    if (a.rate !== null && a.rate > 0) s += ` Your pace: ${def.format(a.rate)}/day.`;
    return s;
  };

  const focusLine: Record<string, string> = {
    discipline: 'Only take trades with 1R+ potential',
    psychology: 'Pause before entering if not calm or confident',
    risk: 'Size positions by a fixed plan, not by feel',
    execution: "Hold for your planned reward, don't cut winners short",
    consistency: 'Reduce size until results stabilize',
    patience: 'Cap trades per day: quality over volume',
    strategy: 'Log every trade against a named strategy',
  };
  const barTone = (sc: number): Tone => (sc >= 70 ? 'bull' : sc >= 50 ? 'primary' : 'gold');

  /* sheet drag-to-dismiss (grab the handle area) */
  const onDragStart = (e: React.TouchEvent) => { dragStart.current = e.touches[0].clientY; };
  const onDragMove = (e: React.TouchEvent) => {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.touches[0].clientY - dragStart.current));
  };
  const onDragEnd = () => {
    if (dragY > 110) closeSheet(); else setDragY(0);
    dragStart.current = null;
  };

  /* ───────────── render ───────────── */
  return (
    <div className="px-4 md:px-8 pt-4 pb-10 max-w-3xl mx-auto">
      <h1 className="font-display text-[34px] leading-[1.1] font-bold tracking-tight">{tab === 'review' ? 'Review' : tab === 'goals' ? 'Goals' : 'Strategies'}</h1>
      <p className="text-[14px] text-muted-foreground mt-1 mb-4">
        {tab === 'review'
          ? 'Scored from your real trades. What helps, what hurts, what to fix next.'
          : tab === 'goals'
            ? 'Progress comes from your trades. The tick shows where you should be today.'
            : 'Define your setups, tag your trades, and see what each one really pays.'}
      </p>

      <div className="flex p-[3px] rounded-[12px] bg-secondary mb-5" role="tablist" aria-label="Review sections">
        {([['review', 'Review', BarChart3], ['goals', 'Goals', Target], ['strategies', 'Strategies', Layers]] as const).map(([k, label, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`${FOCUS} flex-1 flex items-center justify-center gap-1.5 rounded-[10px] py-2 text-[14px] font-semibold transition ${tab === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            <Icon className="size-[17px]" aria-hidden /> {label}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-fade-up">
      {tab === 'review' && (
        <div className="space-y-4">
          {isLoading || !rulesLoaded ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading your review">
              <Skeleton className="h-9 rounded-[10px]" />
              <Skeleton className="h-[420px] rounded-[24px]" />
              <Skeleton className="h-[300px] rounded-[24px]" />
            </div>
          ) : closed.length < 5 ? (
            <div className={`${SURFACE} p-8 text-center`} style={SURFACE_SHADOW}>
              <div className="size-12 rounded-[14px] grid place-items-center mx-auto mb-3" style={{ background: c('primary', 0.15), color: c('primary') }}><BarChart3 className="size-6" /></div>
              <div className="font-display text-[18px] font-bold">{closed.length}/5 closed trades</div>
              <p className="text-[14px] text-muted-foreground mt-1">Log {5 - closed.length} more and your trader profile appears: discipline, psychology, risk, execution, consistency, patience and strategy.</p>
              <Link to="/trades/new" className={`${FOCUS} inline-flex mt-4 h-11 items-center gap-2 px-5 rounded-[14px] font-semibold text-[15px] text-primary-foreground`} style={{ background: c('primary') }}>
                <Plus className="size-4" /> Log a trade
              </Link>
            </div>
          ) : (
            <>
              <div className="flex p-[3px] rounded-[10px] bg-secondary" role="group" aria-label="Time window">
                {(['30', '90', 'all'] as const).map((pp) => (
                  <button key={pp} onClick={() => { tap(); setPeriod(pp); }} aria-pressed={period === pp}
                    className={`${FOCUS} flex-1 rounded-[8px] py-1.5 text-[13px] font-semibold transition ${period === pp ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                    {pp === 'all' ? 'All time' : `${pp} days`}
                  </button>
                ))}
              </div>

              <div className={`${SURFACE} p-5`} style={SURFACE_SHADOW}>
                {cur.overall === null ? (
                  <p className="text-[14px] text-muted-foreground py-6 text-center">{cur.measured}/7 axes measured here. A score needs at least 3, so there isn't enough recorded data in this window yet. Try a longer period.</p>
                ) : (
                  <>
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="font-display text-[56px] leading-none font-bold tracking-tight tabular-nums" aria-label={`Review score ${Math.round(cur.overall)} out of 100`}>{scoreShown}</span>
                      {overallDelta !== null && (
                        <StatusChip tone={overallDelta >= 0 ? 'bull' : 'bear'}>{overallDelta >= 0 ? '+' : ''}{overallDelta} vs previous {period} days</StatusChip>
                      )}
                    </div>
                    <div className="text-[14px] text-muted-foreground mb-1">Review score out of 100, from {cur.measured} of 7 measured axes</div>
                    <HeptagonChart axes={cur.axes} prev={prev && prev.overall !== null ? prev.axes : null} />
                    {prev && prev.overall !== null && <div className="text-center text-[12px] text-muted-foreground">Dashed line is the previous {period} days</div>}
                  </>
                )}
              </div>

              <div className="px-1.5 pt-2 text-[13px] font-semibold text-muted-foreground">Seven axes</div>
              <div className={`${SURFACE} px-4`} style={SURFACE_SHADOW}>
                {cur.axes.map((ax, i) => {
                  const d = delta(i);
                  return (
                    <div key={ax.key} className="flex items-center gap-3 py-3 border-t border-border first:border-t-0">
                      <div className="w-[128px] shrink-0">
                        <div className="text-[15px]">{ax.label}</div>
                        <div className="text-[11.5px] leading-snug text-muted-foreground">{ax.evidence}</div>
                      </div>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={ax.hasData ? Math.round(ax.score) : 0} aria-valuemin={0} aria-valuemax={100} aria-label={ax.label}>
                        {ax.hasData && <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ax.score}%`, background: c(barTone(ax.score)) }} />}
                      </div>
                      <span className="w-[34px] text-right text-[15px] font-semibold tabular-nums">{ax.hasData ? Math.round(ax.score) : '—'}</span>
                      <span className="w-[34px] text-right text-[12px] font-semibold tabular-nums" style={{ color: d === null ? undefined : c(d >= 0 ? 'bull' : 'bear') }}>
                        {d === null ? '' : `${d >= 0 ? '+' : ''}${d}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {insights.length > 0 && (
                <>
                  <div className="px-1.5 pt-2 text-[13px] font-semibold text-muted-foreground">What moved your score</div>
                  <div className={`${SURFACE} px-4`} style={SURFACE_SHADOW}>
                    {insights.map((x, i) => (
                      <div key={i} className="flex gap-3 py-3 border-t border-border first:border-t-0 text-[15px]">
                        {x.good ? <CheckCircle2 className="size-5 shrink-0 mt-px" style={{ color: c('bull') }} aria-label="Positive" /> : <AlertCircle className="size-5 shrink-0 mt-px" style={{ color: c('gold') }} aria-label="Needs attention" />}
                        <span>{x.text}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <details className={`group ${SURFACE} px-4 py-3`} style={SURFACE_SHADOW}>
                <summary className={`${FOCUS} cursor-pointer list-none flex items-center justify-between text-[15px] font-semibold rounded`}>
                  How scores are measured
                  <ChevronRight className="size-[18px] text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                </summary>
                <div className="mt-3 space-y-2.5 text-[13px] text-muted-foreground">
                  {cur.axes.map((ax) => <p key={ax.key}><b className="text-foreground">{ax.label}.</b> {ax.how}</p>)}
                  <p>Trades missing the data an axis needs are left out of that axis, never counted as zero or guessed. An axis needs at least 5 measurable trades (4 trading weeks for Consistency), and the overall score needs at least 3 measured axes.</p>
                </div>
              </details>

              {cur.weakest && (
                <div className="rounded-[24px] p-5 text-primary-foreground" style={{ background: c('primary') }}>
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold opacity-85"><Flag className="size-[15px]" /> Next focus</div>
                  <div className="font-display text-[20px] font-bold mt-1">{cur.weakest.label} ({Math.round(cur.weakest.score)})</div>
                  <p className="text-[15px] mt-1 opacity-95">{focusLine[cur.weakest.key]}</p>
                  {cur.weakest.key === 'strategy' && (
                    <button onClick={() => setTab('strategies')} className={`${FOCUS} mt-3 inline-flex items-center gap-1.5 h-10 px-4 rounded-[12px] bg-white/20 font-semibold text-[14px]`}>Set up strategies <ArrowRight className="size-4" /></button>
                  )}
                </div>
              )}
            </>
          )}

          <Link to="/ai-coach" className={`${FOCUS} ${SURFACE} flex items-center justify-between gap-4 p-4 active:scale-[.98] transition`} style={SURFACE_SHADOW}>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-[12px] grid place-items-center shrink-0" style={{ background: c('primary', 0.15), color: c('primary') }}>
                <MessageCircle className="size-5" />
              </div>
              <div>
                <div className="font-semibold text-[15px]">Talk this through with your coach</div>
                <div className="text-[13px] text-muted-foreground">Alex already knows this data. Ask why, and what to do about it.</div>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground shrink-0" />
          </Link>
        </div>
      )}

      {tab === 'strategies' && <StrategiesPanel closed={closed} />}

      {tab === 'goals' && (
        <div className="space-y-3.5">
          {goalsLoading ? (
            <div className="space-y-3.5" aria-busy="true" aria-label="Loading your goals">
              <Skeleton className="h-[120px] rounded-[24px]" />
              <Skeleton className="h-[110px] rounded-[24px]" />
              <Skeleton className="h-[110px] rounded-[24px]" />
            </div>
          ) : (
            <>
              {focus && focus.a.sev >= 0 && (
                <div className="rounded-[24px] p-5 text-primary-foreground" style={{ background: c('primary') }}>
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold opacity-85"><Flag className="size-[15px]" /> Focus today</div>
                  <div className="font-display text-[20px] font-bold mt-1">{GOAL_DEFS[focus.g.goal_type]?.label}: {focus.a.status}</div>
                  <p className="text-[15px] mt-1 opacity-95">{paceText(focus.g, focus.a)}</p>
                </div>
              )}

              {goals.length === 0 && (
                <div className={`${SURFACE} p-8 text-center`} style={SURFACE_SHADOW}>
                  <div className="size-12 rounded-[14px] grid place-items-center mx-auto mb-3" style={{ background: c('primary', 0.15), color: c('primary') }}><Target className="size-6" /></div>
                  <div className="font-display text-[18px] font-bold">Set your first goal</div>
                  <p className="text-[14px] text-muted-foreground mt-1">Pick a target and a deadline. Your pace is worked out from your closed trades.</p>
                </div>
              )}

              {analyses.map(({ g, a }) => {
                const def = GOAL_DEFS[g.goal_type];
                const Icon = def?.icon ?? Target;
                const tone = def?.tone ?? 'primary';
                const current = currentValueFor(g);
                const open = openId === g.id;
                const fill = a.tone === 'muted' ? 'hsl(var(--muted-foreground))' : c(a.tone);
                return (
                  <div key={g.id} className={`${SURFACE} overflow-hidden`} style={SURFACE_SHADOW}>
                    <button onClick={() => { tap(); setOpenId(open ? null : g.id); setEditId(null); }} className={`${FOCUS} w-full flex items-center gap-3 p-4 text-left`} aria-expanded={open}>
                      <div className="size-10 rounded-[12px] grid place-items-center shrink-0" style={{ background: c(tone, 0.15), color: c(tone) }}>
                        <Icon className="size-[22px]" aria-hidden />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[16px] truncate">{def?.label ?? g.goal_type}</span>
                          <StatusChip tone={a.tone}>{a.status}</StatusChip>
                        </div>
                        <div className="text-[13px] text-muted-foreground mt-0.5 tabular-nums">
                          {current !== null ? def?.format(current) : '—'} of {def?.format(g.target_value)}
                          {a.daysLeft !== null && ` · ${a.daysLeft >= 0 ? `${a.daysLeft}d left` : 'overdue'}`}
                        </div>
                      </div>
                      <ChevronRight className={`size-[18px] text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden />
                    </button>
                    <div className="relative h-2 rounded-full bg-secondary mx-4" role="progressbar" aria-valuenow={Math.round(a.prog * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${def?.label} progress`}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(a.prog * 100)}%`, background: fill }} />
                      {a.exp !== null && <div className="absolute -top-[3px] w-0.5 h-[14px] rounded-sm bg-foreground/45" style={{ left: `calc(${Math.round(a.exp * 100)}% - 1px)` }} title="Where you should be today" />}
                    </div>
                    <div className="px-4 pt-2 pb-4 text-[13px] text-muted-foreground">{paceText(g, a)}</div>
                    {open && (
                      <div className="border-t border-border px-4 py-3 text-[14px] space-y-3">
                        <div>
                          {a.proj !== null && a.gap !== null && a.gap > 0
                            ? <>At this pace you finish at <b>{def?.format(a.proj)}</b>{a.proj >= g.target_value ? ', past your target.' : `, short of ${def?.format(g.target_value)}.`}</>
                            : g.target_date ? `Deadline ${format(parseISO(g.target_date), 'MMM d, yyyy')}` : 'No deadline set'}
                        </div>
                        {editId === g.id ? (
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input type="number" step="any" inputMode="decimal" autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveTarget(g); if (e.key === 'Escape') setEditId(null); }}
                                aria-label="New target" className="w-full px-3 pr-9 bg-secondary text-[16px] outline-none border border-transparent" />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[14px]">{UNIT[g.goal_type]}</span>
                            </div>
                            <button onClick={() => saveTarget(g)} aria-label="Save target" className={`${FOCUS} size-11 rounded-[14px] grid place-items-center text-primary-foreground`} style={{ background: c('primary') }}><Check className="size-5" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <button onClick={() => { setEditId(g.id); setEditVal(String(g.target_value)); }} className={`${FOCUS} inline-flex items-center gap-1.5 h-10 px-3 -ml-3 rounded-[12px] font-semibold text-[14px]`} style={{ color: c('primary') }}>
                              <Pencil className="size-4" /> Edit target
                            </button>
                            <button onClick={() => removeGoal(g)} aria-label={`Delete ${def?.label} goal`} className={`${FOCUS} size-10 -mr-2 rounded-[12px] grid place-items-center`} style={{ color: c('bear') }}>
                              <Trash2 className="size-5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <button onClick={() => { tap(); setSheet(true); }}
                className={`${FOCUS} w-full h-12 rounded-[16px] font-semibold text-[15px] text-primary-foreground inline-flex items-center justify-center gap-2 active:scale-[.97] transition`}
                style={{ background: c('primary') }}>
                <Plus className="size-5" /> Add goal
              </button>
            </>
          )}
        </div>
      )}
      </div>

      {/* new-goal bottom sheet */}
      {sheet && createPortal(
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={closeSheet}>
          <div role="dialog" aria-modal="true" aria-labelledby="new-goal-title"
            className="relative w-full max-w-md bg-background rounded-t-[28px] md:rounded-[28px] px-5 max-h-[92%] overflow-auto"
            style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragStart.current === null ? 'transform .25s cubic-bezier(.2,.8,.2,1)' : 'none' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="pt-3 pb-3 -mx-5 px-5 touch-none" onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd}>
              <div className="mx-auto w-10 h-[5px] rounded-full bg-border md:hidden mb-4" />
              <div className="flex items-center justify-between">
                <h3 id="new-goal-title" className="font-display text-[20px] font-bold">New goal</h3>
                <button onClick={closeSheet} className={`${FOCUS} text-[15px] font-semibold px-1 rounded`} style={{ color: c('primary') }}>Cancel</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4" role="group" aria-label="Goal type">
              {Object.entries(GOAL_DEFS).map(([k, d]) => {
                const I = d.icon; const on = newType === k;
                return (
                  <button key={k} onClick={() => { tap(); setNewType(k); }} aria-pressed={on}
                    className={`${FOCUS} flex items-center gap-2 p-2.5 rounded-[14px] bg-card text-left text-[14px] font-medium border-2 transition`}
                    style={{ borderColor: on ? c('primary') : 'transparent' }}>
                    <span className="size-[30px] rounded-[9px] grid place-items-center shrink-0" style={{ background: c(d.tone, 0.15), color: c(d.tone) }}><I className="size-[18px]" aria-hidden /></span>
                    {d.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[12px] text-muted-foreground ml-1">
                  Target value{nowReading !== null ? ` (right now: ${GOAL_DEFS[newType].format(nowReading)})` : ''}
                </span>
                <div className="relative mt-1">
                  <input type="number" step="any" inputMode="decimal" autoFocus value={newTarget} onChange={(e) => setNewTarget(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addGoal(); }}
                    aria-invalid={newTarget !== '' && !validTarget} className="w-full px-3 pr-9 bg-secondary text-[16px] outline-none border border-transparent" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[14px]">{UNIT[newType]}</span>
                </div>
                {nowReading === null && (
                  <span className="block text-[12px] ml-1 mt-1" style={{ color: c('gold') }}>
                    {newType === 'max_drawdown_limit' ? "Drawdown isn't tracked yet, so this goal can't be measured." : newType === 'account_balance' ? 'Connect an MT5 account to track your real balance.' : 'Log closed trades first so this goal has a real starting point.'}
                  </span>
                )}
                {newTarget !== '' && !validTarget && <span className="text-[12px] ml-1" style={{ color: c('bear') }}>Enter a number above 0.</span>}
              </label>
              <label className="block">
                <span className="text-[12px] text-muted-foreground ml-1">Deadline (optional, turns on the daily pace)</span>
                <input type="date" min={today} value={newDate} onChange={(e) => setNewDate(e.target.value)} aria-invalid={!validDate} className="w-full mt-1 px-3 bg-secondary text-[16px] outline-none border border-transparent" />
                {!validDate && <span className="text-[12px] ml-1" style={{ color: c('bear') }}>Pick today or a later date.</span>}
              </label>
            </div>
            <button onClick={addGoal} disabled={!validTarget || !validDate || saving || nowReading === null}
              className={`${FOCUS} w-full h-12 mt-5 rounded-[16px] font-semibold text-[15px] text-primary-foreground disabled:opacity-40 active:scale-[.97] transition`}
              style={{ background: c('primary') }}>
              {saving ? 'Saving…' : 'Set goal'}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default Reviews;
