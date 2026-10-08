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
    supabase.from('risk_rules').select('*').eq('user_id', user.id).then(({ data }) => {
      const rows = (data ?? []) as RiskRules[];
      setRules(rows.find((r) => r.account_id === (scope !== 'all' ? scope : null)) ?? rows.find((r) => r.account_id === null) ?? rows[0] ?? null);
      setLoaded(true);
    });
  }, [user, scope]);
  return { rules, loaded };
};
