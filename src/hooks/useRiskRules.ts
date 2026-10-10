import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountScope } from '@/hooks/useAccountScope';
import type { RiskRules } from '@/lib/traderProfile';

/** The user's saved risk rules for the selected account (falls back to the all-accounts rules). */
export const useRiskRules = () => {
  const { user } = useAuth();
  const { scope } = useAccountScope();
  const [rules, setRules] = useState<RiskRules | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('risk_rules').select('*').eq('user_id', user.id);
      const rows = (data ?? []) as RiskRules[];
      let found: RiskRules | null = rows.find((r) => r.account_id === (scope !== 'all' ? scope : null)) ?? rows.find((r) => r.account_id === null) ?? rows[0] ?? null;
      if (!found) {
        // fall back to the playbook saved in Settings (minimum R:R and max trades per day)
        const { data: tr } = await supabase.from('trading_rules').select('min_rr, max_trades_per_day').eq('user_id', user.id).maybeSingle();
        if (tr) {
          found = {
            account_id: null, require_stop_loss: false, require_strategy: false, max_lot_size: null,
            min_rr: tr.min_rr === null ? 0 : Number(tr.min_rr), allowed_symbols: [], max_trades_per_day: tr.max_trades_per_day ?? null,
          } as unknown as RiskRules;
        }
      }
      setRules(found);
      setLoaded(true);
    })();
  }, [user, scope]);
  return { rules, loaded };
};
