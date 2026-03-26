import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthedUserAndRole, getSupabaseAdmin } from '../_supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { user, role } = await getAuthedUserAndRole(req);
    if (!user || (role !== 'teacher' && role !== 'admin')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const sessionId = String(body?.sessionId ?? '').trim();
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    const supabase = getSupabaseAdmin();

    // Fetch session details
    const { data: session, error: sErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Fetch attendance for this session
    const { data: attendanceRows, error: aErr } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('session_id', sessionId);
    if (aErr) throw aErr;

    const presentIds = new Set((attendanceRows ?? []).filter(a => a.status === 'present').map((a: any) => a.student_id));

    // Fetch students in this section
    let students: any[] = [];
    if (session.section_id) {
      const { data: ssRows } = await supabase
        .from('section_students')
        .select('roll_no, full_name')
        .eq('section_id', session.section_id);
      students = ssRows ?? [];
    }

    // Also look up student profiles to map roll → uid
    const rollToUid: Record<string, string> = {};
    if (students.length > 0) {
      const rolls = students.map((s: any) => s.roll_no);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, roll_no')
        .in('roll_no', rolls);
      (profiles ?? []).forEach((p: any) => { rollToUid[p.roll_no] = p.id; });
    }

    const presentCount = (attendanceRows ?? []).filter((a: any) => a.status === 'present').length;
    const lectureKey = new Date().toISOString().slice(0, 10);

    // Fetch section and semester name
    let sectionName: string | null = null;
    let semesterName: string | null = null;
    if (session.section_id) {
      const { data: sec } = await supabase
        .from('sections')
        .select('section_name, semesters(name)')
        .eq('id', session.section_id)
        .maybeSingle();
      sectionName = (sec as any)?.section_name ?? null;
      semesterName = (sec as any)?.semesters?.name ?? null;
    }

    // Upsert report record
    const { data: report, error: rErr } = await supabase
      .from('session_reports')
      .insert({
        session_id: sessionId,
        teacher_id: session.teacher_id,
        subject_name: session.subject_id ?? 'Unknown Subject',
        section_name: sectionName,
        semester_name: semesterName,
        total_students: students.length || (attendanceRows ?? []).length,
        present_count: presentCount,
      })
      .select('id')
      .single();
    if (rErr) throw rErr;

    const reportId = (report as any).id;

    // Insert per-student rows
    if (students.length > 0) {
      const rowsToInsert = students.map((s: any) => {
        const uid = rollToUid[s.roll_no];
        const isPresent = uid ? presentIds.has(uid) : false;
        return {
          report_id: reportId,
          roll_no: s.roll_no,
          student_name: s.full_name,
          present: isPresent ? 1 : 0,
          total: 1,
          percentage: isPresent ? 100 : 0,
          lectures: { [lectureKey]: isPresent ? 'P' : 'A' },
        };
      });
      const { error: rowErr } = await supabase.from('session_report_rows').insert(rowsToInsert);
      if (rowErr) console.error('session_report_rows insert error:', rowErr.message);
    }

    return res.status(200).json({ ok: true, reportId, presentCount, total: students.length });
  } catch (e: any) {
    console.error('generate-session-report failed:', e);
    return res.status(500).json({ error: e?.message ?? 'Failed to generate report' });
  }
}
