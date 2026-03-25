import { supabase } from '../supabaseClient';
import type { Session, UserProfile } from '../types';

/** Active session query for a student: section-scoped (preferred) or legacy class_id */
export function studentActiveSessionsQuery(user: UserProfile) {
  let q = supabase.from('sessions').select('*').eq('is_active', true);
  if (user.semesterId && user.sectionId) {
    q = q.eq('semester_id', user.semesterId).eq('section_id', user.sectionId);
  } else if (user.classId) {
    q = q.eq('class_id', user.classId);
  } else {
    return null;
  }
  return q.order('created_at', { ascending: false }).limit(1);
}
