import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, Session, Attendance, Subject } from '../types';
import { mapSessionRow } from '../lib/supabaseMappers';
import { 
  ShieldCheck, 
  MapPin, 
  Wifi, 
  Smartphone, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ArrowRight,
  MousePointer2,
  Activity,
  Users,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { calculateDistance, generateDeviceId, cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { toDate, toIso } from '../lib/time';
import { studentActiveSessionsQuery } from '../lib/sessionScope';

interface MarkAttendanceProps {
  user: UserProfile;
}

type ValidationStep = 'device' | 'location' | 'wifi' | 'time';
type ValidationStatus = 'pending' | 'loading' | 'success' | 'error';

export default function MarkAttendance({ user }: MarkAttendanceProps) {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [teacherName, setTeacherName] = useState<string>('Prof. Smith');
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [status, setStatus] = useState<Record<ValidationStep, ValidationStatus>>({
    device: 'pending',
    location: 'pending',
    wifi: 'pending',
    time: 'pending'
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('00:00');
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAnyValidationError = Object.values(status).some((s) => s === 'error');

  useEffect(() => {
    const fetchActiveSession = async () => {
      const q = studentActiveSessionsQuery(user);
      if (!q) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await q;
        if (error) throw error;

        if (data && data[0]) {
          const sessionData = mapSessionRow(data[0] as any);
          setActiveSession(sessionData);

          // Fetch Subject
          const { data: sub, error: subErr } = await supabase
            .from('subjects')
            .select('*')
            .eq('id', sessionData.subjectId)
            .maybeSingle();
          if (!subErr && sub) setSubject(sub as any);

          // Fetch Teacher
          const { data: teacher, error: tErr } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', sessionData.teacherId)
            .maybeSingle();
          if (!tErr && teacher?.name) setTeacherName(teacher.name);

          const end = toDate(sessionData.endTime);
          if (end) startTimer(end);
        }
        setLoading(false);
      } catch (error: any) {
        console.error('Error fetching active session:', error);
        setLoading(false);
      }
    };

    fetchActiveSession();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user.classId, user.semesterId, user.sectionId]);

  const startTimer = (endTime: Date) => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    const update = () => {
      const now = new Date();
      const diff = endTime.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft('00:00');
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };
    
    update();
    timerRef.current = setInterval(update, 1000);
  };

  const handleMarkAttendance = async () => {
    if (!activeSession) return;
    
    setMarking(true);
    setErrorMsg(null);
    let capturedLocation: Attendance['location'] | undefined;
    
    try {
      // 1. Device Validation
      setStatus(prev => ({ ...prev, device: 'loading' }));
      const currentDeviceId = generateDeviceId();
      if (user.deviceId && user.deviceId !== currentDeviceId) {
        setStatus(prev => ({ ...prev, device: 'error' }));
        throw new Error('This device is not registered for your account.');
      }
      
      if (!user.deviceId) {
        const { error } = await supabase
          .from('profiles')
          .update({ device_id: currentDeviceId })
          .eq('id', user.uid);
        if (error) throw error;
      }
      setStatus(prev => ({ ...prev, device: 'success' }));
      
      // 2. Time Validation
      setStatus(prev => ({ ...prev, time: 'loading' }));
      const now = new Date();
      const start = toDate(activeSession.startTime);
      const end = toDate(activeSession.endTime);
      if (!start || !end || now < start || now > end) {
        setStatus(prev => ({ ...prev, time: 'error' }));
        throw new Error('Attendance session has expired or not started yet.');
      }
      setStatus(prev => ({ ...prev, time: 'success' }));

      // 3. Location Validation
      setStatus(prev => ({ ...prev, location: 'loading' }));
      if (activeSession.verifyGPS && activeSession.location) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { 
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          });
        });

        capturedLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        
        const distance = calculateDistance(
          position.coords.latitude,
          position.coords.longitude,
          activeSession.location.latitude,
          activeSession.location.longitude
        );
        
        if (distance > activeSession.location.radius) {
          setStatus(prev => ({ ...prev, location: 'error' }));
          throw new Error(`You are outside the classroom geofence (${Math.round(distance)}m away).`);
        }
      }
      setStatus(prev => ({ ...prev, location: 'success' }));

      // 4. WiFi Validation
      setStatus(prev => ({ ...prev, wifi: 'loading' }));
      if (activeSession.verifyWiFi && activeSession.wifiSSID) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Mock check for demo
        const isCorrectWiFi = true; 
        if (!isCorrectWiFi) {
          setStatus(prev => ({ ...prev, wifi: 'error' }));
          throw new Error(`Please connect to the university WiFi: ${activeSession.wifiSSID}`);
        }
      }
      setStatus(prev => ({ ...prev, wifi: 'success' }));

      // Final Step: Save to Supabase
      const attendanceData: Omit<Attendance, 'id'> = {
        studentId: user.uid,
        sessionId: activeSession.id,
        timestamp: toIso(new Date()),
        status: 'present',
        deviceId: currentDeviceId,
        verified: true,
        location: capturedLocation
      };

      const { error: insertErr } = await supabase.from('attendance').insert({
        student_id: attendanceData.studentId,
        session_id: attendanceData.sessionId,
        timestamp: attendanceData.timestamp,
        status: attendanceData.status,
        device_id: attendanceData.deviceId,
        verified: attendanceData.verified,
        location_lat: attendanceData.location?.latitude ?? null,
        location_lng: attendanceData.location?.longitude ?? null,
      });
      if (insertErr) throw insertErr;
      toast.success('Attendance marked successfully!');
      setTimeout(() => navigate('/'), 2000);

    } catch (error: any) {
      console.error('Attendance marking error:', error);
      // Supabase unique constraint will throw if already marked
      setErrorMsg(error.message || 'Validation failed');
      toast.error(error.message || 'Failed to mark attendance');
    } finally {
      setMarking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1D4ED8] border-t-transparent"></div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-12 text-center shadow-sm">
        <div className="mb-6 rounded-full bg-orange-100 p-6 text-orange-500">
          <Clock size={48} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">No Active Session</h2>
        <p className="mt-2 text-gray-500">
          There is no active class session for your section right now. Check back when your teacher starts a session.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => navigate('/')}
            className="rounded-2xl bg-gray-100 px-8 py-3 font-bold text-gray-600 transition-all hover:bg-gray-200"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="mb-8 flex items-center gap-2 text-xs font-bold tracking-widest text-gray-400 uppercase">
        <span>Attendance</span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-[#1D4ED8]">Current Session</span>
      </nav>

      {/* Header Section */}
      <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h1 className="text-5xl font-black tracking-tight text-gray-900">
            {subject?.code || activeSession.subjectId}: {subject?.name || 'Loading...'}
          </h1>
          <p className="mt-4 text-xl font-medium text-gray-500">
            {teacherName} • Engineering Block, Room 402
          </p>
        </div>

        {/* Time Remaining Card */}
        <div className="rounded-2xl bg-[#F8F9FB] p-6 shadow-sm min-w-[200px]">
          <p className="text-xs font-bold tracking-widest text-gray-400 uppercase text-center mb-1">
            Time Remaining
          </p>
          <p className="text-4xl font-black text-[#1D4ED8] text-center tabular-nums">
            {timeLeft}
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left Column: Identity & Proxy Check */}
        <div className="rounded-[32px] bg-white p-10 shadow-sm border border-gray-50">
          <div className="mb-10 flex items-center gap-4">
            <div className="rounded-xl bg-blue-50 p-3 text-[#1D4ED8]">
              <ShieldCheck size={28} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Identity & Proxy Check</h2>
          </div>

          <div className="space-y-6">
            <VerificationItem 
              icon={Smartphone} 
              label="Device Verified" 
              sublabel={user.deviceId ? "Authorized Device Detected" : "Registering Current Device"} 
              status={status.device} 
            />
            <VerificationItem 
              icon={MapPin} 
              label="GPS Location" 
              sublabel={
                !activeSession.verifyGPS
                  ? 'GPS verification disabled'
                  : activeSession.location
                    ? 'Inside Classroom Radius'
                    : 'Geofence not set for this session'
              }
              status={status.location} 
            />
            <VerificationItem 
              icon={Wifi} 
              label="WiFi Connected" 
              sublabel={
                !activeSession.verifyWiFi
                  ? 'WiFi verification disabled'
                  : activeSession.wifiSSID
                    ? `${activeSession.wifiSSID} Network`
                    : 'WiFi SSID not set for this session'
              }
              status={status.wifi} 
            />
            <VerificationItem 
              icon={Clock} 
              label="Session Active" 
              sublabel={`${subject?.code || activeSession.subjectId} Attendance Window Open`} 
              status={status.time} 
            />
          </div>

          {/* Integrity Alert */}
          <div className="mt-12 flex items-start gap-4 rounded-xl bg-[#FFF5F5] p-6 border-l-4 border-red-500">
            <div className="rounded-full bg-red-100 p-2 text-red-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="font-bold text-red-900">Integrity Check Active</p>
              <p className="text-sm text-red-700/80 leading-relaxed">
                Moving away from the classroom during this session will void your attendance entry.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication */}
        <div className="rounded-[32px] bg-white p-10 shadow-sm border border-gray-50 flex flex-col items-center justify-center text-center">
          <div className="mb-10 relative">
            <div className="h-40 w-40 rounded-[40px] bg-[#F0F4FF] flex items-center justify-center">
              <div className="h-24 w-24 rounded-3xl bg-[#1D4ED8] flex items-center justify-center text-white shadow-xl shadow-blue-200">
                <MousePointer2 size={48} />
              </div>
            </div>
          </div>

          <h2 className="text-4xl font-black text-gray-900 mb-4">Ready to Authenticate</h2>
          <p className="text-gray-500 text-lg max-w-md mb-12 leading-relaxed">
            Your biometric and location data are synchronized. Please tap below to confirm your presence for this session.
          </p>

          <button
            onClick={handleMarkAttendance}
            disabled={marking || hasAnyValidationError}
            className={cn(
              "group relative w-full max-w-md overflow-hidden rounded-2xl bg-[#1D4ED8] py-6 text-xl font-bold text-white transition-all hover:bg-[#1E40AF] hover:shadow-2xl hover:shadow-blue-200 active:scale-[0.98] disabled:opacity-50",
              marking && "cursor-wait"
            )}
          >
            <div className="flex items-center justify-center gap-3">
              {marking ? (
                <>
                  <div className="h-6 w-6 animate-spin rounded-full border-3 border-white border-t-transparent"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Mark Attendance</span>
                  <ArrowRight size={24} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
            </div>
          </button>

          <p className="mt-8 text-xs font-bold tracking-widest text-gray-400 uppercase">
            Encrypted Transaction ID: SENT-882-QX9
          </p>
        </div>
      </div>

      {/* Bottom Activity Row */}
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div className="flex items-center gap-6 rounded-3xl bg-white p-8 shadow-sm border border-gray-50 border-l-8 border-l-gray-400">
          <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400">
            <Activity size={32} />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">Campus Activity</p>
            <p className="text-gray-500">Active attendance window in Computer Lab 3.</p>
          </div>
        </div>

        <div className="flex items-center gap-6 rounded-3xl bg-white p-8 shadow-sm border border-gray-50 border-l-8 border-l-blue-400">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center text-[#1D4ED8]">
            <Users size={32} />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">Peer Network</p>
            <p className="text-gray-500">42 students currently verified in this session.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerificationItem({ 
  icon: Icon, 
  label, 
  sublabel, 
  status 
}: { 
  icon: any, 
  label: string, 
  sublabel: string, 
  status: ValidationStatus 
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-5">
        <div className={cn(
          "rounded-2xl p-4 transition-colors",
          status === 'success' ? "bg-blue-50 text-[#1D4ED8]" : 
          status === 'error' ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-400"
        )}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{label}</p>
          <p className="text-sm text-gray-500">{sublabel}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-center">
        {status === 'loading' && (
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-[#1D4ED8] border-t-transparent"></div>
        )}
        {status === 'success' && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
            <CheckCircle2 size={16} />
          </div>
        )}
        {status === 'error' && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white">
            <XCircle size={16} />
          </div>
        )}
        {status === 'pending' && (
          <div className="h-6 w-6 rounded-full border-2 border-gray-200"></div>
        )}
      </div>
    </div>
  );
}
