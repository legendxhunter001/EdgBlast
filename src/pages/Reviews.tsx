import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTrades } from '@/hooks/useTrades';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import {
  Target, Plus, Trash2, ChevronRight, Flag, DollarSign, Wallet, Scale, Gauge,
  TrendingDown, CheckCircle2, AlertCircle, Sparkles, ArrowRight, BarChart3, type LucideIcon,
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
type Axis = { key: string; label: string; score: number; hasData: boolean };

/* ───────────── 7-axis profile, computed from real closed trades ───────────── */
type ClosedTrade = ReturnType<typeof useTrades>['data'] extends (infer T)[] | undefined ? T : never;

function computeProfile(closed: ClosedTrade[]) {
  const n = closed.length;
  const has = (min: number) => n >= min;

  const rrKnown = closed.filter((t) => !isNaN(Number(t.risk_reward)) && Number(t.risk_reward) !== 0);
  const poorRr = rrKnown.filter((t) => Number(t.risk_reward) < 1).length;
  const discipline = rrKnown.length ? ((rrKnown.length - poorRr) / rrKnown.length) * 100 : 50;

  const emoTagged = closed.filter((t) => t.emotional_state);
  const goodEmo = emoTagged.filter((t) => ['calm', 'confident', 'excited'].includes(t.emotional_state as string)).length;
  const psychology = emoTagged.length ? (goodEmo / emoTagged.length) * 100 : 50;

  const sizes = closed.map((t) => Number(t.position_size)).filter((v) => !isNaN(v) && v > 0);
  let riskMgmt = 50;
  if (sizes.length >= 5) {
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const variance = sizes.reduce((s, v) => s + (v - mean) ** 2, 0) / sizes.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    riskMgmt = Math.max(0, Math.min(100, 100 - cv * 100));
  }

  const rrs = rrKnown.map((t) => Number(t.risk_reward));
  const avgRr = rrs.length ? rrs.reduce((a, b) => a + b, 0) / rrs.length : null;
  const execution = avgRr !== null ? Math.max(0, Math.min(100, (avgRr / 2) * 100)) : 50;

  let consistency = 50;
  if (n >= 5) {
    const pnls = closed.map((t) => Number(t.pnl ?? 0));
    const meanAbs = pnls.reduce((s, v) => s + Math.abs(v), 0) / n || 1;
    const mean = pnls.reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(pnls.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
    consistency = Math.max(0, Math.min(100, 100 - (stdDev / meanAbs) * 18));
  }

  const byDay: Record<string, number[]> = {};
  closed.forEach((t) => { if (t.exit_at) (byDay[t.exit_at.slice(0, 10)] ??= []).push(Number(t.pnl ?? 0)); });
  const heavy = Object.values(byDay).filter((d) => d.length >= 3).flat();
  const light = Object.values(byDay).filter((d) => d.length <= 2).flat();
  const heavyAvg = heavy.length ? heavy.reduce((a, b) => a + b, 0) / heavy.length : null;
  const lightAvg = light.length ? light.reduce((a, b) => a + b, 0) / light.length : null;
  let patience = 60;
  if (heavyAvg !== null && lightAvg !== null && heavy.length >= 3) patience = heavyAvg < lightAvg ? 32 : 78;

  const tagged = closed.filter((t) => t.strategy_id).length;
  const strategy = n ? (tagged / n) * 100 : 50;

  const axes: Axis[] = [
    { key: 'discipline', label: 'Discipline', score: discipline, hasData: has(5) },
    { key: 'psychology', label: 'Psychology', score: psychology, hasData: emoTagged.length >= 5 },
    { key: 'risk', label: 'Risk Mgmt', score: riskMgmt, hasData: sizes.length >= 5 },
    { key: 'execution', label: 'Execution', score: execution, hasData: rrs.length >= 5 },
    { key: 'consistency', label: 'Consistency', score: consistency, hasData: has(5) },
    { key: 'patience', label: 'Patience', score: patience, hasData: heavy.length >= 3 },
    { key: 'strategy', label: 'Strategy', score: strategy, hasData: has(5) },
  ];
  const dataAxes = axes.filter((a) => a.hasData);
  const overall = dataAxes.length ? dataAxes.reduce((s, a) => s + a.score, 0) / dataAxes.length : null;
  const sorted = [...dataAxes].sort((a, b) => b.score - a.score);
  return {
    axes, overall, strongest: sorted[0] ?? null, weakest: sorted[sorted.length - 1] ?? null,
    avgRr, heavyAvg, lightAvg, poorRr, rrKnownCount: rrKnown.length,
  };
}

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
            dominantBaseline="middle" fontSize={11.5} fontWeight={600} fill="hsl(var(--muted-foreground))">{ax.label}</text>
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

const Reviews = () => {
  const { user } = useAuth();
  const { data: trades } = useTrades();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'goals' ? 'goals' : 'review';
  const setTab = (t: 'review' | 'goals') => setParams(t === 'goals' ? { tab: 'goals' } : {}, { replace: true });

  const closed = useMemo(() => (trades ?? []).filter((t) => t.status === 'closed' && t.pnl !== null), [trades]);

  /* period windows: this window vs the equal window before it */
  const [period, setPeriod] = useState<'30' | '90' | 'all'>('all');
  const { cur, prev } = useMemo(() => {
    if (period === 'all') return { cur: computeProfile(closed), prev: null };
    const d = Number(period), now = new Date();
    const a = subDays(now, d), b = subDays(now, d * 2);
    const inWin = (t: ClosedTrade, from: Date, to: Date) => !!t.exit_at && parseISO(t.exit_at) >= from && parseISO(t.exit_at) < to;
    return {
      cur: computeProfile(closed.filter((t) => inWin(t, a, new Date(now.getTime() + 864e5)))),
      prev: computeProfile(closed.filter((t) => inWin(t, b, a))),
    };
  }, [closed, period]);
  const allProfile = useMemo(() => computeProfile(closed), [closed]);

  const delta = (i: number) =>
    prev && cur.axes[i].hasData && prev.axes[i].hasData ? Math.round(cur.axes[i].score - prev.axes[i].score) : null;
  const overallDelta = prev && cur.overall !== null && prev.overall !== null ? Math.round(cur.overall - prev.overall) : null;

  const insights = useMemo(() => {
    const out: { good: boolean; text: string }[] = [];
    if (cur.strongest) out.push({ good: true, text: `${cur.strongest.label} is your strongest axis at ${Math.round(cur.strongest.score)}.` });
    if (cur.weakest && cur.weakest.key !== cur.strongest?.key) out.push({ good: false, text: `${cur.weakest.label} is holding your score down at ${Math.round(cur.weakest.score)}.` });
    if (cur.rrKnownCount > 0 && cur.poorRr > 0) out.push({ good: false, text: `${cur.poorRr} of ${cur.rrKnownCount} trades had under 1R reward-to-risk.` });
    if (cur.heavyAvg !== null && cur.lightAvg !== null)
      out.push({ good: cur.heavyAvg >= cur.lightAvg, text: `Days with 3+ trades averaged ${formatCurrency(cur.heavyAvg)} per trade vs ${formatCurrency(cur.lightAvg)} on lighter days.` });
    return out;
  }, [cur]);

  /* ───────────── goals ───────────── */
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sheet, setSheet] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newType, setNewType] = useState('win_rate');
  const [newTarget, setNewTarget] = useState('');
  const [newDate, setNewDate] = useState('');

  const loadGoals = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false });
    setGoals((data ?? []) as Goal[]);
  }, [user]);
  useEffect(() => { loadGoals(); }, [loadGoals]);

  const winRate = closed.length ? (closed.filter((t) => Number(t.pnl) > 0).length / closed.length) * 100 : null;
  const grossProfit = closed.filter((t) => Number(t.pnl) > 0).reduce((s, t) => s + Number(t.pnl), 0);
  const grossLoss = Math.abs(closed.filter((t) => Number(t.pnl) < 0).reduce((s, t) => s + Number(t.pnl), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;

  const currentValueFor = (goal: Goal): number | null => {
    switch (goal.goal_type) {
      case 'win_rate': return winRate;
      case 'profit_factor': return profitFactor;
      case 'avg_rr': return allProfile.avgRr;
      case 'monthly_pnl': {
        const start = startOfMonth(new Date());
        return closed.filter((t) => t.exit_at && parseISO(t.exit_at) >= start).reduce((s, t) => s + Number(t.pnl ?? 0), 0);
      }
      case 'account_balance': {
        const since = parseISO(goal.starting_at);
        const gained = closed.filter((t) => t.exit_at && parseISO(t.exit_at) >= since).reduce((s, t) => s + Number(t.pnl ?? 0), 0);
        return (goal.starting_value ?? 0) + gained;
      }
      default: return null;
    }
  };

  const addGoal = async () => {
    if (!user || !newTarget) return;
    // starting point = where you are today, so progress measures real movement
    const startFor: Record<string, number | null> = {
      account_balance: closed.reduce((s, t) => s + Number(t.pnl ?? 0), 0),
      win_rate: winRate, profit_factor: profitFactor, avg_rr: allProfile.avgRr,
    };
    const { error } = await supabase.from('goals').insert({
      user_id: user.id, goal_type: newType, target_value: Number(newTarget),
      target_date: newDate || null, starting_value: startFor[newType] ?? null,
    });
    if (error) { toast.error(error.message); return; }
    setSheet(false); setNewTarget(''); setNewDate('');
    toast.success('Goal set');
    loadGoals();
  };

  const removeGoal = async (id: string) => {
    await supabase.from('goals').update({ is_active: false }).eq('id', id);
    setGoals((prevG) => prevG.filter((g) => g.id !== id));
    setOpenId(null);
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
    patience: 'Cap trades per day — quality over volume',
    strategy: 'Log every trade against a named strategy',
  };
  const barTone = (s: number): Tone => (s >= 70 ? 'bull' : s >= 50 ? 'primary' : 'gold');

  /* ───────────── render ───────────── */
  return (
    <div className="px-4 md:px-8 pt-4 pb-10 max-w-3xl mx-auto">
      <h1 className="font-display text-[34px] leading-[1.1] font-bold tracking-tight">{tab === 'review' ? 'Review' : 'Goals'}</h1>
      <p className="text-[14px] text-muted-foreground mt-1 mb-4">
        {tab === 'review'
          ? 'Scored from your real trades. What helps, what hurts, what to fix next.'
          : 'Progress comes from your trades. The tick shows where you should be today.'}
      </p>

      {/* segmented control */}
      <div className="flex p-[3px] rounded-[12px] bg-secondary mb-5" role="tablist">
        {([['review', 'Review', BarChart3], ['goals', 'Goals', Target]] as const).map(([k, label, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-[10px] py-2 text-[14px] font-semibold transition ${tab === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            <Icon className="size-[17px]" /> {label}
          </button>
        ))}
      </div>

      {tab === 'review' && (
        <div className="space-y-4">
          {closed.length < 5 ? (
            <div className={`${SURFACE} p-8 text-center text-sm text-muted-foreground`} style={SURFACE_SHADOW}>
              Log at least 5 closed trades and your trader profile will appear here — a real read on discipline, psychology, risk, execution, consistency, patience, and strategy.
            </div>
          ) : (
            <>
              <div className="flex p-[3px] rounded-[10px] bg-secondary">
                {(['30', '90', 'all'] as const).map((p) => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`flex-1 rounded-[8px] py-1.5 text-[13px] font-semibold transition ${period === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                    {p === 'all' ? 'All time' : `${p} days`}
                  </button>
                ))}
              </div>

              <div className={`${SURFACE} p-5`} style={SURFACE_SHADOW}>
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-[56px] leading-none font-bold tracking-tight">
                    {cur.overall !== null ? Math.round(cur.overall) : '—'}
                  </span>
                  {overallDelta !== null && (
                    <StatusChip tone={overallDelta >= 0 ? 'bull' : 'bear'}>{overallDelta >= 0 ? '+' : ''}{overallDelta} vs previous {period} days</StatusChip>
                  )}
                </div>
                <div className="text-[14px] text-muted-foreground mb-1">Review score out of 100</div>
                <HeptagonChart axes={cur.axes} prev={prev && prev.overall !== null ? prev.axes : null} />
                {prev && prev.overall !== null && <div className="text-center text-[12px] text-muted-foreground">Dashed line is the previous {period} days</div>}
              </div>

              <div className="px-1.5 pt-2 text-[13px] font-semibold text-muted-foreground">Seven axes</div>
              <div className={`${SURFACE} px-4`} style={SURFACE_SHADOW}>
                {cur.axes.map((ax, i) => {
                  const d = delta(i);
                  return (
                    <div key={ax.key} className="flex items-center gap-3 py-3 border-t border-border first:border-t-0">
                      <span className="w-[96px] text-[15px]">{ax.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
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
                        {x.good ? <CheckCircle2 className="size-5 shrink-0 mt-px" style={{ color: c('bull') }} /> : <AlertCircle className="size-5 shrink-0 mt-px" style={{ color: c('gold') }} />}
                        <span>{x.text}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {cur.weakest && (
                <div className="rounded-[24px] p-5 text-primary-foreground" style={{ background: c('primary') }}>
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold opacity-85"><Flag className="size-[15px]" /> This week's focus</div>
                  <div className="font-display text-[20px] font-bold mt-1">{cur.weakest.label} ({Math.round(cur.weakest.score)})</div>
                  <p className="text-[15px] mt-1 opacity-95">{focusLine[cur.weakest.key]}</p>
                </div>
              )}
            </>
          )}

          <Link to="/ai-coach" className={`${SURFACE} flex items-center justify-between gap-4 p-4 active:scale-[.98] transition`} style={SURFACE_SHADOW}>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-[12px] grid place-items-center shrink-0" style={{ background: c('primary', 0.15), color: c('primary') }}>
                <Sparkles className="size-5" />
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

      {tab === 'goals' && (
        <div className="space-y-3.5">
          {focus && focus.a.sev >= 0 && (
            <div className="rounded-[24px] p-5 text-primary-foreground" style={{ background: c('primary') }}>
              <div className="flex items-center gap-1.5 text-[12px] font-semibold opacity-85"><Flag className="size-[15px]" /> Focus today</div>
              <div className="font-display text-[20px] font-bold mt-1">{GOAL_DEFS[focus.g.goal_type]?.label}: {focus.a.status}</div>
              <p className="text-[15px] mt-1 opacity-95">{paceText(focus.g, focus.a)}</p>
            </div>
          )}

          {goals.length === 0 && (
            <div className={`${SURFACE} p-8 text-center text-muted-foreground`} style={SURFACE_SHADOW}>
              <Target className="size-8 mx-auto mb-2" style={{ color: c('primary') }} />
              <div className="text-[15px]">No goals yet. Set one and this page tracks your pace automatically.</div>
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
                <button onClick={() => setOpenId(open ? null : g.id)} className="w-full flex items-center gap-3 p-4 text-left" aria-expanded={open}>
                  <div className="size-10 rounded-[12px] grid place-items-center shrink-0" style={{ background: c(tone, 0.15), color: c(tone) }}>
                    <Icon className="size-[22px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[16px] truncate">{def?.label ?? g.goal_type}</span>
                      <StatusChip tone={a.tone}>{a.status}</StatusChip>
                    </div>
                    <div className="text-[13px] text-muted-foreground mt-0.5">
                      {current !== null ? def?.format(current) : '—'} of {def?.format(g.target_value)}
                      {a.daysLeft !== null && ` · ${a.daysLeft >= 0 ? `${a.daysLeft}d left` : 'overdue'}`}
                    </div>
                  </div>
                  <ChevronRight className={`size-[18px] text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                </button>
                <div className="relative h-2 rounded-full bg-secondary mx-4">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(a.prog * 100)}%`, background: fill }} />
                  {a.exp !== null && <div className="absolute -top-[3px] w-0.5 h-[14px] rounded-sm bg-foreground/45" style={{ left: `calc(${Math.round(a.exp * 100)}% - 1px)` }} />}
                </div>
                <div className="px-4 pt-2 pb-4 text-[13px] text-muted-foreground">{paceText(g, a)}</div>
                {open && (
                  <div className="border-t border-border px-4 py-3 text-[14px] flex items-center justify-between gap-3">
                    <span>
                      {a.proj !== null && a.gap !== null && a.gap > 0
                        ? <>At this pace you finish at <b>{def?.format(a.proj)}</b>{a.proj >= g.target_value ? ', past your target.' : `, short of ${def?.format(g.target_value)}.`}</>
                        : g.target_date ? `Deadline ${format(parseISO(g.target_date), 'MMM d, yyyy')}` : 'No deadline set'}
                    </span>
                    <button onClick={() => removeGoal(g.id)} aria-label="Delete goal" className="p-2 -mr-2" style={{ color: c('bear') }}>
                      <Trash2 className="size-5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={() => setSheet(true)}
            className="w-full h-12 rounded-[16px] font-semibold text-[15px] text-primary-foreground inline-flex items-center justify-center gap-2 active:scale-[.97] transition"
            style={{ background: c('primary') }}>
            <Plus className="size-5" /> Add goal
          </button>
        </div>
      )}

      {/* new-goal bottom sheet */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSheet(false)}>
          <div className="relative w-full max-w-md bg-background rounded-t-[28px] md:rounded-[28px] px-5 pt-6 max-h-[92%] overflow-auto"
            style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }} onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-2.5 left-1/2 -ml-5 w-10 h-[5px] rounded-full bg-border md:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-[20px] font-bold">New goal</h3>
              <button onClick={() => setSheet(false)} className="text-[15px] font-semibold" style={{ color: c('primary') }}>Cancel</button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {Object.entries(GOAL_DEFS).map(([k, d]) => {
                const I = d.icon; const on = newType === k;
                return (
                  <button key={k} onClick={() => setNewType(k)}
                    className="flex items-center gap-2 p-2.5 rounded-[14px] bg-card text-left text-[14px] font-medium border-2 transition"
                    style={{ borderColor: on ? c('primary') : 'transparent' }}>
                    <span className="size-[30px] rounded-[9px] grid place-items-center shrink-0" style={{ background: c(d.tone, 0.15), color: c(d.tone) }}><I className="size-[18px]" /></span>
                    {d.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[12px] text-muted-foreground ml-1">Target value</span>
                <input type="number" step="any" inputMode="decimal" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} className="w-full mt-1 px-3 bg-secondary text-[16px] outline-none border border-transparent" />
              </label>
              <label className="block">
                <span className="text-[12px] text-muted-foreground ml-1">Deadline (optional, enables daily pace)</span>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full mt-1 px-3 bg-secondary text-[16px] outline-none border border-transparent" />
              </label>
            </div>
            <button onClick={addGoal} disabled={!newTarget}
              className="w-full h-12 mt-5 rounded-[16px] font-semibold text-[15px] text-primary-foreground disabled:opacity-40 active:scale-[.97] transition"
              style={{ background: c('primary') }}>
              Set goal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reviews;
