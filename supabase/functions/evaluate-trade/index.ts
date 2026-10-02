// POST /functions/v1/evaluate-trade
// Loads everything server-side (never trusts the client for P/L, counts, or rules),
// runs the deterministic engine, stores the verdict, returns an evaluation_id.
// The future place-order function must call consume_evaluation(evaluation_id) before sending to MT5.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { DEFAULT_RULES, dayStart, weekStart, evaluate, type RiskRules, type StrategyRules } from "../_shared/riskEngine.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const Input = z.object({
  account_id: z.string().uuid(),
  symbol: z.string().min(3).max(20),
  direction: z.enum(["LONG", "SHORT"]),
  order_type: z.enum(["market", "buy_limit", "sell_limit", "buy_stop", "sell_stop"]).default("market"),
  entry: z.number().positive(),
  stop: z.number().positive().nullable().optional(),
  target: z.number().positive().nullable().optional(),
  risk_pct: z.number().positive().max(100).optional(),
  lots: z.number().positive().max(1000).optional(),
  strategy_id: z.string().uuid().nullable().optional(),
  timeframe: z.string().max(8).optional(),
  confirmations: z.array(z.string().max(60)).max(20).default([]),
  has_screenshot: z.boolean().default(false),
  quote_to_account_rate: z.number().positive().default(1),
}).refine((v) => v.risk_pct != null || v.lots != null, { message: "Provide risk_pct or lots" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
  const inp = parsed.data;

  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!); // service role: bypasses RLS, so every query below filters by user.id
  const now = new Date();

  // ── Account (ownership check)
  // ASSUMPTION: trading_accounts(id, user_id, balance, equity). Adjust column names to your schema.
  const { data: acct } = await db.from("trading_accounts").select("id,balance,equity").eq("id", inp.account_id).eq("user_id", user.id).maybeSingle();
  if (!acct) return json({ error: "account_not_found" }, 404);

  // ── Apply any loosened rules whose 24h delay has passed (DB triggers queue loosening; tightening is instant)
  await db.rpc("apply_due_rule_changes", { p_user: user.id });

  // ── Rules (account-specific row beats the default row, else conservative defaults)
  const { data: ruleRows } = await db.from("risk_rules").select("*").eq("user_id", user.id).or(`account_id.eq.${inp.account_id},account_id.is.null`);
  const row = ruleRows?.find((r) => r.account_id === inp.account_id) ?? ruleRows?.find((r) => r.account_id === null);
  const rules: RiskRules = row ? { ...DEFAULT_RULES, ...row } : DEFAULT_RULES;
  for (const k of ["max_risk_per_trade_pct", "max_daily_loss_pct", "max_weekly_loss_pct", "min_rr", "max_lot_size"] as const)
    if ((rules as any)[k] != null) (rules as any)[k] = Number((rules as any)[k]);

  let strategy: StrategyRules | null = null;
  if (inp.strategy_id) {
    const { data } = await db.from("strategy_rules").select("*").eq("user_id", user.id).eq("strategy_id", inp.strategy_id).maybeSingle();
    if (data) strategy = { ...data, min_rr: data.min_rr == null ? null : Number(data.min_rr), max_risk_pct: data.max_risk_pct == null ? null : Number(data.max_risk_pct) };
  }

  // ── Trade history → context
  // ASSUMPTION: trades(user_id, account_id, status 'open'|'closed', pnl, opened_at, closed_at, strategy_id).
  const dStart = dayStart(now, rules.day_reset_offset_minutes);
  const wStart = weekStart(now, rules.day_reset_offset_minutes);
  const { data: closed } = await db.from("trades").select("pnl,closed_at").eq("user_id", user.id).eq("account_id", inp.account_id)
    .eq("status", "closed").gte("closed_at", wStart.toISOString()).order("closed_at", { ascending: false });
  const closedRows = closed ?? [];
  const weekPnl = closedRows.reduce((s, t) => s + Number(t.pnl ?? 0), 0);
  const todayPnl = closedRows.filter((t) => new Date(t.closed_at) >= dStart).reduce((s, t) => s + Number(t.pnl ?? 0), 0);

  // streak looks back past the week boundary so a Friday streak still counts Monday morning
  const { data: recent } = await db.from("trades").select("pnl,closed_at").eq("user_id", user.id).eq("account_id", inp.account_id)
    .eq("status", "closed").order("closed_at", { ascending: false }).limit(10);
  let streak = 0; let lastLossAt: Date | null = null;
  for (const t of recent ?? []) { if (Number(t.pnl) < 0) { streak++; lastLossAt ??= new Date(t.closed_at); } else break; }

  const count = async (q: any) => (await q).count ?? 0;
  const base = () => db.from("trades").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("account_id", inp.account_id);
  const tradesToday = await count(base().gte("opened_at", dStart.toISOString()));
  const strategyTradesToday = inp.strategy_id ? await count(base().eq("strategy_id", inp.strategy_id).gte("opened_at", dStart.toISOString())) : 0;
  const openPositions = await count(base().eq("status", "open"));

  const { data: lock } = await db.from("trading_locks").select("reason,until").eq("user_id", user.id).is("released_at", null)
    .gt("until", now.toISOString()).or(`account_id.eq.${inp.account_id},account_id.is.null`).order("until", { ascending: false }).limit(1).maybeSingle();

  const result = evaluate(
    {
      symbol: inp.symbol, direction: inp.direction, entry: inp.entry, stop: inp.stop, target: inp.target,
      riskPct: inp.risk_pct, lots: inp.lots, strategyId: inp.strategy_id, timeframe: inp.timeframe,
      confirmations: inp.confirmations, hasScreenshot: inp.has_screenshot, quoteToAccountRate: inp.quote_to_account_rate,
    },
    rules, strategy,
    {
      balance: Number(acct.balance), equity: Number(acct.equity), todayPnl, weekPnl, tradesToday, strategyTradesToday,
      openPositions, consecutiveLosses: streak, lastLossAt, activeLock: lock ? { reason: lock.reason, until: new Date(lock.until) } : null,
    },
    now,
  );

  if (result.lockRequest)
    await db.from("trading_locks").insert({ user_id: user.id, account_id: inp.account_id, reason: result.lockRequest.reason, until: result.lockRequest.until });

  const { data: ev } = await db.from("rule_evaluations").insert({
    user_id: user.id, account_id: inp.account_id, verdict: result.verdict, input: inp, result,
    expires_at: new Date(now.getTime() + 2 * 60_000).toISOString(), // approval is single-use and expires in 2 min
  }).select("id,expires_at").single();

  if (result.verdict !== "PASS")
    await db.from("risk_audit_log").insert({
      user_id: user.id, account_id: inp.account_id, event: result.verdict === "BLOCKED" ? "trade_blocked" : "trade_warning",
      detail: { evaluation_id: ev?.id, failed: result.checks.filter((c) => c.status !== "PASS").map((c) => c.rule) },
    });

  const { data: pending } = await db.from("risk_rule_changes").select("id,rule_table,changes,effective_at").eq("user_id", user.id)
    .is("applied_at", null).is("cancelled_at", null).order("effective_at");

  return json({ evaluation_id: ev?.id, expires_at: ev?.expires_at, ...result, pending_rule_changes: pending ?? [] });
});
