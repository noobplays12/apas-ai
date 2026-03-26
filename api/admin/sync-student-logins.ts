import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthedUserAndRole, getSupabaseAdmin } from '../_supabaseAdmin.js';
import { ensureStudentLogins } from '../lib/studentAuthSync.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { role } = await getAuthedUserAndRole(req);
    if (role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const supabase = getSupabaseAdmin();
    const { data: rows, error } = await supabase.from('section_students').select('roll_no,full_name,section_id').limit(5000);
    if (error) throw error;

    const syncResult = await ensureStudentLogins(supabase as any, (rows ?? []) as any[], null);
    return res.status(200).json({ ok: true, total: rows?.length ?? 0, ...syncResult });
  } catch (e: any) {
    console.error('sync-student-logins failed', e);
    return res.status(500).json({ error: e?.message ?? 'Sync failed' });
  }
}

