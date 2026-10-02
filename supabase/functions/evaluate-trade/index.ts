// POST /functions/v1/evaluate-trade
// Pulls LIVE balance/equity/floating P/L from MetaApi and everything else from the DB (never from the client),
// runs the deterministic engine, stores the verdict, returns an evaluation_id.
// place-order must call consume_evaluation(evaluation_id) before sending anything to MT5.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { adminClient, clientApi, getMetaApiToken, getUserId, json, metaApiFetch, MISSING_TOKEN_MESSAGE, PROVISIONING_API } from "./_shared/metaapi.ts";
import { DEFAULT_RULES, dayStart, weekStart, evaluate, type RiskRules, type StrategyRules } from "./_shared/riskEngine.ts";

const Input = z.object({
  account_id: z.string().uuid(), // = mt5_connections.id
  symbol: z.string().min(3).max(20),
  direction: z.enum(["LONG", "SHORT"]),
  order_type: z.enum(["market", "limit", "stop"]).default("market"),
  entry: z.number().positive(),
  stop: z.number().positive().nullable().optional(),
  target: z.number().positive().nullable().optional(),
  risk_pct: z.number().positive().max(100).optional(),
  lots: z.number().positive().max(100000).optional(),
  strategy_id: z.string().uuid().nullable().optional(),
  timeframe: z.string().max(8).optional(),
  confirmations: z.array(z.string().max(60)).max(20).default([]),
  has_screenshot: z.boolean().default(false),
  quote_to_account_rate: z.number().positive().optional(),
}).refine((v) => v.risk_pct != null || v.lots != null, { message: "Provide risk_pct or lots" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const userId = await getUserId(req);
    if (!userId) return json({ error: "unauthorized" }, 401);

    const parsed = Input.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
    const inp = parsed.data;

    const db = adminClient(); // service role: bypasses RLS, so EVERY query below filters by userId
    const now = new Date();

    // Loosened rules whose 24h delay has passed take effect now (tightening was already instant).
    await db.rpc("apply_due_rule_changes", { p_user: userId });

    // ── Account ownership + live account state
    const { data: conn } = await db.from("mt5_connections").select("id,metaapi_account_id,status").eq("id", inp.account_id).eq("user_id", userId).maybeSingle();
    if (!conn) return json({ error: "account_not_found" }, 404);
    if (conn.status !== "connected" || !conn.metaapi_account_id) return json({ error: "account_not_connected", message: "Connect this MT5 account first. The risk engine needs live balance and equity." }, 409);

    const token = getMetaApiToken();
    if (!token) return json({ error: "config", message: MISSING_TOKEN_MESSAGE }, 500);
    const meta = await metaApiFetch(`${PROVISIONING_API}/users/current/accounts/${conn.metaapi_account_id}`, token);
    const base = clientApi(meta.body?.region);
    const info = await metaApiFetch(`${base}/users/current/accounts/${conn.metaapi_account_id}/account-information`, token);
    // Fail closed: no live balance/equity => no verdict => no trade.
    if (!info.ok || typeof info.body?.balance !== "number" || typeof info.body?.equity !== "number")
      return json({ error: "account_info_unavailable", message: "Could not read live account info from MT5. Try again in a moment." }, 502);
    const pos = await metaApiFetch(`${base}/users/current/accounts/${conn.metaapi_account_id}/positions`, token);
    let openFromDb: number | null = null;

    // ── Rules (account row beats the user default row, else conservative defaults)
    const { data: ruleRows } = await db.from("risk_rules").select("*").eq("user_id", userId).or(`account_id.eq.${inp.account_id},account_id.is.null`);
    const row = ruleRows?.find((r) => r.account_id === inp.account_id) ?? ruleRows?.find((r) => r.account_id === null);
    const rules: RiskRules = row ? { ...DEFAULT_RULES, ...row } : DEFAULT_RULES;
    for (const k of ["max_risk_per_trade_pct", "max_daily_loss_pct", "max_weekly_loss_pct", "min_rr", "max_lot_size"] as const)
      if ((rules as any)[k] != null) (rules as any)[k] = Number((rules as any)[k]);

    let strategy: StrategyRules | null = null;
    if (inp.strategy_id) {
      const { data } = await db.from("strategy_rules").select("*").eq("user_id", userId).eq("strategy_id", inp.strategy_id).maybeSingle();
      if (data) strategy = { ...data, min_rr: data.min_rr == null ? null : Number(data.min_rr), max_risk_pct: data.max_risk_pct == null ? null : Number(data.max_risk_pct) };
    }

    // ── Trade history for THIS account (trades.mt5_connection_id). pnl is used as stored in trades.pnl.
    const dStart = dayStart(now, rules.day_reset_offset_minutes);
    const wStart = weekStart(now, rules.day_reset_offset_minutes);
    const { data: closed } = await db.from("trades").select("pnl,exit_at").eq("user_id", userId).eq("mt5_connection_id", inp.account_id)
      .eq("status", "closed").gte("exit_at", wStart.toISOString()).order("exit_at", { ascending: false });
    const closedRows = closed ?? [];
    const weekPnl = closedRows.reduce((s, t) => s + Number(t.pnl ?? 0), 0);
    const todayPnl = closedRows.filter((t) => new Date(t.exit_at!) >= dStart).reduce((s, t) => s + Number(t.pnl ?? 0), 0);

    // loss streak looks back past the week boundary so Friday's streak still counts on Monday
    const { data: recent } = await db.from("trades").select("pnl,exit_at").eq("user_id", userId).eq("mt5_connection_id", inp.account_id)
      .eq("status", "closed").not("exit_at", "is", null).order("exit_at", { ascending: false }).limit(10);
    let streak = 0; let lastLossAt: Date | null = null;
    for (const t of recent ?? []) { if (Number(t.pnl) < 0) { streak++; lastLossAt ??= new Date(t.exit_at!); } else break; }

    const count = async (q: any) => (await q).count ?? 0;
    const base$ = () => db.from("trades").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("mt5_connection_id", inp.account_id);
    const tradesToday = await count(base$().gte("entry_at", dStart.toISOString()));
    const strategyTradesToday = inp.strategy_id ? await count(base$().eq("strategy_id", inp.strategy_id).gte("entry_at", dStart.toISOString())) : 0;
    if (!pos.ok || !Array.isArray(pos.body)) openFromDb = await count(base$().eq("status", "open")); // live positions preferred, DB as fallback
    const openPositions = Array.isArray(pos.body) ? pos.body.length : openFromDb ?? 0;

    const { data: lock } = await db.from("trading_locks").select("reason,until").eq("user_id", userId).is("released_at", null)
      .gt("until", now.toISOString()).or(`account_id.eq.${inp.account_id},account_id.is.null`).order("until", { ascending: false }).limit(1).maybeSingle();

    const result = evaluate(
      {
        symbol: inp.symbol, direction: inp.direction, entry: inp.entry, stop: inp.stop, target: inp.target,
        riskPct: inp.risk_pct, lots: inp.lots, strategyId: inp.strategy_id, timeframe: inp.timeframe,
        confirmations: inp.confirmations, hasScreenshot: inp.has_screenshot, quoteToAccountRate: inp.quote_to_account_rate,
      },
      rules, strategy,
      {
        balance: info.body.balance, equity: info.body.equity, floatingPnl: Number(info.body.profit ?? 0), currency: info.body.currency ?? "USD",
        todayPnl, weekPnl, tradesToday, strategyTradesToday, openPositions, consecutiveLosses: streak, lastLossAt,
        activeLock: lock ? { reason: lock.reason, until: new Date(lock.until) } : null,
      },
      now,
    );

    if (result.lockRequest)
      await db.from("trading_locks").insert({ user_id: userId, account_id: inp.account_id, reason: result.lockRequest.reason, until: result.lockRequest.until });

    const { data: ev } = await db.from("rule_evaluations").insert({
      user_id: userId, account_id: inp.account_id, verdict: result.verdict, input: inp, result,
      expires_at: new Date(now.getTime() + 2 * 60_000).toISOString(), // single-use, expires in 2 min
    }).select("id,expires_at").single();

    if (result.verdict !== "PASS")
      await db.from("risk_audit_log").insert({
        user_id: userId, account_id: inp.account_id, event: result.verdict === "BLOCKED" ? "trade_blocked" : "trade_warning",
        detail: { evaluation_id: ev?.id, failed: result.checks.filter((c) => c.status !== "PASS").map((c) => c.rule) },
      });

    const { data: pending } = await db.from("risk_rule_changes").select("id,rule_table,changes,effective_at").eq("user_id", userId)
      .is("applied_at", null).is("cancelled_at", null).order("effective_at");

    return json({ evaluation_id: ev?.id, expires_at: ev?.expires_at, ...result, pending_rule_changes: pending ?? [] });
  } catch (err) {
    return json({ error: "internal", message: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
