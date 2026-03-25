import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function toValidHttpUrl(maybeUrl: string | undefined): string | null {
  if (!maybeUrl) return null;
  const trimmed = maybeUrl.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) return null;

  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

const supabaseUrl = toValidHttpUrl(rawSupabaseUrl);
const supabaseAnonKey = rawSupabaseAnonKey?.trim().replace(/^['"]|['"]$/g, '') || null;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error(
    'Supabase not configured. Set valid VITE_SUPABASE_URL (http/https) and VITE_SUPABASE_ANON_KEY in .env.local.'
  );
}

// Always initialize with safe placeholders so module evaluation never throws.
export const supabase = createClient(supabaseUrl ?? 'http://localhost', supabaseAnonKey ?? 'public-anon-key-missing');

