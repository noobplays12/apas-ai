import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import { roleFromEmail } from './roleFromEmail';
import { UserProfile } from './types';
import { Toaster } from 'sonner';

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

const SESSION_TIMEOUT_MS = 15_000;
const PROFILE_LOAD_TIMEOUT_MS = 20_000;

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
      // Use * so older DBs without departmental columns still return a row (explicit columns 404 if missing).
      let { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

      if (error) throw error;

      if (!data) {
        const { error: rpcErr } = await supabase.rpc('ensure_my_profile');
        if (!rpcErr) {
          const res = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
          if (res.error) throw res.error;
          data = res.data;
        }
      }

      if (!data) {
        const { data: uu, error: uErr } = await supabase.auth.getUser();
        if (uErr || !uu.user?.email) {
          console.error('Profile bootstrap: no verified user email', uErr);
          setUser(null);
          return;
        }
        const au = uu.user;
        const displayName =
          typeof au.user_metadata?.name === 'string' && au.user_metadata.name.trim()
            ? au.user_metadata.name.trim()
            : au.email.split('@')[0];
        const { error: insErr } = await supabase.from('profiles').insert({
          id: userId,
          name: displayName,
          email: au.email,
          role: roleFromEmail(au.email),
        });
        if (insErr) {
          if (insErr.code === '23505') {
            const res = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
            if (res.error) throw res.error;
            data = res.data;
          } else {
            console.error('Profile insert failed (run migration 0004 profiles_insert_own + 0003 RPC):', insErr);
            setUser(null);
            return;
          }
        } else {
          const res = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
          if (res.error) throw res.error;
          data = res.data;
        }
      }

      if (!data) {
        setUser(null);
        return;
      }

      applyProfileRow(data as Record<string, unknown>, email);
    };

    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS, 'getSession');
        if (data.session?.user) {
          try {
            await withTimeout(
              loadProfile(data.session.user.id, data.session.user.email ?? null),
              PROFILE_LOAD_TIMEOUT_MS,
              'loadProfile'
            );
          } catch (e) {
            console.error('Supabase auth sync error:', e);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (e) {
        console.error('Supabase init error:', e);
        setUser(null);
      } finally {
        setLoading(false);
      }

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        // Callback may pass null while a session still exists (e.g. INITIAL_SESSION after a storage
        // read error in GoTrueClient._emitInitialSession). Re-read from the client before clearing.
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
            setLoading(false);
            return;
          }
        }

        if (s?.user) {
          setLoading(true);
          try {
            await withTimeout(
              loadProfile(s.user.id, s.user.email ?? null),
              PROFILE_LOAD_TIMEOUT_MS,
              'loadProfile'
            );
          } catch (e) {
            console.error('Supabase auth sync error:', e);
            setUser(null);
          } finally {
            setLoading(false);
          }
        } else {
          setUser(null);
          setLoading(false);
        }
      });
      unsub = () => sub.subscription.unsubscribe();
    })();

    return () => {
      if (unsub) unsub();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFF]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#0A66FF] border-t-transparent"></div>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return <MissingSupabaseEnv />;
  }

  return (
    <Router>
      <Toaster position="top-right" richColors />
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
  );
}
