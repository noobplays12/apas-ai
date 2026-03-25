import { useCallback, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { useHasRealSupabaseSession } from '../lib/useSupabaseSessionRequired';
import { cn } from '../lib/utils';

interface Props {
  user: UserProfile;
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(binary);
}

export default function AdminUploadSectionPdf({ user: _user }: Props) {
  const [semesters, setSemesters] = useState<{ id: string; name: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; section_name: string }[]>([]);
  const [semesterId, setSemesterId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [newSemesterName, setNewSemesterName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const hasRealSession = useHasRealSupabaseSession();

  const loadSemesters = useCallback(async () => {
    const { data, error } = await supabase.from('semesters').select('id,name').order('sort_order', { ascending: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    setSemesters(data ?? []);
  }, []);

  useEffect(() => {
    loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    const loadSections = async () => {
      if (!semesterId) {
        setSections([]);
        setSectionId('');
        return;
      }
      const { data, error } = await supabase
        .from('sections')
        .select('id,section_name')
        .eq('semester_id', semesterId)
        .order('section_name', { ascending: true });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSections(data ?? []);
    };
    loadSections();
  }, [semesterId]);

  const addSemester = async () => {
    if (!newSemesterName.trim()) return;
    const { data, error } = await supabase
      .from('semesters')
      .insert({ name: newSemesterName.trim(), sort_order: semesters.length })
      .select('id,name')
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Semester added');
    setNewSemesterName('');
    await loadSemesters();
    setSemesterId(data.id);
  };

  const addSection = async () => {
    if (!semesterId || !newSectionName.trim()) return;
    const { data, error } = await supabase
      .from('sections')
      .insert({ semester_id: semesterId, section_name: newSectionName.trim().toUpperCase() })
      .select('id,section_name')
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Section added');
    setNewSectionName('');
    const { data: list } = await supabase.from('sections').select('id,section_name').eq('semester_id', semesterId);
    setSections(list ?? []);
    setSectionId(data.id);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === 'application/pdf') setFile(f);
    else toast.error('Please drop a PDF file');
  };

  const runUpload = async () => {
    if (!file || !semesterId || !sectionId) {
      toast.error('Select semester, section, and a PDF');
      return;
    }
    setUploading(true);
    setProgress(10);
    setLogs([]);
    try {
      const buf = await file.arrayBuffer();
      const pdfBase64 = bufferToBase64(buf);
      setProgress(40);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');

      const res = await fetch('/api/admin/parse-section-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pdfBase64, semesterId, sectionId }),
      });
      setProgress(90);
      const resText = await res.text();
      let json: any = null;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json') || (resText.trim().startsWith('{') || resText.trim().startsWith('['))) {
        try {
          json = JSON.parse(resText);
        } catch {
          // If JSON parsing fails, we still want a helpful error below.
          json = null;
        }
      }

      if (!res.ok) {
        const msg = json?.error || `Server error (${res.status}). ${resText.slice(0, 200)}`;
        throw new Error(msg);
      }
      if (!json) {
        throw new Error(`Server returned non-JSON success response. ${resText.slice(0, 200)}`);
      }
      setLogs([
        `Parsed rows: ${json.totalParsed ?? 0}`,
        `Inserted/updated: ${json.inserted ?? 0}`,
        `Skipped: ${json.skipped ?? 0}`,
        ...(json.warnings || []).slice(0, 20),
      ]);
      toast.success('PDF processed');
    } catch (e: any) {
      toast.error(e.message || 'Failed');
      setLogs([e.message || 'Error']);
    } finally {
      setProgress(100);
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-black text-gray-900">Upload section data (PDF)</h1>
        <p className="mt-2 text-gray-500">
          IUB-style sheets: table with <strong>Roll No</strong> (e.g. F25BARIN1M01052) and <strong>Name</strong>. We scan text for
          roll tokens and names. Scanned-image-only PDFs (no text) need OCR — export from Word with embedded text when possible.
        </p>
      </div>

      {hasRealSession === false && (
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">
            Dev bypass has no API token. Sign out and log in with your <strong>admin email + password</strong> to process PDFs on
            Vercel.
          </p>
        </div>
      )}

      <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm space-y-4">
        <label className="text-xs font-black uppercase tracking-widest text-gray-400">Semester</label>
        <div className="flex flex-wrap gap-2">
          <select
            value={semesterId}
            onChange={(e) => setSemesterId(e.target.value)}
            className="flex-1 min-w-[200px] rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold"
          >
            <option value="">Select…</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            value={newSemesterName}
            onChange={(e) => setNewSemesterName(e.target.value)}
            placeholder="New semester name"
            className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold flex-1 min-w-[160px]"
          />
          <button type="button" onClick={addSemester} className="rounded-2xl bg-[#003399] px-6 py-4 text-sm font-black text-white">
            Add
          </button>
        </div>

        <label className="text-xs font-black uppercase tracking-widest text-gray-400">Section</label>
        <div className="flex flex-wrap gap-2">
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={!semesterId}
            className="flex-1 min-w-[200px] rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold disabled:opacity-50"
          >
            <option value="">Select…</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.section_name}
              </option>
            ))}
          </select>
          <input
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            placeholder="e.g. A"
            className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold flex-1 min-w-[120px]"
          />
          <button type="button" onClick={addSection} disabled={!semesterId} className="rounded-2xl bg-gray-900 px-6 py-4 text-sm font-black text-white disabled:opacity-50">
            Add section
          </button>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn(
          'rounded-3xl border-2 border-dashed p-12 text-center transition-colors',
          drag ? 'border-[#0A66FF] bg-blue-50/50' : 'border-gray-200 bg-gray-50/80'
        )}
      >
        <Upload className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <p className="font-bold text-gray-700">Drag & drop PDF here</p>
        <input
          type="file"
          accept="application/pdf"
          className="mt-4 block mx-auto text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file && (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-[#003399]">
            <FileText size={16} />
            {file.name}
          </p>
        )}
      </div>

      {uploading && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full bg-[#0A66FF] transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      <button
        type="button"
        disabled={uploading}
        onClick={runUpload}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0A66FF] py-5 text-lg font-black text-white shadow-lg disabled:opacity-60"
      >
        {uploading ? <Loader2 className="animate-spin" size={24} /> : <Upload size={24} />}
        Process PDF
      </button>

      {logs.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-500">
            <CheckCircle2 className="text-green-600" size={18} />
            Log
          </h3>
          <ul className="space-y-2 text-sm text-gray-700 font-mono">
            {logs.map((l, i) => (
              <li key={i} className="flex gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-gray-400" />
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Local dev: run <code className="rounded bg-gray-100 px-1">vercel dev</code> or deploy to Vercel so{' '}
        <code className="rounded bg-gray-100 px-1">/api/admin/parse-section-pdf</code> is available.
      </p>
    </div>
  );
}
