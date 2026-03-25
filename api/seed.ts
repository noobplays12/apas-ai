import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, getAuthedUserAndRole } from './_supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Only admin can seed.
  const { role } = await getAuthedUserAndRole(req);
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Deactivate any active sessions first (resets "random live sessions").
    await supabase.from('sessions').update({ is_active: false }).eq('is_active', true);

    const classes = [
      { id: 'CS-2024-A', name: 'Computer Science 2024', section: 'A' },
      { id: 'CS-2024-B', name: 'Computer Science 2024', section: 'B' },
      { id: 'EE-2024-A', name: 'Electrical Engineering 2024', section: 'A' },
    ];

    const subjects = [
      { id: 'CS-402', name: 'Distributed Systems', code: 'CS-402' },
      { id: 'CS-301', name: 'Analysis of Algorithms', code: 'CS-301' },
      { id: 'CS-101', name: 'Introduction to Programming', code: 'CS-101' },
      { id: 'MA-201', name: 'Linear Algebra', code: 'MA-201' },
    ];

    const { error: cErr } = await supabase.from('classes').upsert(classes, { onConflict: 'id' });
    if (cErr) throw cErr;

    const { error: sErr } = await supabase.from('subjects').upsert(subjects, { onConflict: 'id' });
    if (sErr) throw sErr;

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('seed error', e);
    return res.status(500).json({ error: e?.message ?? 'Seed failed' });
  }
}

