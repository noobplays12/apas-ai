import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { UserProfile } from '../types';
import {
  GraduationCap, UserPlus, Search,
  Loader2, X, Upload, User, ChevronDown, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { buildStudentPassword } from '../lib/studentCredentials';

interface StudentManagementProps { user: UserProfile; }

type AddMode = 'choose' | 'single' | 'bulk';

export default function StudentManagement({ user: _user }: StudentManagementProps) {
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [sections, setSections] = useState<{ id: string; section_name: string; semester_name?: string }[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('choose');
  const [singleForm, setSingleForm] = useState({ name: '', rollNo: '', sectionId: '' });
  const [saving, setSaving] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('section_students')
      .select('roll_no, full_name, section_id, sections(section_name, semesters(name))')
      .order('full_name');
    if (error) { toast.error('Failed to load students: ' + error.message); }
    else setStudents(data ?? []);
    setLoading(false);
  };

  const fetchSections = async () => {
    const { data } = await supabase
      .from('sections')
      .select('id, section_name, semesters(name)')
      .order('section_name');
    setSections((data ?? []).map((s: any) => ({
      id: s.id,
      section_name: s.section_name,
      semester_name: s.semesters?.name,
    })));
  };

  useEffect(() => { fetchStudents(); fetchSections(); }, []);

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchName = (s.full_name ?? '').toLowerCase().includes(q);
    const matchRoll = (s.roll_no ?? '').toLowerCase().includes(q);
    const matchSection = !filterSection || s.section_id === filterSection;
    return (matchName || matchRoll) && matchSection;
  });

  const handleAddSingle = async () => {
    if (!singleForm.name.trim() || !singleForm.rollNo.trim() || !singleForm.sectionId) {
      toast.error('Please fill in all fields'); return;
    }
    setSaving(true);
    try {
      const rollNo = singleForm.rollNo.trim().toUpperCase();
      const { error: ssErr } = await supabase.from('section_students').upsert({
        roll_no: rollNo, full_name: singleForm.name.trim(), section_id: singleForm.sectionId,
      }, { onConflict: 'section_id,roll_no' });
      if (ssErr) throw ssErr;

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (token) {
        await fetch('/api/admin/sync-student-logins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
      }
      toast.success(`Student ${singleForm.name} added! Password: ${buildStudentPassword(singleForm.name, rollNo)}`);
      setShowAddModal(false); setSingleForm({ name: '', rollNo: '', sectionId: '' });
      fetchStudents();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to add student');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#003399]">Administrative Tools</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-900">Student Registry</h1>
          <p className="mt-1 text-sm font-medium text-gray-400">
            {loading ? '…' : `${students.length} students across ${sections.length} sections`}
          </p>
        </div>
        <button
          onClick={() => { setAddMode('choose'); setShowAddModal(true); }}
          className="flex items-center gap-3 rounded-xl bg-[#003399] px-7 py-4 text-sm font-bold text-white shadow-lg transition-all hover:bg-[#002266] active:scale-95"
        >
          <UserPlus size={20} />
          Add New Student
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or roll number…"
            className="w-full rounded-2xl border border-gray-100 bg-white py-3.5 pl-11 pr-4 text-sm font-bold shadow-sm focus:border-[#003399] focus:outline-none"
          />
        </div>
        <div className="relative">
          <select
            value={filterSection} onChange={e => setFilterSection(e.target.value)}
            className="appearance-none rounded-2xl border border-gray-100 bg-white py-3.5 pl-4 pr-10 text-sm font-bold shadow-sm focus:border-[#003399] focus:outline-none"
          >
            <option value="">All Sections</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>{s.semester_name ? `${s.semester_name} — ${s.section_name}` : s.section_name}</option>
            ))}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        {(search || filterSection) && (
          <button onClick={() => { setSearch(''); setFilterSection(''); }}
            className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 text-sm font-bold text-gray-500 shadow-sm hover:bg-gray-50">
            <X size={16} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#003399]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-8 py-20 text-center">
            <GraduationCap size={48} className="mx-auto mb-4 text-gray-200" />
            <p className="text-xl font-black text-gray-400">No students found</p>
            <p className="mt-1 text-sm font-medium text-gray-400">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/60">
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Roll No</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Name</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Section</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Semester</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Login Password</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((s) => (
                  <tr key={s.roll_no + s.section_id} className="transition-all hover:bg-gray-50/60">
                    <td className="px-6 py-4 text-sm font-black text-[#003399]">{s.roll_no}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{s.full_name}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-500">{(s.sections as any)?.section_name ?? '—'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-500">{(s.sections as any)?.semesters?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-400">{buildStudentPassword(s.full_name, s.roll_no)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-8 shadow-2xl">

              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-900">
                  {addMode === 'choose' ? 'Add Student(s)' : addMode === 'single' ? 'Add Single Student' : 'Upload Section'}
                </h2>
                <button onClick={() => setShowAddModal(false)} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100"><X size={20} /></button>
              </div>

              {addMode === 'choose' && (
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setAddMode('single')}
                    className="flex flex-col items-center gap-4 rounded-2xl border-2 border-gray-100 p-8 text-center transition-all hover:border-[#003399] hover:bg-blue-50/30">
                    <div className="rounded-2xl bg-blue-50 p-4 text-[#003399]"><User size={32} /></div>
                    <div>
                      <p className="text-lg font-black text-gray-900">Single Student</p>
                      <p className="mt-1 text-sm font-medium text-gray-400">Add one student manually</p>
                    </div>
                  </button>
                  <button onClick={() => { setShowAddModal(false); navigate('/admin/upload-sections'); }}
                    className="flex flex-col items-center gap-4 rounded-2xl border-2 border-gray-100 p-8 text-center transition-all hover:border-[#003399] hover:bg-blue-50/30">
                    <div className="rounded-2xl bg-blue-50 p-4 text-[#003399]"><Upload size={32} /></div>
                    <div>
                      <p className="text-lg font-black text-gray-900">Whole Section</p>
                      <p className="mt-1 text-sm font-medium text-gray-400">Upload Excel/CSV roster</p>
                    </div>
                  </button>
                </div>
              )}

              {addMode === 'single' && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gray-400">Full Name</label>
                    <input value={singleForm.name} onChange={e => setSingleForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. MUHAMMAD ALI"
                      className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold focus:border-[#003399] focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gray-400">Roll Number</label>
                    <input value={singleForm.rollNo} onChange={e => setSingleForm(f => ({ ...f, rollNo: e.target.value.toUpperCase() }))}
                      placeholder="e.g. F25BARIN1M01300"
                      className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold font-mono focus:border-[#003399] focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-gray-400">Section</label>
                    <select value={singleForm.sectionId} onChange={e => setSingleForm(f => ({ ...f, sectionId: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-bold focus:border-[#003399] focus:outline-none">
                      <option value="">Select section…</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>{s.semester_name ? `${s.semester_name} — ${s.section_name}` : s.section_name}</option>
                      ))}
                    </select>
                  </div>
                  {singleForm.name && singleForm.rollNo && (
                    <div className="rounded-2xl bg-blue-50 p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-[#003399]">Generated Credentials</p>
                      <p className="mt-1 text-sm font-bold text-gray-700">Roll: <span className="font-mono">{singleForm.rollNo}</span></p>
                      <p className="text-sm font-bold text-gray-700">Password: <span className="font-mono">{buildStudentPassword(singleForm.name, singleForm.rollNo)}</span></p>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setAddMode('choose')} className="flex-1 rounded-2xl border border-gray-100 py-4 text-sm font-bold text-gray-600 hover:bg-gray-50">Back</button>
                    <button onClick={handleAddSingle} disabled={saving}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#003399] py-4 text-sm font-bold text-white hover:bg-[#002266] disabled:opacity-60">
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      {saving ? 'Adding…' : 'Add Student'}
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
