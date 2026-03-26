import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import { roleFromEmail } from './roleFromEmail';
import { UserProfile } from './types';
import { Toaster, toast } from 'sonner';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MarkAttendance from './pages/MarkAttendance';
import AttendanceHistory from './pages/AttendanceHistory';
import CreateSession from './pages/CreateSession';
import LiveAttendance from './pages/LiveAttendance';
import Reports from './pages/Reports';
import StudentManagement from './pages/StudentManagement';
import TeacherManagement from './pages/TeacherManagement';
import ClassManagement from './pages/ClassManagement';
import SystemSettings from './pages/SystemSettings';
import Unauthorized from './pages/Unauthorized';
import Layout from './components/Layout';
import MissingSupabaseEnv from './components/MissingSupabaseEnv';
import AdminUploadSectionPdf from './pages/AdminUploadSectionPdf';
import AdminUploadTimetable from './pages/AdminUploadTimetable';
import AdminActiveSessions from './pages/AdminActiveSessions';

/** Slow networks / cold Supabase need more headroom than 20s for auth + RLS + optional RPC/insert. */
const SESSION_TIMEOUT_MS = 30_000;
const PROFILE_LOAD_TIMEOUT_MS = 60_000;
const PROFILE_LOAD_RETRY_DELAY_MS = 1_200;

function formatAuthError(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message);
  return String(e);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setUser(null);
      return;
    }

    // Check for mock user first (for local testing/bypass)
    const mockUserStr = localStorage.getItem('mock_user');
    if (mockUserStr) {
      try {
        const mockUser = JSON.parse(mockUserStr);
        // If storage contains `null` or an unexpected shape, don't crash the whole app.
        if (!mockUser || typeof mockUser !== 'object' || !('role' in mockUser)) {
          localStorage.removeItem('mock_user');
          // Fall through to Firebase auth state handler.
        } else {
          // Normalize mock createdAt into an ISO string (bypass mode stores plain objects).
          if (
            (mockUser as any)?.createdAt &&
            typeof (mockUser as any).createdAt === 'object' &&
            'seconds' in (mockUser as any).createdAt
          ) {
            (mockUser as any).createdAt = new Date((mockUser as any).createdAt.seconds * 1000).toISOString();
          }

          // Force logout if mock user is missing required fields (like classId for students)
          const hasStudentScope =
            (mockUser as any).classId ||
            ((mockUser as any).semesterId && (mockUser as any).sectionId);
          if ((mockUser as any).role === 'student' && !hasStudentScope) {
            localStorage.removeItem('mock_user');
            setLoading(false);
            return;
          }

          setUser(mockUser as any);
          setLoading(false);
          return;
        }
      } catch (e) {
        localStorage.removeItem('mock_user');
      }
    }

    const applyProfileRow = (row: Record<string, unknown>, emailFallback: string | null) => {
      const createdRaw = row.created_at;
      const createdAt =
        typeof createdRaw === 'string' || createdRaw instanceof Date
          ? new Date(createdRaw as string | Date).toISOString()
          : new Date().toISOString();
      setUser({
        uid: row.id as string,
        name: row.name as string,
        email: (row.email as string) ?? emailFallback ?? '',
        role: row.role as UserProfile['role'],
        rollNo: (row.roll_no as string) ?? undefined,
        classId: (row.class_id as string) ?? undefined,
        semesterId: (row.semester_id as string) ?? undefined,
        sectionId: (row.section_id as string) ?? undefined,
        deviceId: (row.device_id as string) ?? undefined,
        createdAt,
      } as UserProfile);
    };

    const loadProfile = async (userId: string, email: string | null) => {
      // Run getUser + profile select in parallel (sequential was ~2× latency on slow links).
      const [{ data: authData, error: authErr }, profileFirst] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      ]);

      if (authErr || !authData.user) {
        toast.error(`Session error: ${formatAuthError(authErr ?? 'no user')}`);
        setUser(null);
        return;
      }
      const uid = authData.user.id;
      if (uid !== userId) {
        toast.error('Session mismatch. Please sign in again.');
        setUser(null);
        return;
      }

      let { data, error } = profileFirst;

      if (error) {
        toast.error(`Profile load: ${formatAuthError(error)}`);
        throw error;
      }

      if (!data) {
        const { error: rpcErr } = await supabase.rpc('ensure_my_profile');
        if (!rpcErr) {
          const res = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
          if (res.error) {
            toast.error(`Profile after RPC: ${formatAuthError(res.error)}`);
            throw res.error;
          }
          data = res.data;
        } else {
          console.warn('ensure_my_profile:', rpcErr);
        }
      }

      if (!data) {
        const au = authData.user;
        if (!au.email) {
          toast.error('Your account has no email; cannot create a profile.');
          setUser(null);
          return;
        }
        const displayName =
          typeof au.user_metadata?.name === 'string' && au.user_metadata.name.trim()
            ? au.user_metadata.name.trim()
            : au.email.split('@')[0];
        const { error: insErr } = await supabase.from('profiles').insert({
          id: uid,
          name: displayName,
          email: au.email,
          role: roleFromEmail(au.email),
        });
        if (insErr) {
          if (insErr.code === '23505') {
            const res = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
            if (res.error) {
              toast.error(`Profile after duplicate: ${formatAuthError(res.error)}`);
              throw res.error;
            }
            data = res.data;
          } else {
            toast.error(
              `Cannot create profile: ${insErr.message}. In Supabase SQL, run migrations 0003 (RPC), 0005 (insert trigger + policy).`
            );
            console.error('Profile insert failed:', insErr);
            setUser(null);
            return;
          }
        } else {
          const res = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
          if (res.error) {
            toast.error(`Profile read: ${formatAuthError(res.error)}`);
            throw res.error;
          }
          data = res.data;
        }
      }

      if (!data) {
        setUser(null);
        return;
      }

      applyProfileRow(data as Record<string, unknown>, email ?? authData.user.email ?? null);
    };

    const loadProfileWithRetry = async (userId: string, email: string | null) => {
      try {
        await withTimeout(loadProfile(userId, email), PROFILE_LOAD_TIMEOUT_MS, 'loadProfile');
      } catch (firstErr) {
        // Intermittent network stalls can trip a timeout; retry once before surfacing auth failure.
        await sleep(PROFILE_LOAD_RETRY_DELAY_MS);
        await withTimeout(loadProfile(userId, email), PROFILE_LOAD_TIMEOUT_MS, 'loadProfile(retry)');
      }
    };

    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS, 'getSession');
        if (data.session?.user) {
          try {
            await loadProfileWithRetry(data.session.user.id, data.session.user.email ?? null);
          } catch (e) {
            console.error('Supabase auth sync error:', e);
            toast.error(`Auth: ${formatAuthError(e)}`);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (e) {
        console.error('Supabase init error:', e);
        toast.error(`Startup: ${formatAuthError(e)}`);
        setUser(null);
      } finally {
        setLoading(false);
      }

      const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
        // Token refresh runs on a timer and when the tab becomes visible — must not block the UI.
        if (event === 'TOKEN_REFRESHED') return;

        // Emitted once when the listener is registered; we already ran getSession + loadProfile above.
        if (event === 'INITIAL_SESSION') return;

        // Callback may pass null while a session still exists. Re-read from the client before clearing.
        let s = session;
        if (!s?.user) {
          try {
            const { data: fromClient } = await withTimeout(
              supabase.auth.getSession(),
              SESSION_TIMEOUT_MS,
              'getSession(recover)'
            );
            s = fromClient.session;
          } catch (e) {
            console.error('getSession(recover) failed:', e);
            setUser(null);
            return;
          }
        }

        if (s?.user) {
          try {
            await loadProfileWithRetry(s.user.id, s.user.email ?? null);
          } catch (e) {
            console.error('Supabase auth sync error:', e);
            toast.error(`Auth: ${formatAuthError(e)}`);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      });
      unsub = () => sub.subscription.unsubscribe();
    })();

    return () => {
      if (unsub) unsub();
    };
  }, []);

  return (
    <>
      <Toaster position="top-right" richColors />
      {loading ? (
        <div className="flex h-screen items-center justify-center bg-[#F8FAFF]">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#0A66FF] border-t-transparent"></div>
        </div>
      ) : !isSupabaseConfigured ? (
        <MissingSupabaseEnv />
      ) : (
        <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        
        <Route element={user ? <Layout user={user} /> : <Navigate to="/login" />}>
          <Route path="/" element={user ? <Dashboard user={user} /> : <Navigate to="/login" replace />} />
          
          {/* Student Routes */}
          <Route
            path="/mark-attendance"
            element={user && user.role === 'student' ? <MarkAttendance user={user} /> : <Navigate to="/unauthorized" replace />}
          />
          <Route
            path="/history"
            element={user && user.role === 'student' ? <AttendanceHistory user={user} /> : <Navigate to="/unauthorized" replace />}
          />
          
          {/* Teacher Routes */}
          <Route
            path="/create-session"
            element={user && (user.role === 'teacher' || user.role === 'admin') ? <CreateSession user={user} /> : <Navigate to="/unauthorized" replace />}
          />
          <Route
            path="/live-attendance/:sessionId"
            element={user && (user.role === 'teacher' || user.role === 'admin') ? <LiveAttendance user={user} /> : <Navigate to="/unauthorized" replace />}
          />
          <Route
            path="/reports"
            element={user && (user.role === 'teacher' || user.role === 'admin') ? <Reports user={user} /> : <Navigate to="/unauthorized" replace />}
          />
          
          {/* Admin Routes */}
          <Route
            path="/students"
            element={user && user.role === 'admin' ? <StudentManagement user={user} /> : <Navigate to="/unauthorized" replace />}
          />
          <Route
            path="/teachers"
            element={user && user.role === 'admin' ? <TeacherManagement user={user} /> : <Navigate to="/unauthorized" replace />}
          />
          <Route
            path="/classes"
            element={user && user.role === 'admin' ? <ClassManagement user={user} /> : <Navigate to="/unauthorized" replace />}
          />
          <Route
            path="/admin/upload-sections"
            element={user && user.role === 'admin' ? <AdminUploadSectionPdf user={user} /> : <Navigate to="/unauthorized" replace />}
          />
          <Route
            path="/admin/upload-timetable"
            element={user && user.role === 'admin' ? <AdminUploadTimetable user={user} /> : <Navigate to="/unauthorized" replace />}
          />
          <Route
            path="/admin/active-sessions"
            element={user && user.role === 'admin' ? <AdminActiveSessions user={user} /> : <Navigate to="/unauthorized" replace />}
          />
          <Route path="/settings" element={user ? <SystemSettings user={user} /> : <Navigate to="/login" replace />} />
        </Route>
      </Routes>
        </Router>
      )}
    </>
  );
}
