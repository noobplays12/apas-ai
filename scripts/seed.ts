import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Explicitly load local env file for Node scripts.
dotenv.config({ path: '.env.local' });
dotenv.config();

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing ${name} in environment`);
  return v.trim().replace(/^['"]|['"]$/g, '');
}

async function main() {
  const url = mustGetEnv('SUPABASE_URL');
  const serviceRoleKey = mustGetEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Reset active sessions
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

  // Departmental: semester + section (requires migration 0002_departmental.sql)
  let semesterId: string | null = null;
  let sectionId: string | null = null;
  try {
    const { data: semExisting } = await supabase.from('semesters').select('id').eq('name', 'BSCS Semester 5').maybeSingle();
    if (semExisting?.id) {
      semesterId = semExisting.id;
    } else {
      const { data: semIns, error: semErr } = await supabase
        .from('semesters')
        .insert({ name: 'BSCS Semester 5', sort_order: 5 })
        .select('id')
        .single();
      if (!semErr && semIns?.id) semesterId = semIns.id;
    }
    if (semesterId) {
      const { data: secExisting } = await supabase
        .from('sections')
        .select('id')
        .eq('semester_id', semesterId)
        .eq('section_name', 'A')
        .maybeSingle();
      if (secExisting?.id) {
        sectionId = secExisting.id;
      } else {
        const { data: secIns, error: secErr } = await supabase
          .from('sections')
          .insert({ semester_id: semesterId, section_name: 'A', display_label: 'CS 2024 Sec A' })
          .select('id')
          .single();
        if (!secErr && secIns?.id) sectionId = secIns.id;
      }
    }
  } catch (e) {
    console.warn('Departmental seed skipped (apply supabase/migrations/0002_departmental.sql):', e);
  }

  // Create demo users (roles are assigned by the DB trigger based on email)
  const demoPassword = process.env.DEMO_PASSWORD?.trim() || 'Password@12345';

  const demoUsers: { email: string; name: string; roleHint: 'teacher' | 'student' }[] = [
    { email: 'demo.teacher@iub.edu.pk', name: 'Demo Teacher', roleHint: 'teacher' },
    { email: 'demo.student1@gmail.com', name: 'Demo Student 1', roleHint: 'student' },
    { email: 'demo.student2@gmail.com', name: 'Demo Student 2', roleHint: 'student' },
  ];

  for (const demo of demoUsers) {
    // Create or fetch user
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: demo.email,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { name: demo.name },
    });

    // If already exists, fetch by email
    let userId = created?.user?.id ?? null;
    if (!userId) {
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (listErr) throw listErr;
      const target = demo.email.toLowerCase();
      const users = list.users as { id: string; email?: string | null }[];
      const existing = users.find((x) => (x.email ?? '').toLowerCase() === target);
      if (!existing?.id) {
        if (createErr) throw createErr;
        throw new Error(`Failed to create/find user for ${demo.email}`);
      }
      userId = existing.id;
    }

    // Ensure profile fields we need for the UI are present
    if (demo.roleHint === 'student') {
      const patch: Record<string, string> = {
        class_id: 'CS-2024-A',
        roll_no: demo.email.includes('1') ? 'CS24A-001' : 'CS24A-002',
      };
      if (semesterId) patch.semester_id = semesterId;
      if (sectionId) patch.section_id = sectionId;
      await supabase.from('profiles').update(patch).eq('id', userId);
    }
  }

  console.log('Seed complete.');
  console.log('Created/ensured: classes, subjects, demo teacher + 2 demo students.');
  console.log(`Demo password: ${demoPassword}`);
  console.log('Teacher login: demo.teacher@iub.edu.pk');
  console.log('Student logins: demo.student1@gmail.com, demo.student2@gmail.com');
}

main().catch((e) => {
  console.error('Seed failed:', e?.message ?? e);
  process.exit(1);
});

