import { assertEquals } from "jsr:@std/assert";
import { DEFAULT_RULES, evaluate, type AccountContext, type StrategyRules, type TradeInput } from "./riskEngine.ts";

const now = new Date("2026-10-06T09:00:00Z"); // Tuesday, London session
const ctx: AccountContext = { balance: 10_000, equity: 10_000, todayPnl: 0, weekPnl: 0, tradesToday: 0, strategyTradesToday: 0, openPositions: 0, consecutiveLosses: 0, lastLossAt: null, activeLock: null };
const strat: StrategyRules = { strategy_id: "s1", name: "Liquidity Sweep", enabled: true, enforcement: "block", min_rr: 2, max_risk_pct: 0.75, max_trades_per_day: 2, allowed_sessions: ["london"], allowed_symbols: null, allowed_timeframes: ["1H"], required_confirmations: ["Bearish Engulfing"], require_screenshot: true };
const trade: TradeInput = { symbol: "GBPUSD", direction: "SHORT", entry: 1.2745, stop: 1.2789, target: 1.2644, riskPct: 0.6, strategyId: "s1", timeframe: "1H", confirmations: ["bearish engulfing"], hasScreenshot: true, quoteToAccountRate: 1 };

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
