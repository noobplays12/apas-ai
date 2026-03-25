import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

/** True when a real Supabase JWT exists (not mock_user bypass). */
export function useHasRealSupabaseSession() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session?.access_token));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(Boolean(session?.access_token));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return hasSession;
}
