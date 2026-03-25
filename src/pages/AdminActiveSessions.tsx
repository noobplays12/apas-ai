import { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../supabaseClient';
import { Activity, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  user: UserProfile;
}

type Row = {
  id: string;
  subject_id: string;
  teacher_id: string;
  semester_id: string | null;
  section_id: string | null;
  semesters?: { name: string } | { name: string }[] | null;
  sections?: { section_name: string } | { section_name: string }[] | null;
};

function relOne<T>(v: T | T[] | null | undefined): T | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default function AdminActiveSessions({ user: _user }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [semesterFilter, setSemesterFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [semesters, setSemesters] = useState<{ id: string; name: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; section_name: string; semester_id: string }[]>([]);

  useEffect(() => {
    supabase.from('semesters').select('id,name').then(({ data }) => setSemesters(data ?? []));
    supabase.from('sections').select('id,section_name,semester_id').then(({ data }) => setSections(data ?? []));
  }, []);

  useEffect(() => {
    const load = async () => {
      let q = supabase
        .from('sessions')
        .select(
          `
          id,
          subject_id,
          teacher_id,
          semester_id,
          section_id,
          semesters ( name ),
          sections ( section_name )
        `
        )
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (semesterFilter) q = q.eq('semester_id', semesterFilter);
      if (sectionFilter) q = q.eq('section_id', sectionFilter);
      const { data, error } = await q;
      if (error) {
        console.error(error);
        return;
      }
      setRows((data ?? []) as unknown as Row[]);
    };
    load();
  }, [semesterFilter, sectionFilter]);

  const sectionOptions = semesterFilter ? sections.filter((s) => s.semester_id === semesterFilter) : sections;

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Active sessions</h1>
          <p className="text-gray-500">Monitor all live attendance sessions across the department.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={18} className="text-gray-400" />
          <select
            value={semesterFilter}
            onChange={(e) => {
              setSemesterFilter(e.target.value);
              setSectionFilter('');
            }}
            className="rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-bold"
          >
            <option value="">All semesters</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-bold"
          >
            <option value="">All sections</option>
            {sectionOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.section_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs font-black uppercase tracking-widest text-gray-500">
            <tr>
              <th className="px-6 py-4">Subject</th>
              <th className="px-6 py-4">Semester / Section</th>
              <th className="px-6 py-4">Teacher id</th>
              <th className="px-6 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-gray-50">
                <td className="px-6 py-4 font-bold">{s.subject_id}</td>
                <td className="px-6 py-4 text-gray-600">
                  {(relOne(s.semesters) as { name?: string } | undefined)?.name ?? '—'} /{' '}
                  {(relOne(s.sections) as { section_name?: string } | undefined)?.section_name ?? '—'}
                </td>
                <td className="px-6 py-4 font-mono text-xs">{s.teacher_id.slice(0, 8)}…</td>
                <td className="px-6 py-4">
                  <Link
                    to={`/live-attendance/${s.id}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2 text-xs font-black text-green-700"
                  >
                    <Activity size={14} />
                    Live
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-bold">
                  No active sessions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
