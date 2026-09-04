import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrades } from '@/hooks/useTrades';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import { Target, Plus, X, ArrowRight, Sparkles } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays, startOfMonth } from 'date-fns';

const GOAL_DEFS: Record<string, { label: string; unit: string; format: (n: number) => string }> = {
  win_rate: { label: 'Win rate', unit: '%', format: (n) => `${n.toFixed(1)}%` },
  monthly_pnl: { label: 'Monthly P&L', unit: '$', format: (n) => formatCurrency(n) },
  account_balance: { label: 'Account balance', unit: '$', format: (n) => formatCurrency(n) },
  profit_factor: { label: 'Profit factor', unit: 'x', format: (n) => `${n.toFixed(2)}x` },
  avg_rr: { label: 'Average R:R', unit: 'x', format: (n) => `${n.toFixed(2)}R` },
  max_drawdown_limit: { label: 'Max drawdown limit', unit: '%', format: (n) => `${n.toFixed(1)}%` },
};

type Goal = {
  id: string; goal_type: string; target_value: number; target_date: string | null;
  starting_value: number | null; starting_at: string;
};

type Axis = { key: string; label: string; score: number; hasData: boolean };

/* ---------------- Heptagon (7-axis) chart ---------------- */
const HeptagonChart = ({ axes, size = 260 }: { axes: Axis[]; size?: number }) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const n = axes.length;
  const angleFor = (i: number) => -Math.PI / 2 + i * ((2 * Math.PI) / n);

  const pointAt = (i: number, frac: number) => {
    const a = angleFor(i);
    return [cx + r * frac * Math.cos(a), cy + r * frac * Math.sin(a)];
  };

  const dataPoints = axes.map((ax, i) => pointAt(i, Math.max(0.06, ax.score / 100)));
  const dataPath = dataPoints.map((p) => p.join(',')).join(' ');
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Trader profile heptagon">
      {rings.map((frac) => (
        <polygon
          key={frac}
          points={axes.map((_, i) => pointAt(i, frac).join(',')).join(' ')}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={1}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pointAt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="hsl(var(--border))" strokeWidth={1} />;
      })}
      <polygon points={dataPath} fill="hsl(var(--primary) / 0.22)" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinejoin="round" />
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="hsl(var(--primary))" />
      ))}
      {axes.map((ax, i) => {
        const [x, y] = pointAt(i, 1.32);
        return (
          <text
            key={ax.key}
            x={x} y={y}
            textAnchor={Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end'}
            dominantBaseline="middle"
            fontSize={size * 0.043}
            fill="hsl(var(--muted-foreground))"
            fontWeight={600}
          >
            {ax.label}
          </text>
        );
      })}
    </svg>
  );
};

const Reviews = () => {
  const { user } = useAuth();
  const { data: trades } = useTrades();
  const closed = useMemo(() => (trades ?? []).filter((t) => t.status === 'closed' && t.pnl !== null), [trades]);

  /* ---------- 7-axis trader profile (the "heptagon") ---------- */
  const profile = useMemo(() => {
    const n = closed.length;
    const has = (min: number) => n >= min;

    // Discipline — share of trades with an acceptable (>=1R) reward-to-risk.
    const rrKnown = closed.filter((t) => !isNaN(Number(t.risk_reward)) && Number(t.risk_reward) !== 0);
    const poorRr = rrKnown.filter((t) => Number(t.risk_reward) < 1).length;
    const discipline = rrKnown.length ? ((rrKnown.length - poorRr) / rrKnown.length) * 100 : 50;

    // Psychology — share of emotion-tagged trades logged in a composed state.
    const emoTagged = closed.filter((t) => t.emotional_state);
    const goodEmo = emoTagged.filter((t) => ['calm', 'confident', 'excited'].includes(t.emotional_state as string)).length;
    const psychology = emoTagged.length ? (goodEmo / emoTagged.length) * 100 : 50;

    // Risk management — inverse of position-size variance (sizing by plan, not by feel).
    const sizes = closed.map((t) => Number(t.position_size)).filter((v) => !isNaN(v) && v > 0);
    let riskMgmt = 50;
    if (sizes.length >= 5) {
      const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      const variance = sizes.reduce((s, v) => s + (v - mean) ** 2, 0) / sizes.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      riskMgmt = Math.max(0, Math.min(100, 100 - cv * 100));
    }

    // Execution — average R achieved, benchmarked against a healthy 2R average.
    const rrs = rrKnown.map((t) => Number(t.risk_reward));
    const avgRr = rrs.length ? rrs.reduce((a, b) => a + b, 0) / rrs.length : null;
    const execution = avgRr !== null ? Math.max(0, Math.min(100, (avgRr / 2) * 100)) : 50;

    // Consistency — inverse of P&L volatility relative to average trade size.
    let consistency = 50;
    if (n >= 5) {
      const pnls = closed.map((t) => Number(t.pnl ?? 0));
      const meanAbs = pnls.reduce((s, v) => s + Math.abs(v), 0) / n || 1;
      const mean = pnls.reduce((a, b) => a + b, 0) / n;
      const variance = pnls.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
      const stdDev = Math.sqrt(variance);
      consistency = Math.max(0, Math.min(100, 100 - (stdDev / meanAbs) * 18));
    }

    // Patience — heavy-trading days (3+ trades) performing worse signals impatience.
    const byDay: Record<string, number[]> = {};
    closed.forEach((t) => { if (t.exit_at) (byDay[t.exit_at.slice(0, 10)] ??= []).push(Number(t.pnl ?? 0)); });
    const heavy = Object.values(byDay).filter((d) => d.length >= 3).flat();
    const light = Object.values(byDay).filter((d) => d.length <= 2).flat();
    const heavyAvg = heavy.length ? heavy.reduce((a, b) => a + b, 0) / heavy.length : null;
    const lightAvg = light.length ? light.reduce((a, b) => a + b, 0) / light.length : null;
    let patience = 60;
    if (heavyAvg !== null && lightAvg !== null && heavy.length >= 3) {
      patience = heavyAvg < lightAvg ? 32 : 78;
    }

    // Strategy adherence — trades logged against a named strategy vs ad-hoc.
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
    const strongest = dataAxes.length ? [...dataAxes].sort((a, b) => b.score - a.score)[0] : null;
    const weakest = dataAxes.length ? [...dataAxes].sort((a, b) => a.score - b.score)[0] : null;

    return { axes, overall, strongest, weakest, avgRr, heavyAvg, lightAvg, poorRr, rrKnownCount: rrKnown.length };
  }, [closed]);

  /* ---------- Goals ---------- */
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [newGoalType, setNewGoalType] = useState('win_rate');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalDate, setNewGoalDate] = useState('');

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
      case 'avg_rr': return profile.avgRr;
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
    if (!user || !newGoalTarget) return;
    const currentEstimate = newGoalType === 'account_balance' ? closed.reduce((s, t) => s + Number(t.pnl ?? 0), 0) : null;
    const { error } = await supabase.from('goals').insert({
      user_id: user.id, goal_type: newGoalType, target_value: Number(newGoalTarget),
      target_date: newGoalDate || null, starting_value: currentEstimate,
    });
    if (error) { toast.error(error.message); return; }
    setGoalModalOpen(false); setNewGoalTarget(''); setNewGoalDate('');
    toast.success('Goal set');
    loadGoals();
  };

  const removeGoal = async (id: string) => {
    await supabase.from('goals').update({ is_active: false }).eq('id', id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const primaryGoal = goals[0];
  const primaryGoalCurrent = primaryGoal ? currentValueFor(primaryGoal) : null;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-semibold">Review</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Not what happened to your account — what's making you better, what's holding you back, and what to improve next.
        </p>
      </header>

      {/* Hero: score + heptagon */}
      {closed.length < 5 ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Log at least 5 closed trades and your trader profile will appear here — a real read on discipline, psychology, risk, execution, consistency, patience, and strategy.
        </div>
      ) : (
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
          <div className="flex-shrink-0 text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Review Score</div>
            <div className="font-display text-6xl font-semibold tracking-tight">
              {profile.overall !== null ? Math.round(profile.overall) : '—'}
              <span className="text-xl text-muted-foreground font-normal">/100</span>
            </div>
          </div>
          <HeptagonChart axes={profile.axes} />
        </div>
      )}

      {/* Compact findings row */}
      {profile.overall !== null && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Moving you forward</div>
            <div className="font-display font-semibold text-bull">{profile.strongest?.label ?? '—'}</div>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Holding you back</div>
            <div className="font-display font-semibold text-bear">{profile.weakest?.label ?? '—'}</div>
          </div>
          <div className="rounded-xl border border-border p-4 col-span-2 md:col-span-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">This week's focus</div>
            <div className="font-display font-semibold">
              {profile.weakest?.key === 'discipline' && 'Only take trades with 1R+ potential'}
              {profile.weakest?.key === 'psychology' && 'Pause before entering if not calm or confident'}
              {profile.weakest?.key === 'risk' && 'Size positions by a fixed plan, not by feel'}
              {profile.weakest?.key === 'execution' && 'Hold for your planned reward, don\'t cut winners short'}
              {profile.weakest?.key === 'consistency' && 'Reduce size until results stabilize'}
              {profile.weakest?.key === 'patience' && 'Cap trades per day — quality over volume'}
              {profile.weakest?.key === 'strategy' && 'Log every trade against a named strategy'}
              {!profile.weakest && 'Keep logging trades'}
            </div>
          </div>
        </div>
      )}

      {/* Goals */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-primary" />
            <h3 className="font-display font-semibold">Goals</h3>
          </div>
          <button onClick={() => setGoalModalOpen(true)} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 hover:text-primary transition">
            <Plus className="size-3.5" /> New goal
          </button>
        </div>

        {goals.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No goals set yet. Set one and this page will track your real distance from it, not just the numbers.
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((g) => {
              const def = GOAL_DEFS[g.goal_type];
              const current = currentValueFor(g);
              const start = g.starting_value ?? 0;
              const pct = current !== null ? Math.max(0, Math.min(100, ((current - start) / (g.target_value - start || 1)) * 100)) : 0;
              const gap = current !== null ? g.target_value - current : null;
              const daysLeft = g.target_date ? differenceInCalendarDays(parseISO(g.target_date), new Date()) : null;
              const daysElapsed = Math.max(1, differenceInCalendarDays(new Date(), parseISO(g.starting_at)));
              const paceNeeded = gap !== null && daysLeft !== null && daysLeft > 0 ? gap / daysLeft : null;
              const currentPace = current !== null ? (current - start) / daysElapsed : null;

              return (
                <div key={g.id} className="border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{def?.label ?? g.goal_type}</span>
                    <button onClick={() => removeGoal(g.id)} className="text-muted-foreground hover:text-bear"><X className="size-3.5" /></button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span>{current !== null ? def?.format(current) : '—'}</span>
                    <ArrowRight className="size-3" />
                    <span className="text-foreground font-medium">{def?.format(g.target_value)}</span>
                    {g.target_date && <span className="ml-auto">by {format(parseISO(g.target_date), 'MMM d, yyyy')}</span>}
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  {gap !== null && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {gap > 0 ? `${def?.format(Math.abs(gap))} to go.` : "Goal reached — set a new target to keep pushing."}
                      {paceNeeded !== null && paceNeeded > 0 && ` You need to average ${def?.format(paceNeeded)}/day to hit it on time.`}
                      {currentPace !== null && currentPace > 0 && paceNeeded !== null && (
                        currentPace >= paceNeeded ? ' At your current pace, you\'re on track.' : ' At your current pace, you\'re behind — this is the gap to close.'
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ask the coach */}
      <Link
        to="/ai-coach"
        className="flex items-center justify-between gap-4 rounded-2xl border border-border p-5 hover:border-primary/40 transition group"
      >
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-semibold text-sm">Talk this through with your coach</div>
            <div className="text-xs text-muted-foreground">Alex already knows this data — ask why, and what to do about it.</div>
          </div>
        </div>
        <ArrowRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
      </Link>

      {goalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setGoalModalOpen(false)}>
          <div className="glass rounded-2xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-semibold mb-4">New goal</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-muted-foreground">Goal type</span>
                <select value={newGoalType} onChange={(e) => setNewGoalType(e.target.value)} className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-secondary/30 text-sm">
                  {Object.entries(GOAL_DEFS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">Target value</span>
                <input type="number" step="any" value={newGoalTarget} onChange={(e) => setNewGoalTarget(e.target.value)} className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-secondary/30 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">Target date (optional)</span>
                <input type="date" value={newGoalDate} onChange={(e) => setNewGoalDate(e.target.value)} className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-secondary/30 text-sm" />
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setGoalModalOpen(false)} className="flex-1 h-10 rounded-lg border border-border text-sm">Cancel</button>
              <button onClick={addGoal} disabled={!newGoalTarget} className="flex-1 h-10 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-medium disabled:opacity-50">Set goal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reviews;
