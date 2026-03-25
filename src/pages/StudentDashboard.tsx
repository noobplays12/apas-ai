import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, Attendance, Session } from '../types';
import { mapAttendanceRow, mapSessionRow } from '../lib/supabaseMappers';
import { 
  UserCheck, 
  Clock, 
  Calendar, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck,
  Smartphone,
  QrCode,
  MapPin,
  User,
  CheckCircle2,
  MoreHorizontal,
  ChevronRight,
  Bookmark,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { studentActiveSessionsQuery } from '../lib/sessionScope';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip,
  CartesianGrid
} from 'recharts';

interface StudentDashboardProps {
  user: UserProfile;
}

export default function StudentDashboard({ user }: StudentDashboardProps) {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMarkedActiveSession, setHasMarkedActiveSession] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user.uid) return;
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', user.uid)
          .order('timestamp', { ascending: false })
          .limit(10);

        if (error) throw error;
        setAttendance((data ?? []).map((r: any) => mapAttendanceRow(r)));
      } catch (e: any) {
        console.error('Error fetching student data:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user.uid, user.classId, user.semesterId, user.sectionId]);

  // Real-time listener for the active session for this student's class.
  // This makes the "teacher creates a session → student logs in and sees it live" flow reliable.
  useEffect(() => {
    const q = studentActiveSessionsQuery(user);
    if (!q) {
      setActiveSession(null);
      return;
    }

    let cancelled = false;

    const fetchActive = async () => {
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        console.error('Active session fetch error:', error);
        setActiveSession(null);
        return;
      }
      setActiveSession(data && data[0] ? mapSessionRow(data[0] as any) : null);
    };

    fetchActive();

    const channel = supabase
      .channel(`student-active-session-${user.uid}`)
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
  }, [user.classId, user.semesterId, user.sectionId]);

  // Real-time listener to know if THIS student already marked attendance
  // for the currently active session.
  useEffect(() => {
    if (!user.uid || !activeSession?.id) {
      setHasMarkedActiveSession(false);
      return;
    }

    let cancelled = false;

    const fetchMarked = async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('id')
        .eq('student_id', user.uid)
        .eq('session_id', activeSession.id)
        .limit(1);
      if (cancelled) return;
      if (error) {
        console.error('Marked attendance fetch error:', error);
        setHasMarkedActiveSession(false);
        return;
      }
      setHasMarkedActiveSession(Boolean(data && data.length > 0));
    };

    fetchMarked();

    const channel = supabase
      .channel(`student-marked-${user.uid}-${activeSession.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => fetchMarked()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user.uid, activeSession?.id]);

  const weeklyData = [
    { day: 'MON', present: 4, absent: 1 },
    { day: 'TUE', present: 5, absent: 0 },
    { day: 'WED', present: 3, absent: 2 },
    { day: 'THU', present: 4, absent: 1 },
    { day: 'FRI', present: 5, absent: 0 },
  ];

  const schedule = [
    { 
      time: '08:30 AM', 
      subject: 'Digital Logic & Design', 
      instructor: 'Prof. Alan Turing', 
      location: 'Lab 2', 
      status: 'PRESENT' 
    },
    { 
      time: '10:00 AM', 
      subject: 'Computer Networking', 
      instructor: 'Prof. Sarah Miller', 
      location: 'Hall 402', 
      status: 'STARTING SOON' 
    },
    { 
      time: '01:30 PM', 
      subject: 'Operating Systems', 
      instructor: 'Prof. Linus T.', 
      location: 'Lecture Hall A', 
      status: 'UPCOMING' 
    },
  ];

  const hasClassScope = Boolean(user.classId || (user.semesterId && user.sectionId));

  return (
    <div className="space-y-10 pb-12 font-sans">
      {/* Greeting Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#003399]">
            Academic Year 2024 • Semester II
          </p>
          <h1 className="mt-2 text-5xl font-black tracking-tight text-gray-900">
            Welcome back, {user.name.split(' ')[0]}.
          </h1>
          {!hasClassScope ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-orange-50 p-4 text-orange-700 border border-orange-100">
              <AlertCircle size={20} />
              <p className="text-sm font-bold">
                No class or section assigned. Please contact your administrator.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-lg font-medium text-gray-500">
              Your attendance is looking stable. You have one class starting in 15 minutes.
            </p>
          )}
        </div>
        {hasClassScope && (
          !hasMarkedActiveSession && activeSession && (
            <Link
              to="/mark-attendance"
              className="flex items-center justify-center gap-3 rounded-xl bg-[#003399] px-8 py-5 text-lg font-bold text-white shadow-xl shadow-blue-900/20 transition-all hover:bg-[#002266] active:scale-95"
            >
              <QrCode size={24} />
              Mark Attendance Now
            </Link>
          )
        )}
      </div>

      {/* Top Row Cards */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Overall Attendance Card */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white p-10 shadow-sm border border-gray-50 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Overall Attendance</p>
              <p className="mt-1 text-xs font-bold text-gray-400">Target: 75% for exam eligibility</p>
            </div>
            <span className="rounded-full bg-blue-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#003399]">
              Good Standing
            </span>
          </div>

          <div className="mt-8 flex items-baseline gap-4">
            <span className="text-[100px] font-black leading-none tracking-tighter text-gray-900">85.4<span className="text-5xl text-gray-300">%</span></span>
            <div className="flex items-center gap-1 text-lg font-black text-green-500">
              <TrendingUp size={20} />
              ~2.1%
            </div>
          </div>

          <div className="mt-10">
            <div className="mb-3 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-gray-400">
              <span>Progression</span>
              <span className="text-gray-900">128 / 150 Classes</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100">
              <div className="h-full w-[85.4%] rounded-full bg-[#003399]"></div>
            </div>
          </div>
        </div>

        {/* Active/Next Session Card */}
        <div className={cn(
          "flex flex-col justify-between rounded-[2.5rem] p-10 text-white shadow-xl transition-all",
          activeSession ? "bg-green-600 shadow-green-900/20" : "bg-[#003399] shadow-blue-900/20"
        )}>
          <div>
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur-md">
                <Clock size={24} />
              </div>
              <span className="rounded-lg bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                {activeSession ? "Live Now" : "Next Session"}
              </span>
            </div>
            <p className="mt-8 text-sm font-bold text-blue-100/80">
              {activeSession ? "Attendance is Open" : "Starts in 15 mins"}
            </p>
            <h3 className="mt-2 text-3xl font-black leading-tight tracking-tight">
              {activeSession ? `${activeSession.subjectId}` : "CS101: Computer Networking"}
            </h3>
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-sm font-bold text-blue-100/80">
                <MapPin size={18} className="text-blue-300" />
                Engineering Block, Room 402
              </div>
              <div className="flex items-center gap-3 text-sm font-bold text-blue-100/80">
                <User size={18} className="text-blue-300" />
                {activeSession ? "Prof. Smith" : "Prof. Sarah Miller"}
              </div>
            </div>
          </div>
          {activeSession ? (
            hasMarkedActiveSession ? (
              <div className="mt-10 w-full rounded-xl bg-white/20 py-4 text-center text-sm font-black text-white/90">
                Attendance already marked
              </div>
            ) : (
              <Link 
                to="/mark-attendance"
                className="mt-10 w-full rounded-xl bg-white py-4 text-center text-sm font-black text-green-600 transition-all hover:bg-green-50 active:scale-[0.98]"
              >
                Mark Attendance Now
              </Link>
            )
          ) : (
            <button className="mt-10 w-full rounded-xl bg-white py-4 text-sm font-black text-[#003399] transition-all hover:bg-blue-50 active:scale-[0.98]">
              View Course Details
            </button>
          )}
        </div>
      </div>

      {/* Middle Row */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Weekly Trend Chart */}
        <div className="rounded-[2.5rem] bg-white p-10 shadow-sm border border-gray-50 lg:col-span-2">
          <div className="mb-10 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Weekly Attendance Trend</h3>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#003399]"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Present</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-gray-200"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Absent</span>
              </div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} barGap={8}>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#F9FAFB" />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 900 }} 
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', fontWeight: 800 }}
                />
                <Bar dataKey="present" fill="#003399" radius={[4, 4, 4, 4]} barSize={12} />
                <Bar dataKey="absent" fill="#E5E7EB" radius={[4, 4, 4, 4]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Stats Column */}
        <div className="space-y-6">
          {[
            { label: 'Total Sessions', value: '150', icon: Bookmark, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Present Days', value: '128', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Absent / Leaves', value: '22', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center justify-between rounded-[2rem] bg-white p-8 shadow-sm border border-gray-50">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{stat.label}</p>
                <p className="mt-1 text-4xl font-black text-gray-900">{stat.value}</p>
              </div>
              <div className={`rounded-xl ${stat.bg} p-4 ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Section - Schedule */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-black text-gray-900 tracking-tight">Today's Academic Schedule</h3>
          <button className="flex items-center gap-2 text-sm font-black text-[#003399] hover:underline">
            Full Calendar
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-sm border border-gray-50">
          {schedule.map((item, i) => (
            <div 
              key={i} 
              className={`flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:justify-between ${
                i !== schedule.length - 1 ? 'border-b border-gray-50' : ''
              } ${item.status === 'STARTING SOON' ? 'bg-blue-50/30' : ''}`}
            >
              <div className="flex items-center gap-8">
                <div className="w-20 text-center">
                  <p className="text-sm font-black text-gray-900">{item.time.split(' ')[0]}</p>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.time.split(' ')[1]}</p>
                </div>
                <div className="h-10 w-1 border-l-4 border-[#003399]/20 rounded-full"></div>
                <div>
                  <h4 className="text-xl font-black text-gray-900 tracking-tight">{item.subject}</h4>
                  <p className="text-sm font-bold text-gray-400">{item.instructor} • {item.location}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {item.status === 'PRESENT' && (
                  <>
                    <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-[10px] font-black tracking-widest text-gray-400">PRESENT</span>
                    <CheckCircle2 className="text-green-500" size={24} />
                  </>
                )}
                {item.status === 'STARTING SOON' && (
                  <>
                    <span className="rounded-lg bg-[#003399] px-3 py-1.5 text-[10px] font-black tracking-widest text-white">STARTING SOON</span>
                    <QrCode className="text-[#003399]" size={24} />
                  </>
                )}
                {item.status === 'UPCOMING' && (
                  <span className="text-[10px] font-black tracking-[0.2em] text-gray-400 italic">UPCOMING</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
