import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Class, UserProfile } from '../types';
import {
  BookOpen, PlusCircle, Search, Filter, MoreHorizontal,
  Loader2, X, Upload, FileSpreadsheet, CheckCircle2, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

interface ClassManagementProps { user: UserProfile; }
type AddMode = 'choose' | 'single' | 'bulk';

export default function ClassManagement({ user: _user }: ClassManagementProps) {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('choose');
  const [saving, setSaving] = useState(false);
  const [singleForm, setSingleForm] = useState({ code: '', name: '', department: '', credits: '3' });
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkRows, setBulkRows] = useState<{ code: string; name: string; department: string; credits: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCourses = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('subjects').select('id,code,name,department,credits,created_at').order('name');
    if (error) {
      console.warn('subjects table error, trying courses:', error.message);
      const { data: d2, error: e2 } = await supabase.from('courses').select('*').order('name');
      if (e2) toast.error('Failed to load courses');
      else setCourses(d2 ?? []);
    } else {
      setCourses(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCourses(); }, []);

  const filtered = courses.filter(c => {
    const q = search.toLowerCase();
    return (c.name ?? '').toLowerCase().includes(q) || (c.code ?? '').toLowerCase().includes(q) || (c.department ?? '').toLowerCase().includes(q);
  });

  const insertCourse = async (row: typeof singleForm) => {
    const payload = { code: row.code.trim().toUpperCase(), name: row.name.trim(), department: row.department.trim() || null, credits: parseInt(row.credits) || 3 };
    const { error } = await supabase.from('subjects').upsert(payload, { onConflict: 'code' });
    if (error) throw error;
  };

  const handleAddSingle = async () => {
    if (!singleForm.code.trim() || !singleForm.name.trim()) { toast.error('Course code and name are required'); return; }
    setSaving(true);
    try {
      await insertCourse(singleForm);
      toast.success(`Course ${singleForm.name} created!`);
      setShowModal(false); setSingleForm({ code: '', name: '', department: '', credits: '3' });
      fetchCourses();
    } catch (e: any) { toast.error(e.message ?? 'Failed to create course'); }
    finally { setSaving(false); }
  };

  const handleBulkFile = (file: File) => {
    setBulkFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target?.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
      const rows = data.map((r: any) => ({
        code: String(r['Code'] ?? r['code'] ?? r['COURSE_CODE'] ?? r['CourseCode'] ?? '').trim().toUpperCase(),
        name: String(r['Name'] ?? r['name'] ?? r['Course Name'] ?? r['CourseName'] ?? '').trim(),
        department: String(r['Department'] ?? r['department'] ?? r['DEPT'] ?? '').trim(),
        credits: String(r['Credits'] ?? r['credits'] ?? '3').trim(),
      })).filter(r => r.code && r.name);
      setBulkRows(rows);
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkUpload = async () => {
    if (!bulkRows.length) { toast.error('No valid rows found'); return; }
    setSaving(true);
    let succeeded = 0; let failed = 0;
    for (const row of bulkRows) {
      try { await insertCourse(row); succeeded++; }
      catch { failed++; }
    }
    toast.success(`Imported: ${succeeded} courses${failed ? `, ${failed} failed` : ''}`);
    setShowModal(false); setBulkFile(null); setBulkRows([]);
    fetchCourses();
    setSaving(false);
  };

  return (
    <div className="space-y-8 pb-12 font-sans">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#003399]">Administrative Tools</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-900">Course Catalog</h1>
          <p className="mt-1 text-sm font-medium text-gray-400">{loading ? '…' : `${courses.length} courses`}</p>
        </div>
        <button onClick={() => { setAddMode('choose'); setShowModal(true); }}
          className="flex items-center gap-3 rounded-xl bg-[#003399] px-7 py-4 text-sm font-bold text-white shadow-lg transition-all hover:bg-[#002266] active:scale-95">
          <PlusCircle size={20} /> Create New Course
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, code or department…"
          className="w-full rounded-2xl border border-gray-100 bg-white py-3.5 pl-11 pr-4 text-sm font-bold shadow-sm focus:border-[#003399] focus:outline-none" />
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#003399]" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl bg-white p-20 text-center border border-gray-100 shadow-sm">
          <BookOpen size={48} className="mx-auto mb-4 text-gray-200" />
          <p className="text-xl font-black text-gray-400">No courses found</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(c => (
            <div key={c.id} className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-sm border border-gray-100 transition-all hover:shadow-xl hover:shadow-blue-900/5">
              <div className="flex items-start justify-between">
                <div className="rounded-2xl bg-blue-50 p-3 text-[#003399]"><BookOpen size={22} /></div>
                <span className="rounded-lg bg-gray-50 px-3 py-1 text-xs font-black text-gray-500">{c.credits ?? 3} Credits</span>
              </div>
              <div className="mt-6">
                <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{c.code ?? c.id}</p>
                <h3 className="mt-1 text-xl font-black text-gray-900 tracking-tight leading-tight">{c.name}</h3>
                {c.department && <p className="mt-2 text-sm font-bold text-[#003399]">{c.department}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-8 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-900">
                  {addMode === 'choose' ? 'Create Course' : addMode === 'single' ? 'Single Course' : 'Bulk Import Courses'}
                </h2>
                <button onClick={() => setShowModal(false)} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100"><X size={20} /></button>
              </div>

              {addMode === 'choose' && (
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setAddMode('single')}
                    className="flex flex-col items-center gap-4 rounded-2xl border-2 border-gray-100 p-8 text-center transition-all hover:border-[#003399] hover:bg-blue-50/30">
                    <div className="rounded-2xl bg-blue-50 p-4 text-[#003399]"><BookOpen size={32} /></div>
                    <div><p className="text-lg font-black text-gray-900">Single Course</p><p className="mt-1 text-sm text-gray-400">Create one course</p></div>
                  </button>
                  <button onClick={() => setAddMode('bulk')}
                    className="flex flex-col items-center gap-4 rounded-2xl border-2 border-gray-100 p-8 text-center transition-all hover:border-[#003399] hover:bg-blue-50/30">
                    <div className="rounded-2xl bg-blue-50 p-4 text-[#003399]"><FileSpreadsheet size={32} /></div>
                    <div><p className="text-lg font-black text-gray-900">Bulk Import</p><p className="mt-1 text-sm text-gray-400">Upload Excel/CSV</p></div>
                  </button>
                </div>
              )}

              {addMode === 'single' && (
                <div className="space-y-4">
                  {[
                    { field: 'code', label: 'Course Code', placeholder: 'e.g. CS-101' },
                    { field: 'name', label: 'Course Name', placeholder: 'e.g. Introduction to Programming' },
                    { field: 'department', label: 'Department (optional)', placeholder: 'e.g. Computer Science' },
                    { field: 'credits', label: 'Credit Hours', placeholder: '3' },
                  ].map(({ field, label, placeholder }) => (
                    <div key={field}>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gray-400">{label}</label>
                      <input value={(singleForm as any)[field]} onChange={e => setSingleForm(f => ({ ...f, [field]: e.target.value }))}
                        placeholder={placeholder} type={field === 'credits' ? 'number' : 'text'}
                        className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold focus:border-[#003399] focus:outline-none" />
                    </div>
                  ))}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setAddMode('choose')} className="flex-1 rounded-2xl border border-gray-100 py-4 text-sm font-bold text-gray-600 hover:bg-gray-50">Back</button>
                    <button onClick={handleAddSingle} disabled={saving}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#003399] py-4 text-sm font-bold text-white hover:bg-[#002266] disabled:opacity-60">
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      {saving ? 'Creating…' : 'Create Course'}
                    </button>
                  </div>
                </div>
              )}

              {addMode === 'bulk' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">Upload Excel/CSV with columns: <strong>Code</strong>, <strong>Name</strong>, <strong>Department</strong>, <strong>Credits</strong></p>
                  <div onClick={() => fileRef.current?.click()}
                    className="cursor-pointer rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center transition-all hover:border-[#003399] hover:bg-blue-50/20">
                    <Upload className="mx-auto mb-3 text-gray-400" size={32} />
                    <p className="font-bold text-gray-600">{bulkFile ? bulkFile.name : 'Click to select file'}</p>
                    {bulkRows.length > 0 && <p className="mt-2 text-sm font-bold text-green-600">{bulkRows.length} courses ready</p>}
                  </div>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleBulkFile(f); }} />
                  {bulkRows.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-1">
                      {bulkRows.slice(0, 8).map((r, i) => (
                        <div key={i} className="text-xs font-medium text-gray-600">{r.code} — {r.name}</div>
                      ))}
                      {bulkRows.length > 8 && <p className="text-xs text-gray-400">+{bulkRows.length - 8} more…</p>}
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setAddMode('choose')} className="flex-1 rounded-2xl border border-gray-100 py-4 text-sm font-bold text-gray-600 hover:bg-gray-50">Back</button>
                    <button onClick={handleBulkUpload} disabled={saving || !bulkRows.length}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#003399] py-4 text-sm font-bold text-white hover:bg-[#002266] disabled:opacity-60">
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {saving ? 'Importing…' : `Import ${bulkRows.length}`}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
