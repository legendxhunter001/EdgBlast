import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Verdict = "PASS" | "WARNING" | "BLOCKED";
export interface CheckResult { rule: string; status: Verdict; current: string | number | null; allowed: string | number | null; message: string; unlock: string | null }
export interface EvaluateResponse {
  evaluation_id: string; expires_at: string; verdict: Verdict; checks: CheckResult[];
  sizing: { lots: number; riskAmount: number; riskPct: number; stopDistance: number; potentialLoss: number; potentialProfit: number | null; rr: number | null } | null;
  daily: { limit: number; used: number; remaining: number }; weekly: { limit: number; used: number; remaining: number };
}
export interface EvaluateRequest {
  account_id: string; symbol: string; direction: "LONG" | "SHORT"; entry: number; stop?: number | null; target?: number | null;
  risk_pct?: number; lots?: number; strategy_id?: string | null; timeframe?: string; confirmations?: string[]; has_screenshot?: boolean; quote_to_account_rate?: number;
}

// Call this from the MT5 order ticket on every change (debounced) and again on "Submit".
// BLOCKED => disable submit AND show checks.filter(c => c.status === "BLOCKED") with message/current/allowed/unlock.
export function useEvaluateTrade() {
  return useMutation({
    mutationFn: async (req: EvaluateRequest): Promise<EvaluateResponse> => {
      const { data, error } = await supabase.functions.invoke("evaluate-trade", { body: req });
      if (error) throw error;
      return data as EvaluateResponse;
    },
  });
}
