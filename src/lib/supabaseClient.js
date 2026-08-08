import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    'Supabase env vars missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) - ' +
    'auth and cross-device sync are disabled. Copy .env.example to .env.local ' +
    'and fill in real values to enable them.'
  );
}

// null (not a throw) when unconfigured, so a missing .env.local degrades to
// "auth features no-op" rather than white-screening the whole app - every
// caller (AuthContext, syncClient) checks for this before using it.
export const supabase = (url && anonKey) ? createClient(url, anonKey) : null;
