import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? `Missing Supabase env vars. VITE_SUPABASE_URL=${supabaseUrl ? 'set' : 'MISSING'}, VITE_SUPABASE_ANON_KEY=${supabaseAnonKey ? 'set' : 'MISSING'}`
    : null

// Fall back to harmless placeholder values so createClient doesn't throw —
// supabaseConfigError is what actually gets checked and shown on screen.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
)
