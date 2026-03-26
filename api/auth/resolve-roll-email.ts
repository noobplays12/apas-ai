import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_supabaseAdmin.js';

function normalizeRoll(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const rollNo = normalizeRoll(body?.rollNo);
    if (!rollNo) {
      return res.status(400).json({ error: 'Missing roll number' });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'student')
      .eq('roll_no', rollNo)
      .maybeSingle();

    if (error) throw error;
    if (!data?.email) {
      return res.status(404).json({ error: 'Student not found' });
    }

    return res.status(200).json({ email: String(data.email).trim().toLowerCase() });
  } catch (e: any) {
    console.error('resolve-roll-email failed', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to resolve roll number' });
  }
}

