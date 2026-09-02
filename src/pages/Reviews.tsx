import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import {
  TrendingUp, Target, Plus, X,
  ArrowRight, ShieldAlert,
} from 'lucide-react';
import { format, parseISO, getDay, differenceInCalendarDays, startOfMonth } from 'date-fns';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

const Reviews = () => {
  const { user } = useAuth();
  const { data: trades } = useTrades();
  const closed = useMemo(() => (trades ?? []).filter((t) => t.status === 'closed' && t.pnl !== null), [trades]);

  /* ---------- Performance diagnostics ---------- */
  const insights = useMemo(() => {
    if (closed.length < 3) return null;

    const byDay = new Array(7).fill(0).map(() => ({ pnl: 0, count: 0 }));
    const byEmotion: Record<string, { pnl: number; count: number }> = {};
    closed.forEach((t) => {
      if (t.exit_at) {
        const d = getDay(parseISO(t.exit_at));
        byDay[d].pnl += Number(t.pnl ?? 0);
        byDay[d].count += 1;
      }
      const emo = t.emotional_state ?? 'unlogged';
      if (!byEmotion[emo]) byEmotion[emo] = { pnl: 0, count: 0 };
      byEmotion[emo].pnl += Number(t.pnl ?? 0);
      byEmotion[emo].count += 1;
    });

    const bestDay = byDay.map((d, i) => ({ ...d, day: DAYS[i] })).filter((d) => d.count >= 2).sort((a, b) => b.pnl / b.count - a.pnl / a.count)[0];
    const worstDay = byDay.map((d, i) => ({ ...d, day: DAYS[i] })).filter((d) => d.count >= 2).sort((a, b) => a.pnl / a.count - b.pnl / b.count)[0];

    const emotionEntries = Object.entries(byEmotion).filter(([k, v]) => k !== 'unlogged' && v.count >= 2);
    const bestEmotion = emotionEntries.sort((a, b) => b[1].pnl / b[1].count - a[1].pnl / a[1].count)[0];
    const worstEmotion = emotionEntries.sort((a, b) => a[1].pnl / a[1].count - b[1].pnl / b[1].count)[0];

    // Current streak
    const sorted = [...closed].sort((a, b) => (a.exit_at ?? '').localeCompare(b.exit_at ?? ''));
    let streak = 0; let streakType: 'win' | 'loss' | null = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const isWin = Number(sorted[i].pnl) > 0;
      if (streakType === null) { streakType = isWin ? 'win' : 'loss'; streak = 1; }
      else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) streak++;
      else break;
    }

    // Recent trend: last 10 vs prior 10
    const last10 = sorted.slice(-10);
    const prior10 = sorted.slice(-20, -10);
    const avgPnl = (arr: typeof sorted) => arr.length ? arr.reduce((s, t) => s + Number(t.pnl ?? 0), 0) / arr.length : null;
    const recentAvg = avgPnl(last10);
    const priorAvg = avgPnl(prior10);
    const improving = recentAvg !== null && priorAvg !== null ? recentAvg > priorAvg : null;

    const rrs = closed.map((t) => Number(t.risk_reward)).filter((v) => !isNaN(v) && v !== 0);
    const avgRr = rrs.length ? rrs.reduce((a, b) => a + b, 0) / rrs.length : null;
    const poorRrCount = closed.filter((t) => { const rr = Number(t.risk_reward); return !isNaN(rr) && rr > 0 && rr < 1; }).length;

    // Overtrading: group by calendar day, compare avg P&L on heavy-volume days vs lighter days.
    const byCalDay: Record<string, number[]> = {};
    closed.forEach((t) => {
      if (!t.exit_at) return;
      const key = t.exit_at.slice(0, 10);
      (byCalDay[key] ??= []).push(Number(t.pnl ?? 0));
    });
    const heavyDays = Object.values(byCalDay).filter((d) => d.length >= 3);
    const lightDays = Object.values(byCalDay).filter((d) => d.length <= 2);
    const avgOf = (groups: number[][]) => {
      const all = groups.flat();
      return all.length ? all.reduce((a, b) => a + b, 0) / all.length : null;
    };
    const heavyAvg = avgOf(heavyDays);
    const lightAvg = avgOf(lightDays);
    const overtrading = heavyDays.length >= 2 && heavyAvg !== null && lightAvg !== null && heavyAvg < lightAvg;

    // Position-sizing consistency: high variance relative to mean suggests sizing by feel, not plan.
    const sizes = closed.map((t) => Number(t.position_size)).filter((v) => !isNaN(v) && v > 0);
    let sizeInconsistent = false;
    if (sizes.length >= 5) {
      const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      const variance = sizes.reduce((s, v) => s + (v - mean) ** 2, 0) / sizes.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      sizeInconsistent = cv > 0.6;
    }

    return {
      bestDay, worstDay, bestEmotion, worstEmotion, streak, streakType, improving, recentAvg, priorAvg,
      avgRr, poorRrCount, overtrading, heavyAvg, lightAvg, sizeInconsistent,
    };
  }, [closed]);

  const winRate = closed.length ? (closed.filter((t) => Number(t.pnl) > 0).length / closed.length) * 100 : null;
  const grossProfit = closed.filter((t) => Number(t.pnl) > 0).reduce((s, t) => s + Number(t.pnl), 0);
  const grossLoss = Math.abs(closed.filter((t) => Number(t.pnl) < 0).reduce((s, t) => s + Number(t.pnl), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;

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

  const currentValueFor = (goal: Goal): number | null => {
    switch (goal.goal_type) {
      case 'win_rate': return winRate;
      case 'profit_factor': return profitFactor;
      case 'avg_rr': return insights?.avgRr ?? null;
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
    const startingValue = ['account_balance'].includes(newGoalType) ? Number(newGoalTarget) * 0 : null;
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

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-semibold">Reviews</h1>
        <p className="text-sm text-muted-foreground mt-1">
          What's helping you, what's holding you back, how far you are from your goals — and a coach to help you close the gap.
        </p>
      </header>

      {/* Performance diagnostics */}
      {!insights ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Log a few more closed trades and this page will start showing you real patterns in your performance.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="size-4 text-bull" />
              <h3 className="font-display font-semibold">What's moving you forward</h3>
            </div>
            <ul className="space-y-2.5 text-sm">
              {insights.bestDay && (
                <li>Your best day is <b>{insights.bestDay.day}</b>, averaging {formatCurrency(insights.bestDay.pnl / insights.bestDay.count, { sign: true })} per trade.</li>
              )}
              {insights.bestEmotion && (
                <li>Trades logged as <b className="capitalize">{insights.bestEmotion[0]}</b> perform best — averaging {formatCurrency(insights.bestEmotion[1].pnl / insights.bestEmotion[1].count, { sign: true })}.</li>
              )}
              {insights.streakType === 'win' && insights.streak >= 2 && (
                <li>You're on a <b>{insights.streak}-trade winning streak</b> right now.</li>
              )}
              {insights.improving === true && (
                <li>Your last 10 trades are outperforming the 10 before them — real, recent improvement.</li>
              )}
              {!insights.bestDay && !insights.bestEmotion && <li className="text-muted-foreground">Log more trades with dates and emotional state to surface real strengths.</li>}
            </ul>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="size-4 text-bear" />
              <h3 className="font-display font-semibold">What's holding you back</h3>
            </div>
            <ul className="space-y-2.5 text-sm">
              {insights.worstDay && insights.worstDay.pnl < 0 && (
                <li><b>{insights.worstDay.day}</b> is costing you — averaging {formatCurrency(insights.worstDay.pnl / insights.worstDay.count, { sign: true })} per trade.</li>
              )}
              {insights.worstEmotion && insights.worstEmotion[1].pnl < 0 && (
                <li>Trades logged as <b className="capitalize">{insights.worstEmotion[0]}</b> are your costliest — averaging {formatCurrency(insights.worstEmotion[1].pnl / insights.worstEmotion[1].count, { sign: true })}. Worth a pause before entering in this state.</li>
              )}
              {insights.streakType === 'loss' && insights.streak >= 2 && (
                <li>You're on a <b>{insights.streak}-trade losing streak</b> — this is exactly when discipline matters most.</li>
              )}
              {insights.improving === false && (
                <li>Your last 10 trades are underperforming the 10 before them — worth reviewing what changed.</li>
              )}
              {insights.poorRrCount > 0 && (
                <li><b>{insights.poorRrCount}</b> recent trade{insights.poorRrCount === 1 ? '' : 's'} had under 1R reward-to-risk — a hard pattern to stay profitable with long-term.</li>
              )}
              {insights.overtrading && (
                <li>Days where you take <b>3+ trades</b> perform worse on average than lighter days — a real sign of overtrading, not just bad luck.</li>
              )}
              {insights.sizeInconsistent && (
                <li>Your position sizing swings widely between trades — sizing by feel instead of a fixed plan makes results harder to control.</li>
              )}
              {!insights.worstDay && !insights.worstEmotion && insights.poorRrCount === 0 && !insights.overtrading && !insights.sizeInconsistent && (
                <li className="text-muted-foreground">Nothing stands out yet — keep logging to catch patterns early.</li>
              )}
            </ul>
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
            No goals set yet. Set one — win rate, monthly P&L, account balance — and this page will track your real distance from it.
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
                        currentPace >= paceNeeded
                          ? ' At your current pace, you\'re on track.'
                          : ' At your current pace, you\'re behind — this is the gap to close.'
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
