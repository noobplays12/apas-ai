import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, getAuthedUserAndRole } from '../_supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, role } = await getAuthedUserAndRole(req);
  if (!user || (role !== 'teacher' && role !== 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { sessionId } = (req.body ?? {}) as any;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  const supabase = getSupabaseAdmin();

  try {
    // Teachers can end only their own sessions; admins can end any.
    if (role === 'teacher') {
      const { data: sessionRow, error: sErr } = await supabase
        .from('sessions')
        .select('id,teacher_id')
        .eq('id', sessionId)
        .maybeSingle();
      if (sErr) throw sErr;
      if (!sessionRow || sessionRow.teacher_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const { error } = await supabase
      .from('sessions')
      .update({ is_active: false, end_time: new Date().toISOString() })
      .eq('id', sessionId);
    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('sessions/end error', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to end session' });
  }
}

