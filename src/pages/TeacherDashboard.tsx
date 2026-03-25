import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { UserProfile, Session } from '../types';
import { mapSessionRow } from '../lib/supabaseMappers';
import {
  PlusCircle,
  Users,
  Clock,
  BookOpen,
  Calendar,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface TeacherDashboardProps {
  user: UserProfile;
}

type Slot = {
  id: string;
  subject_id: string;
  start_time: string;
  end_time: string;
  semester_id: string;
  section_id: string;
  semesters?: { name: string } | { name: string }[] | null;
  sections?: { section_name: string } | { section_name: string }[] | null;
};

function relOne<T>(v: T | T[] | null | undefined): T | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default function TeacherDashboard({ user }: TeacherDashboardProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [todaySlots, setTodaySlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!user.uid) return;
      try {
        const { data: hist } = await supabase
          .from('sessions')
          .select('*')
          .eq('teacher_id', user.uid)
          .order('created_at', { ascending: false })
          .limit(15);
        setSessions((hist ?? []).map((r: any) => mapSessionRow(r)));

        const { data: active } = await supabase
          .from('sessions')
          .select('*')
          .eq('teacher_id', user.uid)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        setActiveSessions((active ?? []).map((r: any) => mapSessionRow(r)));

        const dow = new Date().getDay();
        const { data: slots } = await supabase
          .from('timetable_slots')
          .select(
            `
            id,
            subject_id,
            start_time,
            end_time,
            semester_id,
            section_id,
            semesters ( name ),
            sections ( section_name )
          `
          )
          .eq('teacher_id', user.uid)
          .eq('day_of_week', dow)
          .order('start_time', { ascending: true });
        setTodaySlots((slots ?? []) as unknown as Slot[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user.uid]);

  const startHref = (slot: Slot) =>
    `/create-session?semesterId=${encodeURIComponent(slot.semester_id)}&sectionId=${encodeURIComponent(
      slot.section_id
    )}&subjectId=${encodeURIComponent(slot.subject_id)}`;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#003399] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 font-sans">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900">Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="mt-2 text-lg font-medium text-gray-500">
            {activeSessions.length > 0
              ? `${activeSessions.length} active session(s) — multi-class mode enabled.`
              : 'No active sessions right now.'}
          </p>
        </div>
        <Link
          to="/create-session"
          className="flex items-center justify-center gap-3 rounded-xl bg-[#003399] px-6 py-4 text-sm font-bold text-white shadow-xl shadow-blue-900/20 transition-all hover:bg-[#002266] active:scale-95"
        >
          <PlusCircle size={20} />
          Start new session
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Active now</p>
          <p className="mt-2 text-4xl font-black text-gray-900">{activeSessions.length}</p>
          <Activity className="mt-4 text-green-600" size={24} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Today&apos;s slots</p>
          <p className="mt-2 text-4xl font-black text-gray-900">{todaySlots.length}</p>
          <Calendar className="mt-4 text-blue-600" size={24} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Recent sessions</p>
          <p className="mt-2 text-4xl font-black text-gray-900">{sessions.length}</p>
          <BookOpen className="mt-4 text-indigo-600" size={24} />
        </motion.div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Today&apos;s schedule</h2>
            <span className="text-xs font-bold text-gray-400">From timetable import</span>
          </div>
          {todaySlots.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-gray-500 font-bold">
              No timetable rows for today. Admin can upload an Excel timetable (teacher_email, subject_id, semester_name,
              section_name, day_of_week, start_time, end_time).
            </div>
          ) : (
            <div className="space-y-3">
              {todaySlots.map((slot, i) => (
                <motion.div
                  key={slot.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex flex-wrap items-center gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"
                >
                  <div className="flex min-w-[120px] flex-col border-r border-gray-100 pr-4">
                    <Clock size={18} className="text-[#003399] mb-1" />
                    <span className="text-sm font-black text-gray-900">
                      {String(slot.start_time).slice(0, 5)} – {String(slot.end_time).slice(0, 5)}
                    </span>
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <p className="font-black text-gray-900">{slot.subject_id}</p>
                    <p className="text-sm font-bold text-gray-500">
                      {(relOne(slot.semesters) as { name?: string } | undefined)?.name ?? 'Semester'} • Section{' '}
                      {(relOne(slot.sections) as { section_name?: string } | undefined)?.section_name ?? '?'}
                    </p>
                  </div>
                  <Link
                    to={startHref(slot)}
                    className={cn(
                      'rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg',
                      'bg-[#003399] hover:bg-[#002266]'
                    )}
                  >
                    Start session
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[2rem] bg-[#151619] p-8 text-white">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Active sessions</h3>
          <div className="space-y-4">
            {activeSessions.length === 0 ? (
              <p className="text-sm text-gray-500">None</p>
            ) : (
              activeSessions.map((s) => (
                <Link
                  key={s.id}
                  to={`/live-attendance/${s.id}`}
                  className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold hover:bg-white/10"
                >
                  <span className="truncate">{s.subjectId}</span>
                  <ChevronRight size={16} />
                </Link>
              ))
            )}
          </div>
          <Link
            to="/create-session"
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-4 text-xs font-black uppercase tracking-widest hover:bg-white/5"
          >
            <Users size={16} />
            Manual session
          </Link>
        </div>
      </div>
    </div>
  );
}
