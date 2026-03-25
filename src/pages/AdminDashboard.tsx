import { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../supabaseClient';
import { mapSessionRow } from '../lib/supabaseMappers';
import {
  Users,
  GraduationCap,
  BookOpen,
  Settings,
  Activity,
  ChevronRight,
  Upload,
  FileSpreadsheet,
  LayoutDashboard,
  AlertTriangle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Session } from '../types';
import { useHasRealSupabaseSession } from '../lib/useSupabaseSessionRequired';

interface AdminDashboardProps {
  user: UserProfile;
}

export default function AdminDashboard({ user: _user }: AdminDashboardProps) {
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    classes: 0,
    activeSessions: 0,
  });
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const hasRealSession = useHasRealSupabaseSession();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [stRes, teRes, clRes, sessRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
          supabase.from('classes').select('id', { count: 'exact', head: true }),
          supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('is_active', true),
        ]);

        setStats({
          students: stRes.count ?? 0,
          teachers: teRes.count ?? 0,
          classes: clRes.count ?? 0,
          activeSessions: sessRes.count ?? 0,
        });

        const { data: live } = await supabase
          .from('sessions')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);
        setActiveSession(live?.[0] ? mapSessionRow(live[0] as any) : null);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: 'Students', value: loading ? '…' : stats.students, icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Teachers', value: loading ? '…' : stats.teachers, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Classes (legacy)', value: loading ? '…' : stats.classes, icon: BookOpen, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Live sessions', value: loading ? '…' : stats.activeSessions, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const importLinks = [
    {
      title: 'Upload section roster (PDF)',
      desc: 'Paste student lists from attendance sheets (e.g. Roll No + Name).',
      path: '/admin/upload-sections',
      icon: Upload,
      color: 'bg-[#003399]',
    },
    {
      title: 'Upload timetable (Excel)',
      desc: 'Course codes, teacher, day, times — powers teacher “Today’s schedule”.',
      path: '/admin/upload-timetable',
      icon: FileSpreadsheet,
      color: 'bg-emerald-600',
    },
    {
      title: 'Monitor active sessions',
      desc: 'Filter by semester/section and open live attendance.',
      path: '/admin/active-sessions',
      icon: LayoutDashboard,
      color: 'bg-violet-600',
    },
  ];

  return (
    <div className="space-y-10 pb-12 font-sans">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#003399]">System Administration</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-900">Admin overview</h1>
          <p className="mt-3 text-lg font-medium text-gray-500">
            {stats.activeSessions > 0
              ? `${stats.activeSessions} active session(s) running.`
              : 'No active sessions right now.'}
          </p>
        </div>
        <Link
          to="/settings"
          className="flex items-center justify-center gap-3 rounded-xl border border-gray-100 bg-white px-8 py-4 text-lg font-bold text-gray-900 shadow-sm transition-all hover:bg-gray-50"
        >
          <Settings size={24} />
          Settings
        </Link>
      </div>

      {hasRealSession === false && (
        <div className="flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <AlertTriangle className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-black">You are using Dev bypass (local test login)</p>
            <p className="mt-1 text-sm font-medium text-amber-900/90">
              PDF and Excel imports call <strong>server APIs</strong> that need a real Supabase session. Sign out and log in
              with your <strong>admin email and password</strong> (e.g. your registered admin account) to use uploads.
            </p>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-gray-400">Imports & departmental data</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {importLinks.map((item, i) => (
            <motion.div key={item.path} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link
                to={item.path}
                className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-[#003399]/30 hover:shadow-md"
              >
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${item.color} text-white`}>
                  <item.icon size={24} />
                </div>
                <p className="text-lg font-black text-gray-900">{item.title}</p>
                <p className="mt-2 flex-1 text-sm font-medium text-gray-500">{item.desc}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#003399]">
                  Open
                  <ChevronRight size={18} />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {activeSession && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-indigo-600 p-8 text-white shadow-xl"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Activity size={36} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Live</p>
                <p className="text-xl font-black">Session active</p>
                <p className="text-sm font-bold text-indigo-100 opacity-90">Subject: {activeSession.subjectId}</p>
              </div>
            </div>
            <Link
              to={`/live-attendance/${activeSession.id}`}
              className="rounded-2xl bg-white px-8 py-4 text-center font-black text-indigo-600 shadow-lg transition-transform hover:scale-[1.02]"
            >
              Open live attendance
            </Link>
          </div>
        </motion.div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-3xl border border-gray-50 bg-white p-6 shadow-sm"
          >
            <div className={`mb-4 inline-flex rounded-2xl ${stat.bg} p-3 ${stat.color}`}>
              <stat.icon size={22} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{stat.label}</p>
            <p className="mt-1 text-3xl font-black text-gray-900">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
        <h3 className="mb-6 text-xs font-black uppercase tracking-widest text-gray-400">Quick links</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Students', path: '/students' },
            { label: 'Teachers', path: '/teachers' },
            { label: 'Classes', path: '/classes' },
            { label: 'Settings', path: '/settings' },
          ].map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center justify-between rounded-2xl border border-gray-50 px-6 py-4 font-bold text-gray-800 transition-all hover:bg-gray-50"
            >
              {item.label}
              <ChevronRight size={18} className="text-gray-300" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
