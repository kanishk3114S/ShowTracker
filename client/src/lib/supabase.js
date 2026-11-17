import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase Client Warning]: VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is not defined in client/.env.'
  );
}

/**
 * Frontend Supabase Client instance.
 * Manages Google OAuth redirect, PKCE flow, session lifecycle, and automatic token refresh.
 */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  }
);

export default supabase;
