import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile } from '../types';
import {
  FileText, Download, Search, ChevronDown, Loader2,
  BookOpen, Users, BarChart3, CheckCircle2, X
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface ReportRow {
  id: string;
  session_id: string;
  subject_name: string;
  section_name: string | null;
  semester_name: string | null;
  created_at: string;
  total_students: number;
  present_count: number;
}

interface StudentAttRow {
  student_name: string;
  roll_no: string;
  present: number;
  total: number;
  percentage: number;
  lectures: Record<string, 'P' | 'A'>;
}

export default function Reports({ user }: { user: UserProfile }) {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [detail, setDetail] = useState<StudentAttRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [allLectures, setAllLectures] = useState<string[]>([]);

  const fetchReports = async () => {
    setLoading(true);
    const q = supabase
      .from('session_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (user.role === 'teacher') (q as any).eq('teacher_id', user.uid);
    const { data, error } = await q;
    if (error) {
      if (error.code === '42P01') {
        setReports([]);
      } else {
        toast.error('Failed to load reports: ' + error.message);
      }
    } else {
      setReports((data ?? []) as ReportRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, []);

  const openDetail = async (report: ReportRow) => {
    setSelected(report);
    setDetailLoading(true);
    setDetail([]);
    try {
      const { data, error } = await supabase
        .from('session_report_rows')
        .select('*')
        .eq('report_id', report.id)
        .order('student_name');
      if (error) throw error;
      const rows: StudentAttRow[] = (data ?? []).map((r: any) => ({
        student_name: r.student_name,
        roll_no: r.roll_no,
        present: r.present ?? 0,
        total: r.total ?? 0,
        percentage: r.percentage ?? 0,
        lectures: r.lectures ?? {},
      }));
      const lectKeys = Array.from(new Set(rows.flatMap(r => Object.keys(r.lectures)))).sort();
      setAllLectures(lectKeys);
      setDetail(rows);
    } catch (e: any) {
      toast.error('Could not load report details');
    } finally {
      setDetailLoading(false);
    }
  };

  const exportCSV = () => {
    if (!detail.length || !selected) return;
    const headers = ['Roll No', 'Student Name', ...allLectures.map((_,i) => `Lecture ${i+1}`), 'Present', 'Total', 'Percentage'];
    const rows = detail.map(r => [
      r.roll_no, r.student_name,
      ...allLectures.map(k => r.lectures[k] ?? 'A'),
      r.present, r.total, r.percentage + '%'
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${selected.subject_name}-report.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = reports.filter(r => {
    const q = search.toLowerCase();
    return (r.subject_name ?? '').toLowerCase().includes(q) || (r.section_name ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8 pb-12 font-sans">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#003399]">Analytics</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-900">Attendance Reports</h1>
          <p className="mt-1 text-sm font-medium text-gray-400">
            Cumulative attendance reports per session. Generated when a teacher ends a session.
          </p>
        </div>
        {selected && (
          <button onClick={exportCSV}
            className="flex items-center gap-2 rounded-xl bg-[#003399] px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-[#002266] active:scale-95">
            <Download size={18} /> Export CSV
          </button>
        )}
      </div>

      {/* Search */}
      {!selected && (
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by subject or section…"
            className="w-full rounded-2xl border border-gray-100 bg-white py-3.5 pl-11 pr-4 text-sm font-bold shadow-sm focus:border-[#003399] focus:outline-none" />
        </div>
      )}

      {/* Detail View */}
      {selected ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => { setSelected(null); setDetail([]); }}
                className="mb-2 flex items-center gap-2 text-sm font-bold text-[#003399] hover:underline">
                ← Back to Reports
              </button>
              <h2 className="text-2xl font-black text-gray-900">{selected.subject_name}</h2>
              <p className="text-sm font-medium text-gray-400">
                {selected.section_name ?? ''}{selected.semester_name ? ` • ${selected.semester_name}` : ''} •{' '}
                {new Date(selected.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-4 text-center">
              <div className="rounded-2xl bg-blue-50 px-6 py-4">
                <p className="text-3xl font-black text-[#003399]">{selected.present_count}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Present</p>
              </div>
              <div className="rounded-2xl bg-gray-50 px-6 py-4">
                <p className="text-3xl font-black text-gray-900">{selected.total_students}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total</p>
              </div>
            </div>
          </div>

          {detailLoading ? (
            <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#003399]" /></div>
          ) : detail.length === 0 ? (
            <div className="rounded-3xl bg-white p-16 text-center border border-gray-100">
              <FileText size={40} className="mx-auto mb-4 text-gray-200" />
              <p className="font-black text-gray-400">No student rows in this report</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/60">
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap">Roll No</th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Student Name</th>
                      {allLectures.map((k, i) => (
                        <th key={k} className="px-3 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center whitespace-nowrap">
                          L{i + 1}
                        </th>
                      ))}
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Present</th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Total</th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {detail.map(r => {
                      const pct = r.percentage;
                      const color = pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600';
                      return (
                        <tr key={r.roll_no} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3 font-mono text-xs font-bold text-[#003399] whitespace-nowrap">{r.roll_no}</td>
                          <td className="px-5 py-3 font-bold text-gray-900 whitespace-nowrap">{r.student_name}</td>
                          {allLectures.map(k => (
                            <td key={k} className="px-3 py-3 text-center">
                              <span className={`text-xs font-black ${r.lectures[k] === 'P' ? 'text-green-600' : 'text-red-400'}`}>
                                {r.lectures[k] ?? 'A'}
                              </span>
                            </td>
                          ))}
                          <td className="px-5 py-3 text-center font-black text-gray-900">{r.present}</td>
                          <td className="px-5 py-3 text-center font-medium text-gray-400">{r.total}</td>
                          <td className={`px-5 py-3 text-center font-black ${color}`}>{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Report list */
        loading ? (
          <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#003399]" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl bg-white p-20 text-center border border-gray-100 shadow-sm">
            <FileText size={48} className="mx-auto mb-4 text-gray-200" />
            <p className="text-xl font-black text-gray-400">No Reports Yet</p>
            <p className="mt-2 text-sm font-medium text-gray-400">
              Reports are generated when a teacher ends a session and clicks "Generate Report".
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(r => {
              const pct = r.total_students > 0 ? Math.round((r.present_count / r.total_students) * 100) : 0;
              const color = pct >= 75 ? 'bg-green-50 text-green-600' : pct >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600';
              return (
                <button key={r.id} onClick={() => openDetail(r)}
                  className="group text-left rounded-3xl bg-white p-8 border border-gray-100 shadow-sm transition-all hover:shadow-lg hover:shadow-blue-900/5 hover:border-blue-100">
                  <div className="flex items-start justify-between">
                    <div className="rounded-2xl bg-blue-50 p-3 text-[#003399]"><BookOpen size={20} /></div>
                    <span className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest ${color}`}>{pct}%</span>
                  </div>
                  <div className="mt-5">
                    <p className="text-lg font-black text-gray-900 leading-tight">{r.subject_name}</p>
                    <p className="mt-1 text-sm font-medium text-gray-400">
                      {r.section_name ?? 'No Section'}{r.semester_name ? ` — ${r.semester_name}` : ''}
                    </p>
                    <p className="mt-3 text-xs font-bold text-gray-400">{new Date(r.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-gray-50 pt-5">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-gray-400" />
                      <span className="text-xs font-bold text-gray-600">{r.present_count} / {r.total_students} present</span>
                    </div>
                    <span className="text-xs font-black text-[#003399] group-hover:underline">View →</span>
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
