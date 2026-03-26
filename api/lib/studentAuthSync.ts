import type { SupabaseClient } from '@supabase/supabase-js';

export type StudentRosterRow = {
  roll_no: string;
  full_name: string;
  section_id?: string | null;
};

function normalizeRoll(roll: string): string {
  return String(roll ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function firstNameFromFullName(fullName: string): string {
  const first = String(fullName ?? '')
    .trim()
    .split(/\s+/)
    .find(Boolean);
  const cleaned = (first ?? 'student').replace(/[^a-zA-Z]/g, '').toLowerCase();
  return cleaned || 'student';
}

function lastFourFromRoll(rollNo: string): string {
  const onlyDigits = rollNo.replace(/\D/g, '');
  if (onlyDigits.length >= 4) return onlyDigits.slice(-4);
  return rollNo.slice(-4).toLowerCase();
}

export function buildStudentEmail(rollNo: string): string {
  const safeRoll = normalizeRoll(rollNo).toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `${safeRoll}@student.apas.local`;
}

export function buildStudentPassword(fullName: string, rollNo: string): string {
  return `${firstNameFromFullName(fullName)}@${lastFourFromRoll(normalizeRoll(rollNo))}`;
}

export async function ensureStudentLogins(
  supabase: SupabaseClient,
  rows: StudentRosterRow[],
  fallbackSemesterId?: string | null
): Promise<{ ensured: number; failed: number; failures: string[] }> {
  if (!rows.length) return { ensured: 0, failed: 0, failures: [] };

  const normalized = rows
    .map((r) => ({
      roll_no: normalizeRoll(r.roll_no),
      full_name: String(r.full_name ?? '').trim().replace(/\s+/g, ' '),
      section_id: r.section_id ?? null,
    }))
    .filter((r) => r.roll_no && r.full_name);

  if (!normalized.length) return { ensured: 0, failed: 0, failures: [] };

  const sectionIds = [...new Set(normalized.map((r) => r.section_id).filter(Boolean) as string[])];
  const sectionSemesterMap = new Map<string, string | null>();
  if (sectionIds.length) {
    const { data: secs, error: secErr } = await supabase.from('sections').select('id,semester_id').in('id', sectionIds);
    if (secErr) throw secErr;
    for (const s of secs ?? []) {
      sectionSemesterMap.set(String((s as any).id), ((s as any).semester_id as string) ?? null);
    }
  }

  const { data: userList, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw listErr;
  const existingByEmail = new Map<string, string>();
  for (const u of userList.users ?? []) {
    if (u.email) existingByEmail.set(u.email.toLowerCase(), u.id);
  }

  let ensured = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const row of normalized) {
    try {
      const email = buildStudentEmail(row.roll_no);
      const password = buildStudentPassword(row.full_name, row.roll_no);

      let userId = existingByEmail.get(email.toLowerCase()) ?? null;
      if (!userId) {
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: row.full_name },
        });
        if (createErr) throw createErr;
        userId = created.user?.id ?? null;
        if (!userId) throw new Error(`Auth user not created for ${row.roll_no}`);
        existingByEmail.set(email.toLowerCase(), userId);
      } else {
        const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
          user_metadata: { name: row.full_name },
        });
        if (updErr) throw updErr;
      }

      const semester_id = row.section_id ? (sectionSemesterMap.get(row.section_id) ?? fallbackSemesterId ?? null) : (fallbackSemesterId ?? null);

      const { error: profErr } = await supabase.from('profiles').upsert(
        {
          id: userId,
          name: row.full_name,
          email,
          role: 'student',
          roll_no: row.roll_no,
          section_id: row.section_id,
          semester_id,
        },
        { onConflict: 'id' }
      );
      if (profErr) throw profErr;

      ensured++;
    } catch (e: any) {
      failed++;
      failures.push(`${row.roll_no}: ${e?.message ?? String(e)}`);
    }
  }

  return { ensured, failed, failures: failures.slice(0, 30) };
}

