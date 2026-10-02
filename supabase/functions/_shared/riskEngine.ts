// Pure, deterministic risk + rule engine. No I/O, no AI. Same input => same verdict.
// AI never overrides this. Edge Function loads data, calls evaluate(), stores the result.

export type Verdict = "PASS" | "WARNING" | "BLOCKED";

export interface RiskRules {
  max_risk_per_trade_pct: number;
  max_daily_loss_pct: number;
  max_weekly_loss_pct: number;
  min_rr: number;
  max_trades_per_day: number | null;
  max_open_positions: number | null;
  max_lot_size: number | null;
  require_stop_loss: boolean;
  require_strategy: boolean;
  allowed_sessions: string[] | null;
  allowed_symbols: string[] | null;
  allowed_strategy_ids: string[] | null;
  cooldown_losses: number | null;
  cooldown_minutes: number | null;
  warn_at_pct: number;
  day_reset_offset_minutes: number;
}

export interface StrategyRules {
  strategy_id: string;
  name: string;
  enabled: boolean;
  enforcement: "block" | "warn";
  min_rr: number | null;
  max_risk_pct: number | null;
  max_trades_per_day: number | null;
  allowed_sessions: string[] | null;
  allowed_symbols: string[] | null;
  allowed_timeframes: string[] | null;
  required_confirmations: string[];
  require_screenshot: boolean;
  active_from?: string | null; // new strategies can't be traded until this time
}

export interface TradeInput {
  symbol: string;
  direction: "LONG" | "SHORT";
  entry: number;
  stop?: number | null;
  target?: number | null;
  riskPct?: number;
  lots?: number;
  strategyId?: string | null;
  timeframe?: string;
  confirmations: string[];
  hasScreenshot: boolean;
  quoteToAccountRate: number; // only trusted for non-USD quotes (see fx_conversion warning)
}

export interface AccountContext {
  balance: number;
  equity: number;
  todayPnl: number;
  weekPnl: number;
  tradesToday: number;
  strategyTradesToday: number;
  openPositions: number;
  consecutiveLosses: number;
  lastLossAt: Date | null;
  activeLock: { reason: string; until: Date } | null;
}

export interface CheckResult {
  rule: string;
  status: Verdict;
  current: string | number | null;
  allowed: string | number | null;
  message: string;
  unlock: string | null;
}

export interface Sizing {
  lots: number;
  riskAmount: number;
  riskPct: number;
  stopDistance: number;
  potentialLoss: number;
  potentialProfit: number | null;
  rr: number | null;
}

export interface EvalResult {
  verdict: Verdict;
  checks: CheckResult[];
  sizing: Sizing | null;
  daily: { limit: number; used: number; remaining: number };
  weekly: { limit: number; used: number; remaining: number };
  lockRequest: { reason: string; until: string } | null;
}

export const DEFAULT_RULES: RiskRules = {
  max_risk_per_trade_pct: 1,
  max_daily_loss_pct: 3,
  max_weekly_loss_pct: 6,
  min_rr: 1.5,
  max_trades_per_day: 3,
  max_open_positions: 3,
  max_lot_size: null,
  require_stop_loss: true,
  require_strategy: true,
  allowed_sessions: null,
  allowed_symbols: null,
  allowed_strategy_ids: null,
  cooldown_losses: 2,
  cooldown_minutes: 120,
  warn_at_pct: 80,
  day_reset_offset_minutes: 0,
};

// ───────── time helpers ─────────
const DAY = 86_400_000;
export function dayStart(now: Date, offsetMin: number): Date {
  const shifted = now.getTime() + offsetMin * 60_000;
  return new Date(Math.floor(shifted / DAY) * DAY - offsetMin * 60_000);
}
export function weekStart(now: Date, offsetMin: number): Date {
  const d = dayStart(now, offsetMin);
  const dow = (new Date(d.getTime() + offsetMin * 60_000).getUTCDay() + 6) % 7; // Monday = 0
  return new Date(d.getTime() - dow * DAY);
}
export function currentSessions(now: Date): string[] {
  const h = now.getUTCHours();
  const s: string[] = [];
  if (h < 9) s.push("asia");
  if (h >= 7 && h < 16) s.push("london");
  if (h >= 12 && h < 21) s.push("new_york");
  return s;
}

// ───────── symbol specs ─────────
const CCY = new Set(["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"]);
export interface SymbolSpec { contractSize: number; lotStep: number; minLot: number; maxLot: number; quote: string }
export function specFor(symbol: string): SymbolSpec | null {
  const m = symbol.toUpperCase().match(/^([A-Z]{6})/);
  if (!m) return null;
  const base = m[1].slice(0, 3), quote = m[1].slice(3);
  if ((base === "XAU" || base === "XAG") && quote === "USD")
    return { contractSize: base === "XAU" ? 100 : 5000, lotStep: 0.01, minLot: 0.01, maxLot: 100, quote };
  if (CCY.has(base) && CCY.has(quote))
    return { contractSize: 100_000, lotStep: 0.01, minLot: 0.01, maxLot: 100, quote };
  return null; // unsupported => blocked rather than mis-sized
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "_");
const inList = (list: string[] | null | undefined, v: string) => !list || list.length === 0 || list.map(norm).includes(norm(v));

export function evaluate(
  input: TradeInput,
  rules: RiskRules,
  strategy: StrategyRules | null,
  ctx: AccountContext,
  now: Date = new Date(),
): EvalResult {
  const checks: CheckResult[] = [];
  const add = (rule: string, status: Verdict, current: CheckResult["current"], allowed: CheckResult["allowed"], message: string, unlock: string | null = null) =>
    checks.push({ rule, status, current, allowed, message, unlock });

  const off = rules.day_reset_offset_minutes;
  const nextDay = new Date(dayStart(now, off).getTime() + DAY);
  const nextWeek = new Date(weekStart(now, off).getTime() + 7 * DAY);

  // ── 1. Active lock
  if (ctx.activeLock && ctx.activeLock.until > now)
    add("trading_lock", "BLOCKED", ctx.activeLock.reason, "unlocked", `Trading is locked: ${ctx.activeLock.reason}.`, ctx.activeLock.until.toISOString());

  // ── 2. Symbol + structure
  const spec = specFor(input.symbol);
  if (!spec) add("symbol_supported", "BLOCKED", input.symbol, "FX majors/crosses, XAUUSD, XAGUSD", "Symbol not supported by the risk engine yet.");
  if (!inList(rules.allowed_symbols, input.symbol))
    add("allowed_symbols", "BLOCKED", input.symbol, rules.allowed_symbols!.join(", "), "Symbol is not in your allowed list.");

  const long = input.direction === "LONG";
  const hasStop = input.stop != null;
  const stopOk = hasStop && (long ? input.stop! < input.entry : input.stop! > input.entry);
  const targetOk = input.target != null && (long ? input.target > input.entry : input.target < input.entry);

  if (!hasStop) {
    if (rules.require_stop_loss) add("require_stop_loss", "BLOCKED", "none", "required", "A stop loss is required.");
  } else if (!stopOk) add("stop_side", "BLOCKED", input.stop!, long ? `< ${input.entry}` : `> ${input.entry}`, "Stop loss is on the wrong side of entry.");
  if (input.target != null && !targetOk) add("target_side", "BLOCKED", input.target, long ? `> ${input.entry}` : `< ${input.entry}`, "Take profit is on the wrong side of entry.");

  // ── 3. Sizing (needs valid stop + spec)
  let sizing: Sizing | null = null;
  if (spec && stopOk) {
    const rate = spec.quote === "USD" ? 1 : input.quoteToAccountRate;
    if (spec.quote !== "USD") add("fx_conversion", "WARNING", rate, "bridge-verified", "Non-USD quote: conversion rate came from the client. Use the MT5 bridge rate once connected.");
    const stopDistance = Math.abs(input.entry - input.stop!);
    const perLotLoss = stopDistance * spec.contractSize * rate;
    let lots = input.lots ?? 0;
    if (input.lots == null && input.riskPct != null) {
      const target = (ctx.equity * input.riskPct) / 100;
      lots = Math.floor(target / perLotLoss / spec.lotStep) * spec.lotStep;
      lots = Math.round(lots / spec.lotStep) * spec.lotStep;
    }
    if (lots < spec.minLot) {
      add("position_size", "BLOCKED", r2(lots), `>= ${spec.minLot}`, "Risk is too small for the minimum lot at this stop distance. Widen risk or tighten the stop.");
    } else {
      const riskAmount = lots * perLotLoss;
      const rr = targetOk ? Math.abs(input.target! - input.entry) / stopDistance : null;
      sizing = {
        lots: r2(lots),
        riskAmount: r2(riskAmount),
        riskPct: r2((riskAmount / ctx.equity) * 100),
        stopDistance,
        potentialLoss: r2(riskAmount),
        potentialProfit: rr == null ? null : r2(riskAmount * rr),
        rr: rr == null ? null : r2(rr),
      };
    }
    if (lots > spec.maxLot) add("broker_max_lot", "BLOCKED", lots, spec.maxLot, "Exceeds max lot size.");
  }

  // ── 4. Risk per trade (account + strategy cap, strictest wins)
  const maxRisk = Math.min(rules.max_risk_per_trade_pct, strategy?.max_risk_pct ?? Infinity);
  if (sizing) {
    if (sizing.riskPct > maxRisk + 1e-9)
      add("max_risk_per_trade", "BLOCKED", `${sizing.riskPct}%`, `${maxRisk}%`, "Risk per trade exceeds your limit.");
    else add("max_risk_per_trade", "PASS", `${sizing.riskPct}%`, `${maxRisk}%`, "Risk per trade within limit.");
    if (rules.max_lot_size != null && sizing.lots > rules.max_lot_size)
      add("max_lot_size", "BLOCKED", sizing.lots, rules.max_lot_size, "Position size exceeds your lot cap.");
  }

  // ── 5. Daily / weekly loss budgets (realized loss + this trade's risk)
  const dayBase = ctx.balance - ctx.todayPnl;
  const weekBase = ctx.balance - ctx.weekPnl;
  const dailyLimit = (dayBase * rules.max_daily_loss_pct) / 100;
  const weeklyLimit = (weekBase * rules.max_weekly_loss_pct) / 100;
  const dailyUsed = Math.max(0, -ctx.todayPnl);
  const weeklyUsed = Math.max(0, -ctx.weekPnl);

  const budget = (rule: string, label: string, used: number, limit: number, until: Date) => {
    const risk = sizing?.riskAmount ?? 0;
    if (used >= limit) add(rule, "BLOCKED", r2(used), r2(limit), `${label} loss limit already reached.`, until.toISOString());
    else if (used + risk > limit) add(rule, "BLOCKED", r2(used + risk), r2(limit), `This trade's risk would push you past the ${label.toLowerCase()} loss limit.`, until.toISOString());
    else if (used + risk >= (limit * rules.warn_at_pct) / 100) add(rule, "WARNING", r2(used + risk), r2(limit), `You are close to the ${label.toLowerCase()} loss limit.`);
    else add(rule, "PASS", r2(used + risk), r2(limit), `${label} loss budget OK.`);
  };
  budget("max_daily_loss", "Daily", dailyUsed, dailyLimit, nextDay);
  budget("max_weekly_loss", "Weekly", weeklyUsed, weeklyLimit, nextWeek);

  // ── 6. RR (account + strategy, strictest wins)
  const minRR = Math.max(rules.min_rr, strategy?.min_rr ?? 0);
  if (minRR > 0 && stopOk) {
    const rr = sizing?.rr ?? (targetOk ? Math.abs(input.target! - input.entry) / Math.abs(input.entry - input.stop!) : null);
    if (rr == null) add("min_rr", "BLOCKED", "no target", `>= ${minRR}`, "Set a take profit so RR can be verified.");
    else if (rr + 1e-9 < minRR) add("min_rr", "BLOCKED", r2(rr), minRR, "Reward-to-risk is below your minimum.");
    else add("min_rr", "PASS", r2(rr), minRR, "RR meets minimum.");
  }

  // ── 7. Counts
  if (rules.max_trades_per_day != null) {
    const hit = ctx.tradesToday >= rules.max_trades_per_day;
    add("max_trades_per_day", hit ? "BLOCKED" : "PASS", ctx.tradesToday, rules.max_trades_per_day, hit ? "Daily trade limit reached." : "Trade count OK.", hit ? nextDay.toISOString() : null);
  }
  if (rules.max_open_positions != null) {
    const hit = ctx.openPositions >= rules.max_open_positions;
    add("max_open_positions", hit ? "BLOCKED" : "PASS", ctx.openPositions, rules.max_open_positions, hit ? "Too many open positions." : "Open positions OK.", hit ? "Close a position" : null);
  }

  // ── 8. Cooldown after consecutive losses
  if (rules.cooldown_losses && rules.cooldown_minutes && ctx.lastLossAt && ctx.consecutiveLosses >= rules.cooldown_losses) {
    const until = new Date(ctx.lastLossAt.getTime() + rules.cooldown_minutes * 60_000);
    if (until > now) add("cooldown", "BLOCKED", `${ctx.consecutiveLosses} losses in a row`, `${rules.cooldown_losses}`, "Cooldown after consecutive losses is active.", until.toISOString());
  }

  // ── 9. Session
  const sessions = currentSessions(now);
  if (rules.allowed_sessions && rules.allowed_sessions.length && !sessions.some((s) => inList(rules.allowed_sessions, s)))
    add("allowed_sessions", "BLOCKED", sessions.join("+") || "off-hours", rules.allowed_sessions.join(", "), "Outside your allowed trading sessions.");

  // ── 10. Strategy
  if (rules.allowed_strategy_ids && input.strategyId && !rules.allowed_strategy_ids.includes(input.strategyId))
    add("allowed_strategies", "BLOCKED", input.strategyId, "allowed list", "This strategy is not enabled for this account.");

  if (!input.strategyId) {
    if (rules.require_strategy) add("strategy_required", "BLOCKED", "none", "required", "Pick a strategy before trading. No strategy, no trade.");
  } else if (!strategy) {
    add("strategy_rules", "BLOCKED", input.strategyId, "defined", "Strategy not found or has no rules defined.");
  } else if (!strategy.enabled) {
    add("strategy_enabled", "BLOCKED", strategy.name, "enabled", "This strategy is disabled.");
  } else if (strategy.active_from && new Date(strategy.active_from) > now) {
    add("strategy_active", "BLOCKED", strategy.name, "active", "New strategies unlock 24h after creation. No same-day rule-free strategies.", new Date(strategy.active_from).toISOString());
  } else {
    const sev: Verdict = strategy.enforcement === "block" ? "BLOCKED" : "WARNING";
    const sr = (rule: string, bad: boolean, current: CheckResult["current"], allowed: CheckResult["allowed"], msg: string) =>
      add(`strategy:${rule}`, bad ? sev : "PASS", current, allowed, bad ? `[${strategy.name}] ${msg}` : "OK");

    sr("symbol", !inList(strategy.allowed_symbols, input.symbol), input.symbol, strategy.allowed_symbols?.join(", ") ?? "any", "Symbol not allowed for this strategy.");
    sr("session", !!strategy.allowed_sessions?.length && !sessions.some((s) => inList(strategy.allowed_sessions, s)), sessions.join("+") || "off-hours", strategy.allowed_sessions?.join(", ") ?? "any", "Wrong session for this strategy.");
    sr("timeframe", !!strategy.allowed_timeframes?.length && (!input.timeframe || !inList(strategy.allowed_timeframes, input.timeframe)), input.timeframe ?? "none", strategy.allowed_timeframes?.join(", ") ?? "any", "Timeframe not allowed for this strategy.");
    const have = new Set(input.confirmations.map(norm));
    const missing = strategy.required_confirmations.filter((c) => !have.has(norm(c)));
    sr("confirmations", missing.length > 0, missing.join(", "), strategy.required_confirmations.join(", "), `Missing confirmation: ${missing.join(", ")}.`);
    sr("screenshot", strategy.require_screenshot && !input.hasScreenshot, "none", "required", "Attach your analysis screenshot.");
    if (strategy.max_trades_per_day != null)
      sr("max_trades_per_day", ctx.strategyTradesToday >= strategy.max_trades_per_day, ctx.strategyTradesToday, strategy.max_trades_per_day, "Daily trade limit for this strategy reached.");
  }

  // ── Verdict + auto-lock request
  const verdict: Verdict = checks.some((c) => c.status === "BLOCKED") ? "BLOCKED" : checks.some((c) => c.status === "WARNING") ? "WARNING" : "PASS";
  let lockRequest: EvalResult["lockRequest"] = null;
  if (!ctx.activeLock) {
    if (dailyUsed >= dailyLimit) lockRequest = { reason: "daily_loss_limit", until: nextDay.toISOString() };
    else if (weeklyUsed >= weeklyLimit) lockRequest = { reason: "weekly_loss_limit", until: nextWeek.toISOString() };
  }

  return {
    verdict,
    checks,
    sizing,
    daily: { limit: r2(dailyLimit), used: r2(dailyUsed), remaining: r2(Math.max(0, dailyLimit - dailyUsed)) },
    weekly: { limit: r2(weeklyLimit), used: r2(weeklyUsed), remaining: r2(Math.max(0, weeklyLimit - weeklyUsed)) },
    lockRequest,
  };
}
