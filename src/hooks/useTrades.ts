import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccountScope } from '@/hooks/useAccountScope';

export type Trade = {
  id: string;
  user_id: string;
  asset: string;
  direction: 'long' | 'short';
  status: 'open' | 'closed';
  entry_price: number | null;
  exit_price: number | null;
  position_size: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  pnl: number | null;
  pnl_percent: number | null;
  risk_reward: number | null;
  fees: number | null;
  entry_at: string | null;
  exit_at: string | null;
  strategy_id: string | null;
  emotional_state: string | null;
  confidence_rating: number | null;
  review_score: number | null;
  thesis: string | null;
  entry_reasoning: string | null;
  exit_reasoning: string | null;
  execution_notes: string | null;
  psychology_review: string | null;
  mistakes: string | null;
  what_went_well: string | null;
  lessons_learned: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const useTrades = () => {
  const { scope } = useAccountScope();
  return useQuery({
    queryKey: ['trades', scope],
    queryFn: async () => {
      let q = supabase
        .from('trades')
        .select('*')
        .order('entry_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1000);
      if (scope !== 'all') q = q.eq('mt5_connection_id', scope);
      const { data, error } = await q;
      if (error) throw error;
      return data as Trade[];
    },
  });
};

export const useTrade = (id: string | undefined) =>
  useQuery({
    queryKey: ['trade', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('trades').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as Trade | null;
    },
  });

export const useScreenshots = (tradeId: string | undefined) =>
  useQuery({
    queryKey: ['screenshots', tradeId],
    enabled: !!tradeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('trade_screenshots').select('*').eq('trade_id', tradeId!);
      if (error) throw error;
      const withSigned = await Promise.all(
        (data ?? []).map(async (s: any) => {
          const { data: signed } = await supabase.storage
            .from('trade-screenshots')
            .createSignedUrl(s.storage_path, 60 * 60);
          return { ...s, url: signed?.signedUrl ?? s.url };
        })
      );
      return withSigned;
    },
  });

export const useStrategies = () =>
  useQuery({
    queryKey: ['strategies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('strategies').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
