import { useState, useEffect } from 'react';
import * as React from 'react';
import { UserProfile, Class, Subject, Session } from '../types';
import { 
  PlusCircle, 
  MapPin, 
  Wifi, 
  Clock, 
  ShieldCheck, 
  BookOpen,
  Users,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { toIso } from '../lib/time';
import { supabase } from '../supabaseClient';
import { mapSessionRow } from '../lib/supabaseMappers';

interface CreateSessionProps {
  user: UserProfile;
}

export default function CreateSession({ user }: CreateSessionProps) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    classId: '',
    subjectId: '',
    duration: '60', // minutes
    // Default to off for smoother demo/testing without requiring geolocation permission.
    verifyGPS: false,
    verifyWiFi: false,
    wifiSSID: '',
    radius: '50' // meters
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        console.log('CreateSession: Starting data fetch...');
        
        // Fetch classes
        console.log('CreateSession: Fetching classes...');
        const { data: classesDataRaw, error: classesErr } = await supabase
          .from('classes')
          .select('*')
          .order('id', { ascending: true });
        if (classesErr) throw classesErr;
        const classesData = (classesDataRaw ?? []) as Class[];
        console.log(`CreateSession: Fetched ${classesData.length} classes`);
        setClasses(classesData);

        // Fetch subjects
        console.log('CreateSession: Fetching subjects...');
        const { data: subjectsDataRaw, error: subjectsErr } = await supabase
          .from('subjects')
          .select('*')
          .order('id', { ascending: true });
        if (subjectsErr) throw subjectsErr;
        const subjectsData = (subjectsDataRaw ?? []) as Subject[];
        console.log(`CreateSession: Fetched ${subjectsData.length} subjects`);
        setSubjects(subjectsData);

        if (classesData.length === 0 || subjectsData.length === 0) {
          console.warn('CreateSession: No classes or subjects found. Did you seed the data?');
          toast.warning('No classes or subjects found. Please ensure data is seeded.');
        }
      } catch (error: any) {
        console.error('CreateSession: Fetch error:', error);
        toast.error('Failed to load session data: ' + (error.message || 'Unknown error'));
      } finally {
        console.log('CreateSession: Data fetch complete, setting loading to false');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.classId || !formData.subjectId) {
      toast.error('Please select a class and subject');
      return;
    }

    setCreating(true);
    try {
      let location: Session['location'] | undefined = undefined;
      if (formData.verifyGPS) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          radius: parseInt(formData.radius)
        };
      }

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + parseInt(formData.duration, 10) * 60_000);

      // Deactivate any existing active sessions for this teacher
      const { error: deactivateErr } = await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('teacher_id', user.uid)
        .eq('is_active', true);
      if (deactivateErr) console.warn('Failed to deactivate previous sessions:', deactivateErr);

      const { data: created, error: createErr } = await supabase
        .from('sessions')
        .insert({
          class_id: formData.classId,
          subject_id: formData.subjectId,
          teacher_id: user.uid,
          start_time: toIso(startTime),
          end_time: toIso(endTime),
          is_active: true,
          verify_gps: formData.verifyGPS,
          verify_wifi: formData.verifyWiFi,
          wifi_ssid: formData.verifyWiFi ? formData.wifiSSID : null,
          location_lat: location?.latitude ?? null,
          location_lng: location?.longitude ?? null,
          location_radius: location?.radius ?? null,
        })
        .select('*')
        .single();
      if (createErr) throw createErr;

      const createdSession = mapSessionRow(created as any);
      toast.success('Session started successfully!');
      navigate(`/live-attendance/${createdSession.id}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0A66FF] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Start Attendance Session</h1>
        <p className="text-gray-500">Configure security and verification for this session.</p>
      </header>

      <form onSubmit={handleCreate} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 shadow-sm shadow-blue-50">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-gray-900">
              <BookOpen size={20} className="text-[#0A66FF]" />
              Basic Info
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">Select Class</label>
                <select
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium transition-all focus:border-[#0A66FF] focus:bg-white focus:ring-1 focus:ring-[#0A66FF]"
                >
                  <option value="">Choose a class...</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.section}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">Select Subject</label>
                <select
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium transition-all focus:border-[#0A66FF] focus:bg-white focus:ring-1 focus:ring-[#0A66FF]"
                >
                  <option value="">Choose a subject...</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">Duration (Minutes)</label>
                <div className="relative">
                  <Clock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 pl-12 text-sm font-medium transition-all focus:border-[#0A66FF] focus:bg-white focus:ring-1 focus:ring-[#0A66FF]"
                    placeholder="e.g., 60"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-sm shadow-blue-50">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-gray-900">
              <ShieldCheck size={20} className="text-green-500" />
              Anti-Proxy Settings
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-blue-50 p-2 text-[#0A66FF]">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">GPS Geofencing</p>
                    <p className="text-xs text-gray-500">Validate student location</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, verifyGPS: !formData.verifyGPS })}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors duration-200",
                    formData.verifyGPS ? "bg-[#0A66FF]" : "bg-gray-200"
                  )}
                >
                  <div className={cn(
                    "absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform duration-200",
                    formData.verifyGPS ? "translate-x-5" : "translate-x-0"
                  )} />
                </button>
              </div>

              {formData.verifyGPS && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="mb-2 block text-xs font-bold text-gray-500 uppercase tracking-wider">Radius (Meters)</label>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="10"
                    value={formData.radius}
                    onChange={(e) => setFormData({ ...formData, radius: e.target.value })}
                    className="w-full accent-[#0A66FF]"
                  />
                  <div className="mt-1 flex justify-between text-[10px] font-bold text-gray-400">
                    <span>10m</span>
                    <span className="text-[#0A66FF]">{formData.radius}m</span>
                    <span>200m</span>
                  </div>
                </motion.div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-orange-50 p-2 text-orange-500">
                    <Wifi size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">WiFi Verification</p>
                    <p className="text-xs text-gray-500">Restrict to specific SSID</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, verifyWiFi: !formData.verifyWiFi })}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors duration-200",
                    formData.verifyWiFi ? "bg-orange-500" : "bg-gray-200"
                  )}
                >
                  <div className={cn(
                    "absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform duration-200",
                    formData.verifyWiFi ? "translate-x-5" : "translate-x-0"
                  )} />
                </button>
              </div>

              {formData.verifyWiFi && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="mb-2 block text-xs font-bold text-gray-500 uppercase tracking-wider">WiFi SSID</label>
                  <input
                    type="text"
                    value={formData.wifiSSID}
                    onChange={(e) => setFormData({ ...formData, wifiSSID: e.target.value })}
                    className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium transition-all focus:border-orange-500 focus:bg-white focus:ring-1 focus:ring-orange-500"
                    placeholder="e.g., University_WiFi_Main"
                  />
                </motion.div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-blue-50 p-6 text-blue-700">
          <div className="flex gap-3">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-bold">Security Note</p>
              <p className="opacity-80">
                Starting this session will automatically capture your current GPS coordinates to set the geofence center. Ensure you are in the classroom.
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={creating}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0A66FF] py-5 text-xl font-bold text-white shadow-xl shadow-blue-200 transition-all hover:bg-[#0052D9] active:scale-[0.98] disabled:opacity-70"
        >
          {creating ? (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          ) : (
            <>
              <PlusCircle size={24} />
              Launch Attendance Session
            </>
          )}
        </button>
      </form>
    </div>
  );
}
