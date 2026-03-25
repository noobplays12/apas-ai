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

  // Create demo users (roles are assigned by the DB trigger based on email)
  const demoPassword = process.env.DEMO_PASSWORD?.trim() || 'Password@12345';

  const demoUsers = [
    { email: 'demo.teacher@iub.edu.pk', name: 'Demo Teacher', roleHint: 'teacher' as const },
    { email: 'demo.student1@gmail.com', name: 'Demo Student 1', roleHint: 'student' as const },
    { email: 'demo.student2@gmail.com', name: 'Demo Student 2', roleHint: 'student' as const },
  ];

  for (const u of demoUsers) {
    // Create or fetch user
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: u.email,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { name: u.name },
    });

    // If already exists, fetch by email
    let userId = created?.user?.id ?? null;
    if (!userId) {
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (listErr) throw listErr;
      const existing = list.users.find((x) => (x.email ?? '').toLowerCase() === u.email.toLowerCase());
      if (!existing?.id) {
        if (createErr) throw createErr;
        throw new Error(`Failed to create/find user for ${u.email}`);
      }
      userId = existing.id;
    }

    // Ensure profile fields we need for the UI are present
    if (u.roleHint === 'student') {
      await supabase
        .from('profiles')
        .update({ class_id: 'CS-2024-A', roll_no: u.email.includes('1') ? 'CS24A-001' : 'CS24A-002' })
        .eq('id', userId);
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

