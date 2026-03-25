import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getBearerToken(req: any): string | null {
  const auth = req?.headers?.authorization || req?.headers?.Authorization;
  if (typeof auth !== 'string') return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export async function getAuthedUserAndRole(req: any) {
  const supabaseAdmin = getSupabaseAdmin();
  const token = getBearerToken(req);
  if (!token) return { user: null, role: null };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { user: null, role: null };

  const { data: profile, error: pErr } = await supabaseAdmin
    .from('profiles')
    .select('role,email')
    .eq('id', data.user.id)
    .maybeSingle();

  if (pErr || !profile) return { user: data.user, role: null };
  return { user: data.user, role: profile.role as string };
}

