import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Session } from '../types';
import { 
  PlusCircle, 
  Users, 
  Clock, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck,
  BookOpen,
  Calendar,
  ChevronRight,
  MoreHorizontal,
  CheckCircle2,
  Activity,
  UserPlus,
  FileText,
  AlertTriangle,
  Bell,
  Search,
  ExternalLink,
  ShieldAlert,
  Smartphone,
  Globe
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface TeacherDashboardProps {
  user: UserProfile;
}

export default function TeacherDashboard({ user }: TeacherDashboardProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!user.uid) return;
      try {
        const q = query(
          collection(db, 'sessions'),
          where('teacherId', '==', user.uid),
          orderBy('startTime', 'desc'),
          limit(10)
        );
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
        setSessions(data);
        
        // Find active session
        const active = data.find(s => s.isActive);
        setActiveSession(active || null);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [user.uid]);

  const stats = [
    { label: 'ACTIVE CLASSES', value: '3', sub: '+1 today', detail: 'Scheduled for Wednesday', icon: BookOpen, color: 'text-blue-600' },
    { label: 'TOTAL STUDENTS', value: '256', sub: 'across 5 courses', detail: '92% verified devices', icon: Users, color: 'text-indigo-600' },
    { label: 'AVG. ATTENDANCE %', value: '94.8%', sub: '↑ 2.4%', detail: 'Progress bar', icon: TrendingUp, color: 'text-green-600', progress: 94.8 },
    { label: 'SECURITY ALERTS', value: '2', sub: 'Requires attention', detail: 'Review logs', icon: ShieldAlert, color: 'text-red-600', link: '/settings' },
  ];

  const schedule = [
    { 
      time: '09:00 - 10:30', 
      title: 'Advanced Algorithm Analysis', 
      code: 'CS402', 
      room: 'Room 402B (Engineering Block)', 
      attendance: '45/48 Students Present',
      live: true,
      avatars: ['https://i.pravatar.cc/150?u=1', 'https://i.pravatar.cc/150?u=2', 'https://i.pravatar.cc/150?u=3']
    },
    { 
      time: '11:00 - 12:30', 
      title: 'Discrete Mathematics', 
      code: 'MA201', 
      room: 'Lecture Hall C (Main Plaza)', 
      attendance: '124 STUDENTS ENROLLED',
      live: false
    },
    { 
      time: '14:00 - 15:30', 
      title: 'Software Architecture', 
      code: 'CS501', 
      room: 'Virtual Room (Online)', 
      attendance: '88 STUDENTS ENROLLED',
      live: false
    }
  ];

  const monitoring = [
    { 
      type: 'New Device Request', 
      time: '2m ago', 
      desc: 'James Wilson (ID: 2401) attempting to register iPhone 15 Pro.',
      icon: Smartphone,
      color: 'text-orange-500'
    },
    { 
      type: 'Proxy Warning', 
      time: '1h ago', 
      desc: 'VPN usage detected during MA201 for Marcus K. Location: Frankfurt, DE.',
      icon: Globe,
      color: 'text-red-500'
    }
  ];

  const activity = [
    { title: 'Attendance Finalized', desc: 'CS302 Weekly Report generated and sent to Admin.', time: 'Today, 08:45 AM', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
    { title: 'Schedule Updated', desc: 'Added office hours for Friday, 15:00 - 17:00.', time: 'Yesterday, 04:12 PM', icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-50' }
  ];

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Welcome Header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900">
            Welcome back, {user.name.split(' ')[0]}
          </h1>
          <p className="mt-2 text-lg font-medium text-gray-500">
            Here's what's happening across your classes today.
          </p>
        </div>
        <Link
          to="/create-session"
          className="flex items-center justify-center gap-3 rounded-xl bg-[#003399] px-6 py-4 text-sm font-bold text-white shadow-xl shadow-blue-900/20 transition-all hover:bg-[#002266] active:scale-95"
        >
          <PlusCircle size={20} />
          Start New Session
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{stat.label}</p>
                {stat.link && (
                  <Link to={stat.link} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:underline">
                    {stat.detail}
                  </Link>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-gray-900">{stat.value}</p>
                <p className={cn("text-xs font-bold", stat.color)}>{stat.sub}</p>
              </div>
            </div>
            
            <div className="mt-4">
              {stat.progress ? (
                <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${stat.progress}%` }}></div>
                </div>
              ) : !stat.link && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {stat.label === 'ACTIVE CLASSES' ? <Calendar size={12} /> : <Users size={12} />}
                  {stat.detail}
                </div>
              )}
              {stat.label === 'SECURITY ALERTS' && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-red-500 uppercase tracking-wider">
                  <AlertTriangle size={12} />
                  Requires attention
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Today's Schedule */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Today's Schedule</h2>
            <button className="text-sm font-black text-[#003399] hover:underline">Full Calendar</button>
          </div>

          <div className="space-y-4">
            {schedule.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={cn(
                  "relative flex items-center gap-6 rounded-3xl bg-white p-6 shadow-sm border border-gray-100 transition-all hover:shadow-md",
                  item.live && "border-l-4 border-l-blue-600"
                )}
              >
                <div className="flex flex-col items-center justify-center border-r border-gray-100 pr-6 min-w-[100px]">
                  <p className="text-sm font-black text-blue-600">{item.time.split(' - ')[0]}</p>
                  <p className="text-sm font-bold text-gray-400">{item.time.split(' - ')[1]}</p>
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-black text-gray-900">{item.title}</h3>
                    {item.live && (
                      <span className="rounded-lg bg-blue-600 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white">
                        LIVE NOW
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-gray-500">
                    {item.code} • {item.room}
                  </p>
                  <div className="mt-3 flex items-center gap-4">
                    {item.avatars && (
                      <div className="flex -space-x-2">
                        {item.avatars.map((url, idx) => (
                          <img key={idx} src={url} className="h-6 w-6 rounded-full border-2 border-white" alt="student" />
                        ))}
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[8px] font-black text-gray-400">+45</div>
                      </div>
                    )}
                    <p className="text-xs font-black text-blue-600 uppercase tracking-wider">{item.attendance}</p>
                  </div>
                </div>

                <div className="pl-4">
                  {item.live ? (
                    activeSession ? (
                      <Link
                        to={`/live-attendance/${activeSession.id}`}
                        className="rounded-xl bg-[#003399] px-6 py-3 text-xs font-black text-white transition-all hover:bg-[#002266]"
                      >
                        View Live Attendance
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="rounded-xl bg-gray-100 px-6 py-3 text-xs font-black text-gray-400 transition-all"
                      >
                        Live Session Not Available
                      </button>
                    )
                  ) : (
                    <button className="rounded-xl bg-gray-50 px-6 py-3 text-xs font-black text-gray-500 transition-all hover:bg-gray-100">
                      Start Attendance
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right Side Panels */}
        <div className="space-y-8">
          {/* Live Monitoring */}
          <div className="rounded-[2.5rem] bg-[#151619] p-8 text-white shadow-2xl">
            <div className="flex items-center gap-2 mb-8">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">Live Monitoring</h3>
            </div>

            <div className="space-y-6">
              {monitoring.map((item, i) => (
                <div key={i} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <item.icon size={14} className={item.color} />
                      <span className={cn("text-[10px] font-black uppercase tracking-wider", item.color)}>{item.type}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500">{item.time}</span>
                  </div>
                  <p className="text-xs font-medium text-gray-400 leading-relaxed">
                    {item.desc}
                  </p>
                  {item.type === 'New Device Request' && (
                    <div className="flex gap-2 pt-2">
                      <button className="flex-1 rounded-lg bg-white/5 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">Deny</button>
                      <button className="flex-1 rounded-lg bg-blue-600 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">Approve</button>
                    </div>
                  )}
                  <div className="h-px w-full bg-white/5"></div>
                </div>
              ))}
            </div>

            <button className="mt-8 w-full rounded-xl border border-white/10 py-4 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all">
              Security Dashboard
            </button>
          </div>

          {/* Recent Activity */}
          <div className="rounded-[2.5rem] bg-white p-8 shadow-sm border border-gray-100">
            <h3 className="mb-8 text-xs font-black uppercase tracking-[0.2em] text-gray-400">Recent Activity</h3>
            <div className="space-y-8">
              {activity.map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", item.bg, item.color)}>
                    <item.icon size={18} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-gray-900">{item.title}</h4>
                    <p className="text-xs font-medium text-gray-500 leading-relaxed">{item.desc}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-1">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
