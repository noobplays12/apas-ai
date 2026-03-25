import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as XLSX from 'xlsx';
import { getSupabaseAdmin, getAuthedUserAndRole } from '../_supabaseAdmin';

function getCell(r: Record<string, unknown>, ...aliases: string[]): string {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(r)) {
    map.set(norm(k), v);
  }
  for (const a of aliases) {
    const v = map.get(norm(a));
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function normalizeDay(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  const map: Record<string, number> = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  };
  if (map[s] !== undefined) return map[s];
  if (s.length >= 3 && map[s.slice(0, 3)] !== undefined) return map[s.slice(0, 3)];
  const n = parseInt(s, 10);
  if (!Number.isNaN(n) && n >= 0 && n <= 6) return n;
  return null;
}

/** Accepts 24h "09:00", "09:00:00", or "11:30 AM" / "1:00 PM" */
function normalizeTime(t: string): string | null {
  const s = t.trim();
  if (!s) return null;
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const min = ampm[2];
    const ap = ampm[4].toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}:00`;
  }
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    return s.length === 5 ? `${s}:00` : s;
  }
  return null;
}

async function resolveTeacherId(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  teacherRaw: string
): Promise<string | null> {
  const email = teacherRaw.trim().toLowerCase();
  if (email.includes('@')) {
    const { data } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    return data?.id ?? null;
  }

  const stripped = teacherRaw
    .replace(/\b(prof\.|professor|dr\.|doctor|mr\.|mrs\.|ms\.|miss)\b/gi, '')
    .trim();
  const tokens = stripped.split(/[\s,]+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return null;

  const { data: candidates, error } = await supabase.from('profiles').select('id, name').eq('role', 'teacher');
  if (error || !candidates?.length) return null;

  const tn = stripped.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    const n = (c.name || '').toLowerCase();
    let score = 0;
    if (n === tn) score = 100;
    else if (n.includes(tn) || tn.includes(n)) score = 80;
    else {
      for (const tok of tokens) {
        if (tok.length > 2 && n.includes(tok.toLowerCase())) score += 10;
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { id: c.id, score };
  }
  return best && best.score >= 10 ? best.id : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { role } = await getAuthedUserAndRole(req);
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const supabase = getSupabaseAdmin();
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const fileBase64: string | undefined = body?.fileBase64;
  const defaultSemesterName: string = String(body?.semesterName ?? body?.semester_name ?? '').trim();
  const defaultSectionName: string = String(body?.sectionName ?? body?.section_name ?? '').trim();

  if (!fileBase64) {
    return res.status(400).json({ error: 'Missing fileBase64' });
  }

  try {
    const buf = Buffer.from(fileBase64, 'base64');
    if (buf.length > 8 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large (max ~8MB)' });
    }

    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      const teacher_email = getCell(r, 'teacher_email', 'Teacher Email', 'teacherEmail');
      const teacher_name = getCell(r, 'teacher', 'TEACHER', 'Teacher Name', 'FACULTY');
      const subject_id = getCell(
        r,
        'subject_id',
        'Subject ID',
        'subjectId',
        'COURSE_CODE',
        'course_code',
        'Course Code'
      );

      const semester_name = getCell(
        r,
        'semester_name',
        'Semester',
        'semester',
        'SEMESTER',
        'CLASS NAME',
        'class name'
      );
      const section_name = getCell(r, 'section_name', 'Section', 'section', 'SECTION', 'BSARIN');

      const day_raw = getCell(r, 'day_of_week', 'Day', 'day', 'DAY', 'WEEKDAY');
      const start_time = getCell(r, 'start_time', 'Start', 'start', 'START TIME', 'START_TIME', 'start time');
      const end_time = getCell(r, 'end_time', 'End', 'end', 'END TIME', 'END_TIME', 'end time');

      const semesterFinal = semester_name || defaultSemesterName;
      const sectionFinal = section_name || defaultSectionName;

      if (!subject_id || !semesterFinal || !sectionFinal || !day_raw || !start_time || !end_time) {
        errors.push(`Row ${i + 2}: missing required fields (need subject/course, semester, section, day, start, end)`);
        continue;
      }

      let teacherId: string | null = null;
      if (teacher_email) {
        const { data: prof } = await supabase.from('profiles').select('id').eq('email', teacher_email.toLowerCase()).maybeSingle();
        teacherId = prof?.id ?? null;
      }
      if (!teacherId && teacher_name) {
        teacherId = await resolveTeacherId(supabase, teacher_name);
      }
      if (!teacherId) {
        errors.push(
          `Row ${i + 2}: could not resolve teacher (use teacher_email column, or ensure TEACHER name matches a profile)`
        );
        continue;
      }

      const day = normalizeDay(day_raw);
      const st = normalizeTime(start_time);
      const et = normalizeTime(end_time);
      if (day === null || !st || !et) {
        errors.push(`Row ${i + 2}: invalid day or time (${day_raw} / ${start_time} / ${end_time})`);
        continue;
      }

      const { data: sem, error: semErr } = await supabase.from('semesters').select('id').eq('name', semesterFinal).maybeSingle();
      if (semErr || !sem?.id) {
        errors.push(`Row ${i + 2}: semester not found: "${semesterFinal}" (create it in Semesters first)`);
        continue;
      }

      const { data: secExact } = await supabase
        .from('sections')
        .select('id')
        .eq('semester_id', sem.id)
        .eq('section_name', sectionFinal.trim())
        .maybeSingle();

      let sectionId = secExact?.id ?? null;
      if (!sectionId) {
        const { data: secLike } = await supabase
          .from('sections')
          .select('id')
          .eq('semester_id', sem.id)
          .ilike('section_name', `%${sectionFinal.trim()}%`)
          .limit(1)
          .maybeSingle();
        sectionId = secLike?.id ?? null;
      }
      if (!sectionId) {
        errors.push(`Row ${i + 2}: section not found: "${sectionFinal}" under semester "${semesterFinal}"`);
        continue;
      }

      const room = getCell(r, 'room', 'ROOM', 'Room');

      const { error: insErr } = await supabase.from('timetable_slots').insert({
        teacher_id: teacherId,
        subject_id: subject_id.trim(),
        semester_id: sem.id,
        section_id: sectionId,
        day_of_week: day,
        start_time: st,
        end_time: et,
        slot_label: room || null,
      });

      if (insErr) {
        errors.push(`Row ${i + 2}: ${insErr.message}`);
      } else {
        inserted++;
      }
    }

    await supabase.from('import_logs').insert({
      kind: 'timetable',
      message: `Inserted ${inserted} timetable rows`,
      meta: { rows: rows.length },
    });

    return res.status(200).json({ ok: true, inserted, rowCount: rows.length, errors: errors.slice(0, 80) });
  } catch (e: any) {
    console.error('parse-timetable', e);
    return res.status(500).json({ error: e?.message ?? 'Parse failed' });
  }
}
