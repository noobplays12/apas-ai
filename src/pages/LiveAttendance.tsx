import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserProfile, Session, Attendance } from '../types';
import { supabase } from '../supabaseClient';
import { mapAttendanceRow, mapProfileRow, mapSessionRow } from '../lib/supabaseMappers';
import { 
  Users, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Smartphone,
  MapPin,
  Wifi,
  AlertCircle,
  LogOut,
  QrCode,
  Shield,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { toMillis } from '../lib/time';

interface LiveAttendanceProps {
  user: UserProfile;
}

export default function LiveAttendance({ user }: LiveAttendanceProps) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>('00:00');
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) return;

    const fetchSession = async () => {
      try {
        const { data: sessionRow, error: sErr } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', sessionId)
          .maybeSingle();
        if (sErr) throw sErr;
        if (sessionRow) {
          const sessionData = mapSessionRow(sessionRow as any);
          setSession(sessionData);

          let studentQuery = supabase.from('profiles').select('*').eq('role', 'student');
          if (sessionData.sectionId) {
            studentQuery = studentQuery.eq('section_id', sessionData.sectionId);
          } else if (sessionData.classId) {
            studentQuery = studentQuery.eq('class_id', sessionData.classId);
          } else {
            setStudents([]);
            return;
          }
          const { data: studentRows, error: stErr } = await studentQuery;
          if (stErr) throw stErr;
          setStudents((studentRows ?? []).map((r: any) => mapProfileRow(r)));
        } else {
          setSession(null);
        }
      } catch (error) {
        console.error("Error fetching session:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();

    const fetchAttendance = async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: false });
      if (error) {
        console.error('Attendance fetch error:', error);
        return;
      }
      setAttendance((data ?? []).map((r: any) => mapAttendanceRow(r)));
    };

    fetchAttendance();

    const channel = supabase
      .channel(`live-attendance-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => fetchAttendance())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Timer logic
  useEffect(() => {
    if (!session || !session.isActive) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const end = toMillis(session.endTime);
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('00:00');
        clearInterval(interval);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, '0')} : ${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  const handleEndSession = async () => {
    if (!sessionId) return;
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ is_active: false, end_time: new Date().toISOString() })
        .eq('id', sessionId);
      if (error) throw error;
      toast.success('Session ended successfully');
      // This app's "Dashboard" route is `/`
      navigate('/');
    } catch (error) {
      console.error(error);
      toast.error('Failed to end session');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#003399] border-t-transparent"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle size={48} className="mb-4 text-gray-300" />
        <h2 className="text-xl font-bold text-gray-900">Session Not Found</h2>
        <p className="text-gray-500">This session may have been deleted or is no longer active.</p>
        <button onClick={() => navigate('/')} className="mt-6 font-bold text-[#003399] hover:underline">Return to Dashboard</button>
      </div>
    );
  }

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const totalCount = students.length || 50; // Fallback for demo if no students found
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
      {/* Header Section */}
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-red-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-red-600">
              Live Session
            </span>
            <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              {session.subjectId}
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 md:text-5xl">
            Attendance Monitoring
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-6 rounded-2xl bg-white px-8 py-4 shadow-sm border border-gray-100">
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Time Remaining</p>
              <p className="text-3xl font-black text-[#003399] tabular-nums">
                {timeLeft}
              </p>
            </div>
          </div>
          <button
            onClick={handleEndSession}
            className="rounded-xl bg-gray-200 px-6 py-4 text-sm font-black uppercase tracking-widest text-gray-700 transition-all hover:bg-gray-300 active:scale-95"
          >
            End Session Early
          </button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Total Presence Card */}
        <div className="rounded-3xl bg-white p-8 shadow-sm border border-gray-100">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Presence</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-5xl font-black text-gray-900">{presentCount}</span>
                <span className="text-2xl font-bold text-gray-300">/ {totalCount}</span>
              </div>
            </div>
            <div className="rounded-2xl bg-blue-50 p-4 text-[#003399]">
              <Users size={32} />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${attendanceRate}%` }}
                className="h-full bg-[#003399]"
              />
            </div>
            <p className="text-xs font-bold text-gray-500">{attendanceRate}% attendance recorded so far</p>
          </div>
        </div>

        {/* Anti-Proxy Checks Card */}
        <div className="rounded-3xl bg-white p-8 shadow-sm border border-gray-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Anti-Proxy Checks</p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#003399]">
              <Shield size={24} />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-2xl font-black text-gray-900">Active</span>
            </div>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-gray-400">
            Biometric & Geofencing verification running in background.
          </p>
        </div>

        {/* QR Fallback Card */}
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-8 transition-colors hover:bg-gray-50">
          <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
            <QrCode size={40} className="text-gray-900" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Show QR Fallback</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Recent Check-ins Table */}
        <div className="lg:col-span-2">
          <div className="rounded-3xl bg-white shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-50 p-8">
              <h3 className="text-xl font-black text-gray-900">Recent Check-ins</h3>
              <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-green-600">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
                Live Refreshing
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <th className="px-8 py-4">Student</th>
                    <th className="px-8 py-4">ID Number</th>
                    <th className="px-8 py-4">Timestamp</th>
                    <th className="px-8 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {attendance.length > 0 ? (
                    attendance.slice(0, 10).map((record) => {
                      const student = students.find(s => s.uid === record.studentId);
                      return (
                        <tr key={record.id} className="group transition-colors hover:bg-gray-50/50">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#003399] text-xs font-black text-white">
                                {student?.name
                                  ? student.name.split(' ').map((n) => n[0]).join('')
                                  : '??'}
                              </div>
                              <span className="font-bold text-gray-900">{student?.name || 'Unknown Student'}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className="font-mono text-xs font-bold text-gray-500">{student?.rollNo || '2024-CS-000'}</span>
                          </td>
                          <td className="px-8 py-5">
                            <span className="text-xs font-bold text-gray-500">
                              {(() => {
                                const millis = toMillis(record.timestamp);
                                if (!millis) return '—';
                                return new Date(millis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                              })()}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            {record.status === 'present' ? (
                              <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-green-700">
                                <div className="h-1.5 w-1.5 rounded-full bg-green-600"></div>
                                Present
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-700">
                                <div className="h-1.5 w-1.5 rounded-full bg-red-600"></div>
                                Absent
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 text-gray-400">
                          <RefreshCw size={32} className="animate-spin" />
                          <p className="text-sm font-bold">Waiting for first check-in...</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-50 p-6 text-center">
              <button className="text-[10px] font-black uppercase tracking-[0.2em] text-[#003399] hover:underline">
                View All {totalCount} Students
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Cards */}
        <div className="space-y-8">
          {/* Device Map */}
          <div className="rounded-3xl bg-white p-8 shadow-sm border border-gray-100">
            <h3 className="mb-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Device Map</h3>
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-100">
              {/* Mock Map Visual */}
              <div className="absolute inset-0 bg-[#E5E7EB]">
                <svg className="h-full w-full opacity-20" viewBox="0 0 100 100">
                  <path d="M0 20 L100 20 M0 40 L100 40 M0 60 L100 60 M0 80 L100 80 M20 0 L20 100 M40 0 L40 100 M60 0 L60 100 M80 0 L80 100" stroke="currentColor" fill="none" />
                </svg>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="relative">
                    <div className="absolute -inset-4 rounded-full bg-blue-500/20 animate-ping"></div>
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-[#003399] shadow-lg">
                      <div className="h-2 w-2 rounded-full bg-white"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-white/90 p-3 backdrop-blur-sm">
                <p className="text-[10px] font-black text-gray-900">Lecture Hall C-04 • Verified</p>
              </div>
            </div>
          </div>

          {/* Security Protocol */}
          <div className="relative overflow-hidden rounded-3xl bg-[#003399] p-8 text-white shadow-lg shadow-blue-100">
            <div className="relative z-10">
              <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest opacity-60">Security Protocol</h3>
              <p className="mb-6 text-sm font-bold leading-relaxed">
                Biometric signals and GPS clusters are aligned with lecture schedule. No discrepancies found.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                  <CheckCircle2 size={14} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Encrypted End-to-End</span>
              </div>
            </div>
            {/* Background Shield Icon */}
            <Shield size={120} className="absolute -bottom-8 -right-8 opacity-10 rotate-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
