import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, getAuthedUserAndRole } from '../_supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, role } = await getAuthedUserAndRole(req);
  if (!user || (role !== 'teacher' && role !== 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const {
    classId,
    subjectId,
    durationMinutes,
    verifyGPS,
    verifyWiFi,
    wifiSSID,
    location,
  } = (req.body ?? {}) as any;

  if (!classId || !subjectId || !durationMinutes) {
    return res.status(400).json({ error: 'Missing classId/subjectId/durationMinutes' });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Deactivate any existing active sessions for this teacher.
    await supabase.from('sessions').update({ is_active: false }).eq('teacher_id', user.id).eq('is_active', true);

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + Number(durationMinutes) * 60_000);

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        class_id: classId,
        subject_id: subjectId,
        teacher_id: user.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        is_active: true,
        verify_gps: Boolean(verifyGPS),
        verify_wifi: Boolean(verifyWiFi),
        wifi_ssid: verifyWiFi ? (wifiSSID ?? null) : null,
        location_lat: location?.latitude ?? null,
        location_lng: location?.longitude ?? null,
        location_radius: location?.radius ?? null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return res.status(200).json({ session: data });
  } catch (e: any) {
    console.error('sessions/start error', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to start session' });
  }
}

