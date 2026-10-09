import { format, parseISO } from 'date-fns';
import type { Trade } from '@/hooks/useTrades';
import type { Database } from '@/integrations/supabase/types';

export type Axis = { key: string; label: string; score: number; hasData: boolean; evidence: string; how: string };
export type ClosedTrade = Trade;
export type RiskRules = Database['public']['Tables']['risk_rules']['Row'];

/* ───────────── 7-axis profile ─────────────
   Every score is a ratio of real, recorded trades. A trade that lacks the data an axis needs is
   left out of that axis (never counted as 0, never filled with a guess). */
export const MIN = 5;
const numOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);
export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function computeProfile(closed: ClosedTrade[], rules: RiskRules | null) {
  const total = closed.length;
  const more = (n: number, min = MIN, unit = 'measurable trade') => `Needs ${plural(Math.max(0, min - n), unit)} more`;

  /* Discipline: trades that followed every saved rule that could be checked on them */
  const viol = { noStop: 0, noStrategy: 0, oversize: 0, lowRr: 0, symbol: 0 };
  let dMeasured = 0, dOk = 0;
  if (rules) {
    const syms = (rules.allowed_symbols ?? []).map((x) => x.toUpperCase());
    closed.forEach((t) => {
      let checks = 0, fails = 0;
      if (rules.require_stop_loss) { checks++; if (!numOrNull(t.stop_loss)) { fails++; viol.noStop++; } }
      if (rules.require_strategy) { checks++; if (!t.strategy_id) { fails++; viol.noStrategy++; } }
      const size = numOrNull(t.position_size);
      if (rules.max_lot_size !== null && size !== null) { checks++; if (size > Number(rules.max_lot_size)) { fails++; viol.oversize++; } }
      const e = numOrNull(t.entry_price), sl = numOrNull(t.stop_loss), tp = numOrNull(t.take_profit);
      if (e !== null && sl !== null && tp !== null && e !== sl) {
        checks++;
        if (Math.abs(tp - e) / Math.abs(e - sl) < Number(rules.min_rr)) { fails++; viol.lowRr++; }
      }
      if (syms.length) { checks++; if (!syms.includes(t.asset.toUpperCase())) { fails++; viol.symbol++; } }
      if (checks) { dMeasured++; if (!fails) dOk++; }
    });
  }
  const discipline = pct(dOk, dMeasured);

  /* Psychology: tagged trades entered in a composed state */
  const tagged = closed.filter((t) => t.emotional_state && t.emotional_state !== 'neutral');
  const composedStates = ['calm', 'confident', 'excited'];
  const composed = tagged.filter((t) => composedStates.includes(t.emotional_state as string));
  const other = tagged.filter((t) => !composedStates.includes(t.emotional_state as string));
  const avgPnl = (l: ClosedTrade[]) => (l.length ? l.reduce((x, t) => x + Number(t.pnl ?? 0), 0) / l.length : null);
  const composedAvg = composed.length >= 3 && other.length >= 3 ? avgPnl(composed) : null;
  const otherAvg = composedAvg !== null ? avgPnl(other) : null;
  const psychology = pct(composed.length, tagged.length);

  /* Risk: how steady your position size is */
  const sizes = closed.map((t) => numOrNull(t.position_size)).filter((v): v is number => v !== null && v > 0);
  const sizeMean = sizes.length ? sizes.reduce((x, y) => x + y, 0) / sizes.length : 0;
  const cv = sizes.length >= MIN && sizeMean > 0 ? Math.sqrt(sizes.reduce((x, v) => x + (v - sizeMean) ** 2, 0) / sizes.length) / sizeMean : 0;
  const riskMgmt = Math.max(0, Math.min(100, 100 - cv * 100));

  /* Execution: trades that ended the way the plan said (stop honoured, target captured) */
  let xMeasured = 0, xOk = 0;
  closed.forEach((t) => {
    const e = numOrNull(t.entry_price), x = numOrNull(t.exit_price), sl = numOrNull(t.stop_loss);
    if (e === null || x === null || sl === null || e === sl) return;
    const r = ((t.direction === 'short' ? -1 : 1) * (x - e)) / Math.abs(e - sl);
    if (r < 0) { xMeasured++; if (r >= -1.15) xOk++; return; }
    const tp = numOrNull(t.take_profit);
    if (tp === null) return;
    xMeasured++;
    if (r >= (Math.abs(tp - e) / Math.abs(e - sl)) * 0.85) xOk++;
  });
  const execution = pct(xOk, xMeasured);

  /* Consistency: profitable trading weeks */
  const weekPnl: Record<string, number> = {};
  closed.forEach((t) => { if (t.exit_at) { const k = format(parseISO(t.exit_at), 'RRRR-II'); weekPnl[k] = (weekPnl[k] ?? 0) + Number(t.pnl ?? 0); } });
  const weeks = Object.values(weekPnl);
  const winWeeks = weeks.filter((v) => v > 0).length;
  const consistency = pct(winWeeks, weeks.length);

  /* Patience: trading days that stayed inside your max-trades-per-day rule */
  const maxDay = rules?.max_trades_per_day ?? null;
  const perDay: Record<string, number> = {};
  closed.forEach((t) => { if (t.entry_at) { const k = t.entry_at.slice(0, 10); perDay[k] = (perDay[k] ?? 0) + 1; } });
  const dayCounts = Object.values(perDay);
  const dayOk = maxDay !== null ? dayCounts.filter((v) => v <= maxDay).length : 0;
  const patience = pct(dayOk, dayCounts.length);

  /* Strategy: trades logged against a named strategy */
  const strat = closed.filter((t) => t.strategy_id).length;
  const strategy = pct(strat, total);

  const axes: Axis[] = [
    {
      key: 'discipline', label: 'Discipline', score: discipline, hasData: !!rules && dMeasured >= MIN,
      evidence: !rules ? 'Save your risk rules to measure this'
        : dMeasured === 0 ? 'None of your saved rules could be checked on these trades'
        : dMeasured < MIN ? more(dMeasured)
        : `${dOk} of ${dMeasured} trades followed every saved rule`,
      how: 'Share of trades that followed every one of your saved risk rules that could be checked on that trade (required stop loss, required strategy, max lot size, minimum planned reward, allowed symbols). Judged against your current rules.',
    },
    {
      key: 'psychology', label: 'Psychology', score: psychology, hasData: tagged.length >= MIN,
      evidence: tagged.length < MIN ? more(tagged.length, MIN, 'tagged trade') : `${composed.length} of ${tagged.length} tagged trades entered calm, confident or excited${total > tagged.length ? ` (${total - tagged.length} untagged or neutral left out)` : ''}`,
      how: 'Share of your emotion-tagged trades entered calm, confident or excited. Untagged and neutral trades are left out (neutral was the form default, so it cannot prove a choice), never counted as bad.',
    },
    {
      key: 'risk', label: 'Risk Mgmt', score: riskMgmt, hasData: sizes.length >= MIN,
      evidence: sizes.length < MIN ? more(sizes.length, MIN, 'trade with a size') : `Position size varied ${Math.round(cv * 100)}% around your average across ${sizes.length} trades`,
      how: 'How steady your position size is: 100 minus how much lot size varies around your average. Deliberate size changes also lower it.',
    },
    {
      key: 'execution', label: 'Execution', score: execution, hasData: xMeasured >= MIN,
      evidence: xMeasured < MIN ? more(xMeasured) : `${xOk} of ${xMeasured} trades ended as planned`,
      how: 'Share of trades that ended as planned. Losses count when the stop held (within 15% slippage). Wins count when at least 85% of the planned target was captured. Needs entry, exit and stop (and a target for wins).',
    },
    {
      key: 'consistency', label: 'Consistency', score: consistency, hasData: weeks.length >= 4,
      evidence: weeks.length < 4 ? more(weeks.length, 4, 'trading week') : `${winWeeks} of ${weeks.length} trading weeks were profitable`,
      how: 'Share of trading weeks with positive net P&L. Needs at least 4 trading weeks.',
    },
    {
      key: 'patience', label: 'Patience', score: patience, hasData: maxDay !== null && dayCounts.length >= MIN,
      evidence: maxDay === null ? 'Set a max trades per day rule to measure this'
        : dayCounts.length < MIN ? more(dayCounts.length, MIN, 'trading day')
        : `${dayOk} of ${dayCounts.length} trading days stayed within your limit of ${maxDay}`,
      how: 'Share of trading days (by entry date) that stayed within your max trades per day rule.',
    },
    {
      key: 'strategy', label: 'Strategy', score: strategy, hasData: total >= MIN,
      evidence: total < MIN ? more(total, MIN, 'closed trade') : `${strat} of ${total} trades were logged against a named strategy`,
      how: 'Share of closed trades logged against a named strategy.',
    },
  ];

  const dataAxes = axes.filter((a) => a.hasData);
  const overall = dataAxes.length >= 3 ? dataAxes.reduce((x, a) => x + a.score, 0) / dataAxes.length : null;
  const sorted = [...dataAxes].sort((x, y) => y.score - x.score);

  /* realized R (stored risk_reward is realized, not planned): feeds the Average R:R goal */
  const rrs = closed.map((t) => numOrNull(t.risk_reward)).filter((v): v is number => v !== null && v !== 0);
  const avgRr = rrs.length ? rrs.reduce((x, y) => x + y, 0) / rrs.length : null;

  const byExitDay: Record<string, number[]> = {};
  closed.forEach((t) => { if (t.exit_at) (byExitDay[t.exit_at.slice(0, 10)] ??= []).push(Number(t.pnl ?? 0)); });
  const heavy = Object.values(byExitDay).filter((d) => d.length >= 3).flat();
  const light = Object.values(byExitDay).filter((d) => d.length <= 2).flat();
  const mean = (l: number[]) => l.reduce((x, y) => x + y, 0) / l.length;
  const heavyAvg = heavy.length >= 3 && light.length >= 3 ? mean(heavy) : null;
  const lightAvg = heavyAvg !== null ? mean(light) : null;

  return {
    axes, overall, measured: dataAxes.length,
    strongest: sorted[0] ?? null, weakest: sorted[sorted.length - 1] ?? null,
    avgRr, heavyAvg, lightAvg, viol, composedAvg, otherAvg, composedN: composed.length, otherN: other.length,
  };
}


/**
 * Planned risk:reward from the stop and target you set on each trade.
 * Reward per 1 of risk: |target - entry| / |entry - stop|. Trades whose levels don't make sense
 * for their direction (or that are missing a level) are left out, never guessed.
 */
export function plannedRiskReward(trades: Trade[]): { ratio: number | null; n: number } {
  const ratios: number[] = [];
  trades.forEach((t) => {
    const e = numOrNull(t.entry_price), sl = numOrNull(t.stop_loss), tp = numOrNull(t.take_profit);
    if (e === null || sl === null || tp === null || e === sl) return;
    const ok = t.direction === 'short' ? tp < e && e < sl : tp > e && e > sl;
    if (!ok) return;
    ratios.push(Math.abs(tp - e) / Math.abs(e - sl));
  });
  return { ratio: ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null, n: ratios.length };
}

/** 2.3 becomes "1:2.3" (1 risked to 2.3 of reward) */
export const fmtRiskReward = (r: number | null) => (r === null ? '—' : `1:${r.toFixed(1).replace(/\.0$/, '')}`);
