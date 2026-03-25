import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from './supabaseClient';
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
          if ((mockUser as any).role === 'student' && !(mockUser as any).classId) {
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

    const loadProfile = async (userId: string, email: string | null) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,name,email,role,roll_no,class_id,device_id,created_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        // Trigger should create this on signup; if it doesn't exist yet, treat as logged-out UX.
        setUser(null);
        return;
      }

      setUser({
        uid: data.id,
        name: data.name,
        email: data.email ?? email ?? '',
        role: data.role as any,
        rollNo: data.roll_no ?? undefined,
        classId: data.class_id ?? undefined,
        deviceId: data.device_id ?? undefined,
        createdAt: new Date(data.created_at).toISOString(),
      } as any);
    };

    let unsub: (() => void) | undefined;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        try {
          await loadProfile(data.session.user.id, data.session.user.email ?? null);
        } catch (e) {
          console.error('Supabase auth sync error:', e);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          setLoading(true);
          try {
            await loadProfile(session.user.id, session.user.email ?? null);
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
          <Route path="/settings" element={user ? <SystemSettings user={user} /> : <Navigate to="/login" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
