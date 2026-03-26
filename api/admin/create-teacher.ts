import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthedUserAndRole, getSupabaseAdmin } from '../_supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { role } = await getAuthedUserAndRole(req);
    if (role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const name = String(body?.name ?? '').trim();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const department = String(body?.department ?? '').trim() || null;

    if (!name || !email) return res.status(400).json({ error: 'name and email are required' });

    const supabase = getSupabaseAdmin();
    const DEFAULT_PASSWORD = 'Faculty@2025!';

    // Create auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { name },
    });

    let userId: string;
    if (authErr) {
      if (authErr.message?.includes('already been registered') || authErr.message?.includes('already exists')) {
        // Fetch existing user
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        if (!existing?.id) return res.status(409).json({ error: `Email ${email} already exists` });
        userId = existing.id;
      } else {
        throw authErr;
      }
    } else {
      userId = authData.user.id;
    }

    // Upsert profile
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: userId,
      name,
      email,
      role: 'teacher',
      department,
      is_active: true,
    }, { onConflict: 'id' });
    if (profileErr) throw profileErr;

    return res.status(200).json({ ok: true, userId, email, name });
  } catch (e: any) {
    console.error('create-teacher failed:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to create teacher' });
  }
}
