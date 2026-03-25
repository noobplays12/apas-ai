import { useState } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { Upload, Loader2, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { useHasRealSupabaseSession } from '../lib/useSupabaseSessionRequired';

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

export default function AdminUploadTimetable({ user: _user }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [defaultSemesterName, setDefaultSemesterName] = useState('');
  const [defaultSectionName, setDefaultSectionName] = useState('');
  const hasRealSession = useHasRealSupabaseSession();

  const runUpload = async () => {
    if (!file) {
      toast.error('Choose an Excel file');
      return;
    }
    setUploading(true);
    setLogs([]);
    try {
      const buf = await file.arrayBuffer();
      const fileBase64 = bufferToBase64(buf);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');

      const res = await fetch('/api/admin/parse-timetable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileBase64,
          fileName: file.name,
          semesterName: defaultSemesterName.trim() || undefined,
          sectionName: defaultSectionName.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      setLogs([
        `Inserted: ${json.inserted}`,
        `Rows in sheet: ${json.rowCount}`,
        ...(json.errors || []).slice(0, 30),
      ]);
      toast.success('Timetable processed');
    } catch (e: any) {
      toast.error(e.message || 'Failed');
      setLogs([e.message || 'Error']);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-black text-gray-900">Upload timetable (Excel)</h1>
        <p className="mt-2 text-gray-500">
          Supports IUB-style sheets: <strong>COURSE_CODE</strong>, <strong>TEACHER</strong> (name as in your directory),{' '}
          <strong>DAY</strong> (MON/TUE/…), <strong>START TIME</strong> / <strong>END TIME</strong> (12h with AM/PM). Add{' '}
          <strong>teacher_email</strong> column if you prefer email matching. Every <strong>course code</strong> must exist in{' '}
          <em>Subjects</em>. Optional: set default semester/section below if the sheet only has them in a header row.
        </p>
      </div>

      {hasRealSession === false && (
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">
            Dev bypass has no API token. Sign out and log in with your <strong>admin email + password</strong> to import.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <label className="text-xs font-black uppercase tracking-widest text-gray-400">Default semester name (optional)</label>
          <input
            value={defaultSemesterName}
            onChange={(e) => setDefaultSemesterName(e.target.value)}
            placeholder='e.g. BS (AI) Morning 1st Semester'
            className="mt-2 w-full rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm font-bold"
          />
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <label className="text-xs font-black uppercase tracking-widest text-gray-400">Default section (optional)</label>
          <input
            value={defaultSectionName}
            onChange={(e) => setDefaultSectionName(e.target.value)}
            placeholder="e.g. BSARIN-1ST-2M"
            className="mt-2 w-full rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm font-bold"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 text-[#003399] mb-4">
          <FileSpreadsheet size={28} />
          <span className="font-black">.xlsx / .xls</span>
        </div>
        <input
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm font-bold"
        />
        {file && <p className="mt-4 text-sm font-bold text-gray-600">{file.name}</p>}
      </div>

      <button
        type="button"
        disabled={uploading || !file}
        onClick={runUpload}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#003399] py-5 text-lg font-black text-white shadow-lg disabled:opacity-60"
      >
        {uploading ? <Loader2 className="animate-spin" size={24} /> : <Upload size={24} />}
        Import timetable
      </button>

      {logs.length > 0 && (
        <pre className="rounded-2xl bg-gray-900 p-6 text-xs text-green-400 overflow-auto max-h-96">{logs.join('\n')}</pre>
      )}
    </div>
  );
}
