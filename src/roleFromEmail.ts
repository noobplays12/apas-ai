/** Mirrors public.role_from_email in Supabase migrations — keep in sync. */
export function roleFromEmail(email: string): 'student' | 'teacher' | 'admin' {
  const e = email.trim().toLowerCase();
  if (e === 'noobplays304@gmail.com') return 'admin';
  if (e.endsWith('@iub.edu.pk')) return 'teacher';
  return 'student';
}
