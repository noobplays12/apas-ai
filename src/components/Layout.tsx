import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  UserCheck, 
  History, 
  PlusCircle, 
  Users, 
  GraduationCap, 
  BookOpen, 
  Settings, 
  LogOut,
  Menu,
  X,
  FileText,
  Shield,
  Activity,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { UserProfile, Session } from '../types';
import { supabase } from '../supabaseClient';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { mapSessionRow } from '../lib/supabaseMappers';
import { studentActiveSessionsQuery } from '../lib/sessionScope';

interface LayoutProps {
  user: UserProfile;
}

export default function Layout({ user }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [teacherActiveCount, setTeacherActiveCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const fetchActive = async () => {
      if (user.role === 'teacher' && user.uid) {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('teacher_id', user.uid)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (cancelled) return;
        if (error) {
          console.error('Active session fetch error:', error);
          setActiveSession(null);
          setTeacherActiveCount(0);
          return;
        }
        const list = data ?? [];
        setTeacherActiveCount(list.length);
        setActiveSession(list[0] ? (mapSessionRow(list[0] as any) as Session) : null);
        return;
      }

      if (user.role === 'student') {
        setTeacherActiveCount(0);
        const q = studentActiveSessionsQuery(user);
        if (!q) {
          setActiveSession(null);
          return;
        }
        const { data, error } = await q;
        if (cancelled) return;
        if (error) {
          console.error('Active session fetch error:', error);
          setActiveSession(null);
          return;
        }
        setActiveSession(data && data[0] ? (mapSessionRow(data[0] as any) as Session) : null);
        return;
      }

      if (user.role === 'admin') {
        setTeacherActiveCount(0);
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);
        if (cancelled) return;
        if (error) {
          console.error('Active session fetch error:', error);
          setActiveSession(null);
          return;
        }
        setActiveSession(data && data[0] ? (mapSessionRow(data[0] as any) as Session) : null);
        return;
      }

      setTeacherActiveCount(0);
      setActiveSession(null);
    };

    fetchActive();

    // Realtime: listen for any session changes and refetch (simple + reliable).
    const channel = supabase
      .channel(`active-session-${user.uid}-${user.role}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        () => fetchActive()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user.uid, user.role, user.classId, user.semesterId, user.sectionId]);

  const handleLogout = async () => {
    localStorage.removeItem('mock_user');
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Supabase logout error:', e);
    }
    navigate('/login');
    window.location.reload(); // Ensure state is cleared
  };

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['student', 'teacher', 'admin'] },
    { name: 'Attendance', path: '/history', icon: UserCheck, roles: ['student'] },
    { name: 'Reports', path: '/reports', icon: FileText, roles: ['teacher', 'admin'] },
    { name: 'Settings', path: '/settings', icon: Settings, roles: ['admin', 'student', 'teacher'] },
    { name: 'Mark Attendance', path: '/mark-attendance', icon: UserCheck, roles: ['student'] },
    { name: 'Create Session', path: '/create-session', icon: PlusCircle, roles: ['teacher', 'admin'] },
    { name: 'Student Management', path: '/students', icon: GraduationCap, roles: ['admin'] },
    { name: 'Teacher Management', path: '/teachers', icon: Users, roles: ['admin'] },
    { name: 'Class Management', path: '/classes', icon: BookOpen, roles: ['admin'] },
    { name: 'Upload section PDF', path: '/admin/upload-sections', icon: Upload, roles: ['admin'] },
    { name: 'Upload timetable', path: '/admin/upload-timetable', icon: FileSpreadsheet, roles: ['admin'] },
    { name: 'Active sessions', path: '/admin/active-sessions', icon: Activity, roles: ['admin'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="flex h-screen bg-[#F8FAFF] font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden w-72 flex-col bg-white border-r border-gray-100 md:flex">
        <div className="flex h-24 items-center gap-4 px-8">
          <div className="rounded-xl bg-[#003399] p-2 text-white shadow-lg shadow-blue-900/20">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-[#003399] leading-tight">Academic Sentinel</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 leading-none">University Portal</p>
          </div>
        </div>
        
        <nav className="flex-1 space-y-1 px-6 py-8 overflow-y-auto">
          {filteredItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-4 rounded-xl px-5 py-4 text-sm font-bold transition-all duration-200",
                location.pathname === item.path
                  ? "bg-[#F0F4FF] text-[#003399]"
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              )}
            >
              <item.icon size={20} className={location.pathname === item.path ? "text-[#003399]" : "text-gray-400"} />
              {item.name}
            </Link>
          ))}

          {user.role === 'student' && activeSession && (
            <Link 
              to="/mark-attendance"
              className="mt-6 flex w-full items-center gap-4 rounded-2xl bg-green-50 p-4 text-green-700 shadow-sm border border-green-100 transition-all hover:bg-green-100"
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white shadow-lg shadow-green-200">
                <Activity size={20} />
                <span className="absolute -right-1 -top-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
                </span>
              </div>
              <div className="overflow-hidden">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Live Now</p>
                <p className="truncate text-sm font-black tracking-tight">{activeSession.subjectId}</p>
              </div>
            </Link>
          )}
        </nav>

        {(user.role === 'teacher' || user.role === 'admin') && (
          <div className="p-6 space-y-4">
            {activeSession && (
              <Link 
                to={`/live-attendance/${activeSession.id}`}
                className="flex w-full items-center gap-4 rounded-2xl bg-green-50 p-4 text-green-700 shadow-sm border border-green-100 transition-all hover:bg-green-100"
              >
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white shadow-lg shadow-green-200">
                  <Activity size={20} />
                  <span className="absolute -right-1 -top-1 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
                  </span>
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Live Session</p>
                  <p className="truncate text-sm font-black tracking-tight">{activeSession.subjectId}</p>
                  {user.role === 'teacher' && teacherActiveCount > 1 && (
                    <p className="text-[10px] font-bold text-green-800">{teacherActiveCount} concurrent</p>
                  )}
                </div>
              </Link>
            )}
            <Link 
              to="/create-session"
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#003399] py-4 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-[#002266] active:scale-[0.98]"
            >
              <PlusCircle size={18} />
              Start Session
            </Link>
          </div>
        )}

        <div className="border-t border-gray-50 p-6">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-4 rounded-xl px-5 py-3 text-sm font-bold text-red-500 transition-all hover:bg-red-50"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-20 items-center justify-between bg-white px-8 border-b border-gray-50">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden rounded-lg p-2 text-gray-400 hover:bg-gray-50"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-black text-[#003399] md:block hidden">
              {menuItems.find(i => i.path === location.pathname)?.name === 'Dashboard' ? 'Dashboard Overview' : (menuItems.find(i => i.path === location.pathname)?.name || 'Portal')}
            </h1>
            
            <div className="relative hidden lg:block">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
              <input 
                type="text" 
                className="block w-80 p-2.5 pl-10 text-sm text-gray-900 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="Search data..." 
              />
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <button className="relative rounded-full p-2 text-gray-400 hover:bg-gray-50">
              <div className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white"></div>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
              </svg>
            </button>
            
            <div className="flex items-center gap-3 border-l border-gray-100 pl-6">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-gray-900">{user.name}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {user.role === 'teacher' ? 'Senior Professor' : (user.role === 'admin' ? 'Administrator' : `ID: ${user.rollNo || user.uid.slice(0, 8)}`)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gray-200 overflow-hidden border-2 border-white shadow-sm">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt="avatar" />
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl md:hidden"
              >
                <div className="flex h-24 items-center gap-4 px-8 border-b border-gray-50">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-4">
                      <div className="rounded-xl bg-[#003399] p-2 text-white shadow-lg shadow-blue-900/20">
                        <Shield size={24} />
                      </div>
                      <div>
                        <h1 className="text-xl font-black tracking-tight text-[#003399]">Sentinel</h1>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 leading-none">University Portal</p>
                      </div>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400">
                      <X size={24} />
                    </button>
                  </div>
                </div>
                <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
                  {filteredItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-4 rounded-xl px-5 py-4 text-sm font-bold transition-all duration-200",
                        location.pathname === item.path
                          ? "bg-[#F0F4FF] text-[#003399]"
                          : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                      )}
                    >
                      <item.icon size={20} className={location.pathname === item.path ? "text-[#003399]" : "text-gray-400"} />
                      {item.name}
                    </Link>
                  ))}
                  
                  {activeSession && (
                    <Link 
                      to={`/live-attendance/${activeSession.id}`}
                      onClick={() => setIsSidebarOpen(false)}
                      className="mt-6 flex w-full items-center gap-4 rounded-2xl bg-green-50 p-4 text-green-700 shadow-sm border border-green-100"
                    >
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white">
                        <Activity size={20} />
                        <span className="absolute -right-1 -top-1 flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
                        </span>
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Live Session</p>
                        <p className="truncate text-sm font-black tracking-tight">{activeSession.subjectId}</p>
                      </div>
                    </Link>
                  )}
                </nav>
                <div className="border-t border-gray-50 p-6">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-4 rounded-xl px-5 py-3 text-sm font-bold text-red-500 transition-all hover:bg-red-50"
                  >
                    <LogOut size={20} />
                    Logout
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
