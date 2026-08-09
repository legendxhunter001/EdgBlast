// Independent build — wired to our own Supabase project (not Lovable Cloud).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Keep missing-env-var failures visible on screen instead of crashing silently —
// checked and rendered by main.tsx.
export const supabaseConfigError =
  !SUPABASE_URL || !SUPABASE_ANON_KEY
    ? `Missing Supabase env vars. VITE_SUPABASE_URL=${SUPABASE_URL ? 'set' : 'MISSING'}, VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY ? 'set' : 'MISSING'}`
    : null;

export const supabase = createClient<Database>(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
