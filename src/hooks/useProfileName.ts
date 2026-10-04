import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/** The person's display name: profile first, then what they typed at sign-up / Google gave us. */
export const useProfileName = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['profile-name', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('display_name').eq('id', user!.id).maybeSingle();
      return (data?.display_name as string | null) ?? null;
    },
  });
  const meta = ((user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || '') as string);
  const name = (q.data || meta || '').trim();
  const firstName = name.split(/\s+/)[0] ?? '';

  const save = async (value: string) => {
    if (!user) return false;
    const clean = value.trim().slice(0, 40);
    if (!clean) return false;
    const { error } = await supabase.from('profiles').upsert({ id: user.id, display_name: clean });
    if (error) return false;
    qc.setQueryData(['profile-name', user.id], clean);
    return true;
  };

  return { name, firstName, loading: q.isLoading, save, hasUser: !!user };
};
