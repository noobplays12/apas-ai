import { useState, useEffect } from 'react';
import * as React from 'react';
import { UserProfile, Session, Subject, Semester, Section } from '../types';
import {
  PlusCircle,
  MapPin,
  Wifi,
  Clock,
  ShieldCheck,
  BookOpen,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { toIso } from '../lib/time';
import { supabase } from '../supabaseClient';
import { mapSessionRow } from '../lib/supabaseMappers';

interface CreateSessionProps {
  user: UserProfile;
}

export default function CreateSession({ user }: CreateSessionProps) {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    semesterId: '',
    sectionId: '',
    subjectId: '',
    duration: '60',
    verifyGPS: false,
    verifyWiFi: false,
    wifiSSID: '',
    radius: '50',
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [{ data: sem, error: e1 }, { data: subj, error: e2 }] = await Promise.all([
          supabase.from('semesters').select('*').order('sort_order', { ascending: true }),
          supabase.from('subjects').select('*').order('id', { ascending: true }),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;
        setSemesters(
          (sem ?? []).map((r: any) => ({
            id: r.id,
            name: r.name,
            sortOrder: r.sort_order ?? 0,
          }))
        );
        setSubjects((subj ?? []) as Subject[]);

        const spSem = searchParams.get('semesterId');
        const spSec = searchParams.get('sectionId');
        const spSub = searchParams.get('subjectId');
        if (spSem) {
          setFormData((f) => ({ ...f, semesterId: spSem }));
          setStep(2);
        }
        if (spSec) setFormData((f) => ({ ...f, sectionId: spSec }));
        if (spSub) setFormData((f) => ({ ...f, subjectId: spSub }));
      } catch (e: any) {
        console.error(e);
        toast.error('Failed to load data: ' + (e.message || 'Unknown'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [searchParams]);

  useEffect(() => {
    const loadSections = async () => {
      if (!formData.semesterId) {
        setSections([]);
        return;
      }
      const { data, error } = await supabase
        .from('sections')
        .select('*')
        .eq('semester_id', formData.semesterId)
        .order('section_name', { ascending: true });
      if (error) {
        console.error(error);
        return;
      }
      setSections(
        (data ?? []).map((r: any) => ({
          id: r.id,
          semesterId: r.semester_id,
          sectionName: r.section_name,
          displayLabel: r.display_label ?? undefined,
        }))
      );
    };
    loadSections();
  }, [formData.semesterId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.semesterId || !formData.sectionId || !formData.subjectId) {
      toast.error('Select semester, section, and subject');
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
          radius: parseInt(formData.radius, 10),
        };
      }

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + parseInt(formData.duration, 10) * 60_000);

      // Only deactivate other active sessions for this teacher in THIS semester+section (multi-class safe)
      const { error: deactivateErr } = await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('teacher_id', user.uid)
        .eq('is_active', true)
        .eq('semester_id', formData.semesterId)
        .eq('section_id', formData.sectionId);
      if (deactivateErr) console.warn('Deactivate previous sessions:', deactivateErr);

      const { data: created, error: createErr } = await supabase
        .from('sessions')
        .insert({
          class_id: null,
          semester_id: formData.semesterId,
          section_id: formData.sectionId,
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
        <p className="text-gray-500">Select semester → section → subject. Multiple concurrent classes are supported.</p>
      </header>

      <div className="flex gap-2 text-sm font-bold text-gray-500">
        <span className={cn(step >= 1 && 'text-[#0A66FF]')}>1. Semester</span>
        <ChevronRight size={16} />
        <span className={cn(step >= 2 && 'text-[#0A66FF]')}>2. Section</span>
        <ChevronRight size={16} />
        <span className={cn(step >= 3 && 'text-[#0A66FF]')}>3. Subject & security</span>
      </div>

      <form onSubmit={handleCreate} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 shadow-sm shadow-blue-50 md:col-span-2">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-gray-900">
              <BookOpen size={20} className="text-[#0A66FF]" />
              Class & subject
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">Semester</label>
                <select
                  value={formData.semesterId}
                  onChange={(e) => {
                    setFormData({ ...formData, semesterId: e.target.value, sectionId: '' });
                    setStep(2);
                  }}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium transition-all focus:border-[#0A66FF] focus:bg-white focus:ring-1 focus:ring-[#0A66FF]"
                >
                  <option value="">Choose semester...</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">Section</label>
                <select
                  value={formData.sectionId}
                  onChange={(e) => {
                    setFormData({ ...formData, sectionId: e.target.value });
                    setStep(3);
                  }}
                  disabled={!formData.semesterId}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium transition-all focus:border-[#0A66FF] focus:bg-white focus:ring-1 focus:ring-[#0A66FF] disabled:opacity-50"
                >
                  <option value="">Choose section...</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      Section {sec.sectionName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">Subject</label>
                <select
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  disabled={!formData.sectionId}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium transition-all focus:border-[#0A66FF] focus:bg-white focus:ring-1 focus:ring-[#0A66FF] disabled:opacity-50"
                >
                  <option value="">Choose subject...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-bold text-gray-700">Duration (minutes)</label>
              <div className="relative max-w-xs">
                <Clock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 pl-12 text-sm font-medium transition-all focus:border-[#0A66FF] focus:bg-white focus:ring-1 focus:ring-[#0A66FF]"
                  min={5}
                  max={240}
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-sm shadow-blue-50 md:col-span-2">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-gray-900">
              <ShieldCheck size={20} className="text-green-500" />
              Anti-proxy
            </h3>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-blue-50 p-2 text-[#0A66FF]">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">GPS</p>
                    <p className="text-xs text-gray-500">Geofence</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, verifyGPS: !formData.verifyGPS })}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors duration-200',
                    formData.verifyGPS ? 'bg-[#0A66FF]' : 'bg-gray-200'
                  )}
                >
                  <div
                    className={cn(
                      'absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform duration-200',
                      formData.verifyGPS ? 'translate-x-5' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-orange-50 p-2 text-orange-500">
                    <Wifi size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">WiFi</p>
                    <p className="text-xs text-gray-500">SSID</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, verifyWiFi: !formData.verifyWiFi })}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors duration-200',
                    formData.verifyWiFi ? 'bg-orange-500' : 'bg-gray-200'
                  )}
                >
                  <div
                    className={cn(
                      'absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform duration-200',
                      formData.verifyWiFi ? 'translate-x-5' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>
            </div>
            {formData.verifyGPS && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                <label className="mb-2 block text-xs font-bold text-gray-500 uppercase">Radius (m)</label>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="10"
                  value={formData.radius}
                  onChange={(e) => setFormData({ ...formData, radius: e.target.value })}
                  className="w-full accent-[#0A66FF]"
                />
              </motion.div>
            )}
            {formData.verifyWiFi && (
              <input
                type="text"
                value={formData.wifiSSID}
                onChange={(e) => setFormData({ ...formData, wifiSSID: e.target.value })}
                className="mt-4 w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm"
                placeholder="WiFi SSID"
              />
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-blue-50 p-6 text-blue-700">
          <div className="flex gap-3">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-bold">Concurrent sessions</p>
              <p className="opacity-80">
                You can run multiple active sessions in different sections. Starting here only ends your active session in
                the same semester + section.
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={creating || !formData.semesterId || !formData.sectionId || !formData.subjectId}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0A66FF] py-5 text-xl font-bold text-white shadow-xl shadow-blue-200 transition-all hover:bg-[#0052D9] active:scale-[0.98] disabled:opacity-70"
        >
          {creating ? (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          ) : (
            <>
              <PlusCircle size={24} />
              Launch session
            </>
          )}
        </button>
      </form>
    </div>
  );
}
