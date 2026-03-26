import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthedUserAndRole, getSupabaseAdmin } from '../_supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { role } = await getAuthedUserAndRole(req);
    if (role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const teacherId = String(body?.teacherId ?? '').trim();
    const active = Boolean(body?.active);
    if (!teacherId) return res.status(400).json({ error: 'Missing teacherId' });

    const supabase = getSupabaseAdmin();
    // Update user_metadata to track active state since profiles may not have is_active column yet
    const { error } = await supabase.auth.admin.updateUserById(teacherId, {
      user_metadata: { is_active: active },
    });
    if (error) throw error;

    return res.status(200).json({ ok: true, teacherId, active });
  } catch (e: any) {
    console.error('toggle-teacher-active failed:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed' });
  }
}
