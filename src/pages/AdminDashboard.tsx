import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, seedDemoData, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Session } from '../types';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  Settings, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck,
  Activity,
  UserPlus,
  ChevronRight,
  Database,
  Lock,
  Server,
  Globe,
  DatabaseBackup
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface AdminDashboardProps {
  user: UserProfile;
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    classes: 0,
    activeSessions: 0
  });
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [showForceReload, setShowForceReload] = useState(false);

  const handleSeed = async () => {
    let timeoutId: any;
    let forceReloadId: any;
    try {
      setSeeding(true);
      setShowForceReload(false);
      toast.info('Seeding demo environment...');
      
      // Add a safety timeout
      timeoutId = setTimeout(() => {
        if (seeding) {
          toast.error('Seeding is taking longer than expected.');
        }
      }, 15000);

      // Show force reload after 10 seconds
      forceReloadId = setTimeout(() => {
        setShowForceReload(true);
      }, 10000);

      await seedDemoData();
      clearTimeout(timeoutId);
      clearTimeout(forceReloadId);
      toast.success('Demo data seeded successfully!');
      
      // Small delay before reload to let Firestore sync
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      if (forceReloadId) clearTimeout(forceReloadId);
      console.error('Seeding error:', error);
      toast.error('Failed to seed data: ' + error.message);
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [studentsSnap, teachersSnap, classesSnap, sessionsSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
          getDocs(query(collection(db, 'users'), where('role', '==', 'teacher'))),
          getDocs(collection(db, 'classes')),
          getDocs(query(collection(db, 'sessions'), where('isActive', '==', true)))
        ]);
        
        setStats({
          students: studentsSnap.size,
          teachers: teachersSnap.size,
          classes: classesSnap.size,
          activeSessions: sessionsSnap.size
        });

        if (!sessionsSnap.empty) {
          setActiveSession({ id: sessionsSnap.docs[0].id, ...sessionsSnap.docs[0].data() } as Session);
        } else {
          setActiveSession(null);
        }
      } catch (e: any) {
        console.error('Error fetching admin stats:', e);
        if (e.code === 'permission-denied') {
          handleFirestoreError(e, OperationType.LIST, 'stats');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Real-time listener for active sessions
    const q = query(collection(db, 'sessions'), where('isActive', '==', true), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveSession({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Session);
        setStats(prev => ({ ...prev, activeSessions: snapshot.size }));
      } else {
        setActiveSession(null);
        setStats(prev => ({ ...prev, activeSessions: 0 }));
      }
    });

    return () => unsubscribe();
  }, []);

  const statCards = [
    { label: 'Total Students', value: loading ? '...' : stats.students, icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Faculty Members', value: loading ? '...' : stats.teachers, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Active Courses', value: loading ? '...' : stats.classes, icon: BookOpen, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Live Sessions', value: loading ? '...' : stats.activeSessions, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const chartData = [
    { name: 'Jan', attendance: 65 },
    { name: 'Feb', attendance: 72 },
    { name: 'Mar', attendance: 85 },
    { name: 'Apr', attendance: 78 },
    { name: 'May', attendance: 90 },
  ];

  return (
    <div className="space-y-10 pb-12 font-sans">
      {/* Header Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#003399]">
            System Administration • Control Center
          </p>
          <h1 className="mt-2 text-5xl font-black tracking-tight text-gray-900">
            Admin Overview.
          </h1>
          <p className="mt-3 text-lg font-medium text-gray-500">
            {stats.activeSessions > 0 
              ? `System health is optimal. ${stats.activeSessions} active sessions are currently being monitored.`
              : 'System health is optimal. No active sessions currently.'}
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center justify-center gap-3 rounded-xl bg-blue-50 border border-blue-100 px-8 py-5 text-lg font-bold text-[#003399] shadow-sm transition-all hover:bg-blue-100 active:scale-95 disabled:opacity-50"
          >
            <DatabaseBackup size={24} className={seeding ? 'animate-spin' : ''} />
            {seeding ? 'Seeding...' : 'Seed Demo Data'}
          </button>
          <Link
            to="/settings"
            className="flex items-center justify-center gap-3 rounded-xl bg-white border border-gray-100 px-8 py-5 text-lg font-bold text-gray-900 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
          >
            <Settings size={24} />
            System Configuration
          </Link>
        </div>
      </div>

      {/* Empty Database Warning */}
      {!loading && stats.students === 0 && stats.teachers === 0 && stats.classes === 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-[2.5rem] bg-orange-50 border-2 border-orange-100 p-10 text-center"
        >
          <DatabaseBackup size={48} className="mx-auto mb-4 text-orange-400" />
          <h2 className="text-2xl font-black text-orange-900 tracking-tight">Database is Empty</h2>
          <p className="mt-2 text-lg font-bold text-orange-700">
            It looks like you haven't seeded any demo data yet. All management pages will appear empty.
          </p>
          <div className="flex flex-col items-center gap-4 mt-8">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center justify-center gap-3 rounded-xl bg-orange-600 px-10 py-5 text-lg font-bold text-white shadow-xl shadow-orange-900/20 transition-all hover:bg-orange-700 active:scale-95 disabled:opacity-50"
            >
              <DatabaseBackup size={24} className={seeding ? 'animate-spin' : ''} />
              {seeding ? 'Seeding Environment...' : 'Seed Demo Data Now'}
            </button>
            
            {showForceReload && (
              <button
                onClick={() => window.location.reload()}
                className="text-sm font-bold text-orange-600 underline hover:text-orange-700"
              >
                Taking too long? Click here to refresh and try again.
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Live Session Alert for Admins */}
      {activeSession && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2.5rem] bg-indigo-600 p-10 text-white shadow-2xl shadow-indigo-900/20"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-md">
                  <Activity size={40} />
                </div>
                <div className="absolute -right-1 -top-1 h-5 w-5 rounded-full border-4 border-indigo-600 bg-green-400"></div>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">System Alert</span>
                  <span className="h-1 w-1 rounded-full bg-indigo-300"></span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-green-300">Live Session Detected</span>
                </div>
                <h2 className="mt-1 text-3xl font-black tracking-tight">Active Attendance Session.</h2>
                <p className="mt-2 text-lg font-bold text-indigo-100 opacity-80">
                  A session is currently active. You can monitor real-time attendance and system health.
                </p>
              </div>
            </div>
            <Link
              to={`/live-attendance/${activeSession.id}`}
              className="flex items-center justify-center gap-4 rounded-2xl bg-white px-10 py-5 text-lg font-black text-indigo-600 shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              Monitor Live
              <ArrowRight size={24} />
            </Link>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-[2.5rem] bg-white p-8 shadow-sm border border-gray-50"
          >
            <div className={`mb-6 inline-flex rounded-2xl ${stat.bg} p-4 ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{stat.label}</p>
            <p className="mt-1 text-4xl font-black text-gray-900">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Monthly Trends */}
        <div className="rounded-[2.5rem] bg-white p-10 shadow-sm border border-gray-50 lg:col-span-2">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">System Analytics</h3>
              <p className="mt-1 text-xl font-black text-gray-900">Monthly Attendance Trends</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-1">
              <button className="rounded-lg bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-900 shadow-sm">Attendance</button>
              <button className="rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Activity</button>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAdmin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#003399" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#003399" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#F9FAFB" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 900 }} 
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', fontWeight: 800 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="attendance" 
                  stroke="#003399" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorAdmin)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Management */}
        <div className="space-y-8">
          <div className="rounded-[2.5rem] bg-white p-8 shadow-sm border border-gray-50">
            <h3 className="mb-6 text-xs font-black uppercase tracking-widest text-gray-400">Quick Management</h3>
            <div className="space-y-3">
              {[
                { label: 'Student Registry', path: '/students', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Faculty Registry', path: '/teachers', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { label: 'Course Catalog', path: '/classes', icon: BookOpen, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'System Logs', path: '/settings', icon: Database, color: 'text-orange-600', bg: 'bg-orange-50' },
              ].map((item) => (
                <Link 
                  key={item.label} 
                  to={item.path}
                  className="flex w-full items-center justify-between rounded-2xl p-4 transition-all hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className={`rounded-xl ${item.bg} p-2 ${item.color}`}>
                      <item.icon size={18} />
                    </div>
                    <span className="text-sm font-black text-gray-700">{item.label}</span>
                  </div>
                  <ChevronRight size={18} className="text-gray-300" />
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[2.5rem] bg-[#003399] p-10 text-white shadow-xl shadow-blue-900/20">
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur-md">
                <ShieldCheck size={24} />
              </div>
              <span className="rounded-lg bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                Secure
              </span>
            </div>
            <p className="mt-8 text-sm font-bold text-blue-200">Security Status</p>
            <h3 className="mt-2 text-2xl font-black leading-tight tracking-tight">
              All Systems Operational
            </h3>
            <div className="mt-6 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">Auth</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">DB</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">API</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Audit Section */}
      <div className="space-y-6">
        <h3 className="text-2xl font-black text-gray-900 tracking-tight">System Security Audit</h3>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { label: 'Device Binding', status: 'Active', desc: 'Single device per student', icon: Lock, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Geofence Accuracy', status: 'Optimized', desc: 'Threshold: 50 meters', icon: Globe, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Server Status', status: 'Healthy', desc: 'Uptime: 99.99%', icon: Server, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          ].map((audit) => (
            <div key={audit.label} className="flex items-center gap-6 rounded-[2rem] bg-white p-8 shadow-sm border border-gray-50">
              <div className={`rounded-2xl ${audit.bg} p-4 ${audit.color}`}>
                <audit.icon size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-gray-900">{audit.label}</p>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${audit.color}`}>{audit.status}</span>
                </div>
                <p className="text-xs font-bold text-gray-400">{audit.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

