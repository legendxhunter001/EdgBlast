import { assertEquals } from "jsr:@std/assert";
import { DEFAULT_RULES, evaluate, type AccountContext, type StrategyRules, type TradeInput } from "./riskEngine.ts";

const now = new Date("2026-10-06T09:00:00Z"); // Tuesday, London session
const ctx: AccountContext = { balance: 10_000, equity: 10_000, todayPnl: 0, weekPnl: 0, tradesToday: 0, strategyTradesToday: 0, openPositions: 0, consecutiveLosses: 0, lastLossAt: null, activeLock: null };
const strat: StrategyRules = { strategy_id: "s1", name: "Liquidity Sweep", enabled: true, enforcement: "block", min_rr: 2, max_risk_pct: 0.75, max_trades_per_day: 2, allowed_sessions: ["london"], allowed_symbols: null, allowed_timeframes: ["1H"], required_confirmations: ["Bearish Engulfing"], require_screenshot: true };
const trade: TradeInput = { symbol: "GBPUSD", direction: "SHORT", entry: 1.2745, stop: 1.2789, target: 1.2644, riskPct: 0.6, strategyId: "s1", timeframe: "1H", confirmations: ["bearish engulfing"], hasScreenshot: true };

Deno.test("clean setup passes and sizes correctly", () => {
  const r = evaluate(trade, DEFAULT_RULES, strat, ctx, now);
  assertEquals(r.verdict, "PASS");
  assertEquals(r.sizing!.lots, 0.13); // 60 risk / (0.0044 * 100000) = 0.136, floored to lot step
});
Deno.test("low RR is blocked", () => {
  const r = evaluate({ ...trade, target: 1.2700 }, DEFAULT_RULES, strat, ctx, now);
  assertEquals(r.checks.find((c) => c.rule === "min_rr")!.status, "BLOCKED");
});
Deno.test("daily loss limit blocks and requests lock", () => {
  const r = evaluate(trade, DEFAULT_RULES, strat, { ...ctx, todayPnl: -320 }, now);
  assertEquals(r.verdict, "BLOCKED");
  assertEquals(r.lockRequest?.reason, "daily_loss_limit");
});
Deno.test("cooldown after 2 losses", () => {
  const r = evaluate(trade, DEFAULT_RULES, strat, { ...ctx, consecutiveLosses: 2, lastLossAt: new Date(now.getTime() - 30 * 60_000) }, now);
  assertEquals(r.checks.find((c) => c.rule === "cooldown")!.status, "BLOCKED");
});
Deno.test("missing strategy confirmation blocks", () => {
  const r = evaluate({ ...trade, confirmations: [] }, DEFAULT_RULES, strat, ctx, now);
  assertEquals(r.checks.find((c) => c.rule === "strategy:confirmations")!.status, "BLOCKED");
});
Deno.test("no strategy = no trade", () => {
  const r = evaluate({ ...trade, strategyId: null }, DEFAULT_RULES, null, ctx, now);
  assertEquals(r.verdict, "BLOCKED");
});
Deno.test("missing stop is blocked", () => {
  const r = evaluate({ ...trade, stop: null }, DEFAULT_RULES, strat, ctx, now);
  assertEquals(r.checks.find((c) => c.rule === "require_stop_loss")!.status, "BLOCKED");
});
Deno.test("brand-new strategy is blocked until active_from", () => {
  const fresh = { ...strat, active_from: new Date(now.getTime() + 3_600_000).toISOString() };
  const r = evaluate(trade, DEFAULT_RULES, fresh, ctx, now);
  assertEquals(r.checks.find((c) => c.rule === "strategy_active")!.status, "BLOCKED");
});
Deno.test("USDJPY uses padded static pip value", () => {
  // 50 pips * 6.7 * 1.1 = 368.5 per lot; risk 1% of 10k = 100 => 0.27 lots
  const r = evaluate({ ...trade, symbol: "USDJPY", direction: "LONG", entry: 150.0, stop: 149.5, target: 151.5, riskPct: 1, strategyId: null }, { ...DEFAULT_RULES, require_strategy: false }, null, ctx, now);
  assertEquals(r.sizing!.lots, 0.27);
  assertEquals(r.checks.find((c) => c.rule === "instrument_spec")!.status, "PASS");
});
Deno.test("broker suffix is ignored (EURUSDm)", () => {
  const r = evaluate({ ...trade, symbol: "EURUSDm" }, DEFAULT_RULES, strat, ctx, now);
  assertEquals(r.checks.find((c) => c.rule === "symbol_supported"), undefined);
});
Deno.test("ES futures: tiny account can't size a contract, big account can (with WARNING)", () => {
  const es = { ...trade, symbol: "ESZ25", direction: "LONG" as const, entry: 5000, stop: 4990, target: 5030, riskPct: 1, strategyId: null };
  const rules = { ...DEFAULT_RULES, require_strategy: false };
  assertEquals(evaluate(es, rules, null, ctx, now).checks.find((c) => c.rule === "position_size")!.status, "BLOCKED");
  const big = evaluate(es, rules, null, { ...ctx, balance: 100_000, equity: 100_000 }, now);
  assertEquals(big.sizing!.lots, 1);
  assertEquals(big.sizing!.riskAmount, 550); // 40 ticks * 12.5 * 1.1
  assertEquals(big.checks.find((c) => c.rule === "instrument_spec")!.status, "WARNING");
});
Deno.test("unknown / oil CFD / FX cross without a rate are blocked, not guessed", () => {
  for (const symbol of ["FOOBAR123", "USOIL", "EURAUD"]) {
    const r = evaluate({ ...trade, symbol }, DEFAULT_RULES, strat, ctx, now);
    assertEquals(r.checks.find((c) => c.rule === "symbol_supported")?.status, "BLOCKED", symbol);
  }
});
Deno.test("FX cross with client rate is allowed but flagged", () => {
  const r = evaluate({ ...trade, symbol: "EURAUD", quoteToAccountRate: 0.65 }, DEFAULT_RULES, strat, ctx, now);
  assertEquals(r.checks.find((c) => c.rule === "instrument_spec")!.status, "WARNING");
});
Deno.test("open floating loss counts toward the daily budget", () => {
  // 3% of 10k = 300 budget. Floating -250 + this trade's 60 risk = 310 > 300 => BLOCKED
  const r = evaluate(trade, DEFAULT_RULES, strat, { ...ctx, floatingPnl: -250 }, now);
  assertEquals(r.checks.find((c) => c.rule === "max_daily_loss")!.status, "BLOCKED");
  assertEquals(evaluate(trade, DEFAULT_RULES, strat, { ...ctx, floatingPnl: 100 }, now).checks.find((c) => c.rule === "max_daily_loss")!.status, "PASS");
});
Deno.test("non-USD account is blocked", () => {
  const r = evaluate(trade, DEFAULT_RULES, strat, { ...ctx, currency: "EUR" }, now);
  assertEquals(r.checks.find((c) => c.rule === "account_currency")!.status, "BLOCKED");
});
