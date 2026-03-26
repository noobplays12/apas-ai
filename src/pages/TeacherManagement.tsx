import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile } from '../types';
import {
  Users, UserPlus, Search, MoreHorizontal, Loader2,
  X, Upload, User, ChevronDown, CheckCircle2, ToggleLeft, ToggleRight, FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

interface TeacherManagementProps { user: UserProfile; }
type AddMode = 'choose' | 'single' | 'bulk';

export default function TeacherManagement({ user: _user }: TeacherManagementProps) {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('choose');
  const [saving, setSaving] = useState(false);
  const [singleForm, setSingleForm] = useState({ name: '', email: '', department: '' });
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkRows, setBulkRows] = useState<{ name: string; email: string; department: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchTeachers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('id,name,email,created_at').eq('role', 'teacher').order('name');
    if (error) toast.error('Failed to load faculty: ' + error.message);
    else setTeachers(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTeachers(); }, []);

  const filtered = teachers.filter(t => {
    const q = search.toLowerCase();
    const dept = (t.department ?? t.metadata_department ?? '').toLowerCase();
    return (t.name ?? '').toLowerCase().includes(q) || (t.email ?? '').toLowerCase().includes(q) || dept.includes(q);
  });

  const toggleActive = async (teacher: any) => {
    const newVal = !(teacher._active ?? true);
    const token = await getToken();
    const res = await fetch('/api/admin/toggle-teacher-active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ teacherId: teacher.id, active: newVal }),
    });
    if (!res.ok) { toast.error('Failed to update status'); return; }
    setTeachers(ts => ts.map(t => t.id === teacher.id ? { ...t, _active: newVal } : t));
    toast.success(`${teacher.name} marked ${newVal ? 'Active' : 'Inactive'}`);
  };

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const callCreateTeacher = async (name: string, email: string, department: string) => {
    const res = await fetch('/api/admin/create-teacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
      body: JSON.stringify({ name: name.trim(), email: email.toLowerCase().trim(), department: department.trim() }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? `Server ${res.status}`);
    }
    return res.json();
  };

  const handleAddSingle = async () => {
    if (!singleForm.name.trim() || !singleForm.email.trim()) { toast.error('Name and email are required'); return; }
    setSaving(true);
    try {
      await callCreateTeacher(singleForm.name, singleForm.email, singleForm.department);
      toast.success(`Faculty ${singleForm.name} added! Default password: Faculty@2025!`);
      setShowModal(false); setSingleForm({ name: '', email: '', department: '' });
      fetchTeachers();
    } catch (e: any) { toast.error(e.message ?? 'Failed to add faculty'); }
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
        name: String(r['Name'] ?? r['name'] ?? r['TEACHER'] ?? '').trim(),
        email: String(r['Email'] ?? r['email'] ?? r['EMAIL'] ?? '').trim().toLowerCase(),
        department: String(r['Department'] ?? r['department'] ?? r['DEPT'] ?? '').trim(),
      })).filter(r => r.name && r.email);
      setBulkRows(rows);
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkUpload = async () => {
    if (!bulkRows.length) { toast.error('No valid rows found in file'); return; }
    setSaving(true);
    let succeeded = 0; let failed = 0;
    const token = await getToken();
    for (const row of bulkRows) {
      try {
        const res = await fetch('/api/admin/create-teacher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(row),
        });
        if (res.ok) succeeded++; else failed++;
      } catch { failed++; }
    }
    toast.success(`Imported: ${succeeded} added${failed ? `, ${failed} failed` : ''}`);
    setShowModal(false); setBulkFile(null); setBulkRows([]);
    fetchTeachers();
    setSaving(false);
  };

  return (
    <div className="space-y-8 pb-12 font-sans">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#003399]">Administrative Tools</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-900">Faculty Registry</h1>
          <p className="mt-1 text-sm font-medium text-gray-400">{loading ? '…' : `${teachers.length} faculty members`}</p>
        </div>
        <button onClick={() => { setAddMode('choose'); setShowModal(true); }}
          className="flex items-center gap-3 rounded-xl bg-[#003399] px-7 py-4 text-sm font-bold text-white shadow-lg transition-all hover:bg-[#002266] active:scale-95">
          <UserPlus size={20} /> Add New Faculty
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or department…"
            className="w-full rounded-2xl border border-gray-100 bg-white py-3.5 pl-11 pr-4 text-sm font-bold shadow-sm focus:border-[#003399] focus:outline-none" />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#003399]" /></div>
        ) : filtered.length === 0 ? (
          <div className="px-8 py-20 text-center">
            <Users size={48} className="mx-auto mb-4 text-gray-200" />
            <p className="text-xl font-black text-gray-400">No faculty found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/60">
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Name</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Email</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Department</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(t => {
                  const isActive = t._active !== false;
                  const dept = t.department ?? t.metadata_department ?? null;
                  return (
                    <tr key={t.id} className="transition-all hover:bg-gray-50/60">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{t.name}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-500">{t.email}</td>
                      <td className="px-6 py-4 text-sm font-bold text-[#003399]">{dept || <span className="text-gray-300">—</span>}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest ${isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => toggleActive(t)} className="text-gray-400 transition-colors hover:text-[#003399]" title="Toggle active status">
                          {isActive ? <ToggleRight size={28} className="text-green-500" /> : <ToggleLeft size={28} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                  {addMode === 'choose' ? 'Add Faculty' : addMode === 'single' ? 'Add Single Faculty' : 'Bulk Import Faculty'}
                </h2>
                <button onClick={() => setShowModal(false)} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100"><X size={20} /></button>
              </div>

              {addMode === 'choose' && (
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setAddMode('single')}
                    className="flex flex-col items-center gap-4 rounded-2xl border-2 border-gray-100 p-8 text-center transition-all hover:border-[#003399] hover:bg-blue-50/30">
                    <div className="rounded-2xl bg-blue-50 p-4 text-[#003399]"><User size={32} /></div>
                    <div><p className="text-lg font-black text-gray-900">Single Faculty</p><p className="mt-1 text-sm text-gray-400">Add one teacher manually</p></div>
                  </button>
                  <button onClick={() => setAddMode('bulk')}
                    className="flex flex-col items-center gap-4 rounded-2xl border-2 border-gray-100 p-8 text-center transition-all hover:border-[#003399] hover:bg-blue-50/30">
                    <div className="rounded-2xl bg-blue-50 p-4 text-[#003399]"><FileSpreadsheet size={32} /></div>
                    <div><p className="text-lg font-black text-gray-900">Bulk Import</p><p className="mt-1 text-sm text-gray-400">Upload Excel/CSV file</p></div>
                  </button>
                </div>
              )}

              {addMode === 'single' && (
                <div className="space-y-4">
                  {['name', 'email', 'department'].map(field => (
                    <div key={field}>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gray-400">{field === 'department' ? 'Department (optional)' : field}</label>
                      <input value={(singleForm as any)[field]} onChange={e => setSingleForm(f => ({ ...f, [field]: e.target.value }))}
                        placeholder={field === 'email' ? 'teacher@university.edu' : field === 'name' ? 'Dr. Ali Khan' : 'Computer Science'}
                        className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold focus:border-[#003399] focus:outline-none" />
                    </div>
                  ))}
                  <p className="rounded-2xl bg-amber-50 p-4 text-xs font-bold text-amber-700">Default password: <span className="font-mono">Faculty@2025!</span> (teacher can change after first login)</p>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setAddMode('choose')} className="flex-1 rounded-2xl border border-gray-100 py-4 text-sm font-bold text-gray-600 hover:bg-gray-50">Back</button>
                    <button onClick={handleAddSingle} disabled={saving}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#003399] py-4 text-sm font-bold text-white hover:bg-[#002266] disabled:opacity-60">
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      {saving ? 'Adding…' : 'Add Faculty'}
                    </button>
                  </div>
                </div>
              )}

              {addMode === 'bulk' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">Upload an Excel/CSV file with columns: <strong>Name</strong>, <strong>Email</strong>, <strong>Department</strong></p>
                  <div onClick={() => fileRef.current?.click()}
                    className="cursor-pointer rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center transition-all hover:border-[#003399] hover:bg-blue-50/20">
                    <Upload className="mx-auto mb-3 text-gray-400" size={32} />
                    <p className="font-bold text-gray-600">{bulkFile ? bulkFile.name : 'Click to select Excel/CSV file'}</p>
                    {bulkRows.length > 0 && <p className="mt-2 text-sm font-bold text-green-600">{bulkRows.length} records ready to import</p>}
                  </div>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleBulkFile(f); }} />
                  {bulkRows.length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      {bulkRows.slice(0, 10).map((r, i) => (
                        <div key={i} className="text-xs font-medium text-gray-600 py-1 border-b border-gray-100 last:border-0">
                          {r.name} — {r.email} {r.department ? `(${r.department})` : ''}
                        </div>
                      ))}
                      {bulkRows.length > 10 && <p className="text-xs text-gray-400 pt-2">+{bulkRows.length - 10} more…</p>}
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setAddMode('choose')} className="flex-1 rounded-2xl border border-gray-100 py-4 text-sm font-bold text-gray-600 hover:bg-gray-50">Back</button>
                    <button onClick={handleBulkUpload} disabled={saving || !bulkRows.length}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#003399] py-4 text-sm font-bold text-white hover:bg-[#002266] disabled:opacity-60">
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {saving ? 'Importing…' : `Import ${bulkRows.length} Faculty`}
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
