import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, Attendance } from '../types';
import { mapAttendanceRow } from '../lib/supabaseMappers';
import { 
  History, 
  Calendar, 
  Filter, 
  Download,
  CheckCircle2,
  XCircle,
  Search
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { toDate } from '../lib/time';

interface AttendanceHistoryProps {
  user: UserProfile;
}

export default function AttendanceHistory({ user }: AttendanceHistoryProps) {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!user.uid) return;
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', user.uid)
          .order('timestamp', { ascending: false });
        if (error) throw error;
        setAttendance((data ?? []).map((r: any) => mapAttendanceRow(r)));
      } catch (e) {
        console.error('Attendance history fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [user.uid]);

  const filteredAttendance = filter === 'all' 
    ? attendance 
    : attendance.filter(a => a.status === filter);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0A66FF] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance History</h1>
          <p className="text-gray-500">Track your presence across all subjects.</p>
        </div>
        <button className="flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95">
          <Download size={20} />
          Export PDF
        </button>
      </header>

      <div className="rounded-3xl bg-white p-8 shadow-sm shadow-blue-50">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by subject or date..." 
              className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 pl-12 text-sm font-medium transition-all focus:border-[#0A66FF] focus:bg-white focus:ring-1 focus:ring-[#0A66FF]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#0A66FF]"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-bold uppercase tracking-wider text-gray-400">
                <th className="pb-4 pl-4">Subject</th>
                <th className="pb-4">Date</th>
                <th className="pb-4">Time</th>
                <th className="pb-4">Status</th>
                <th className="pb-4">Verification</th>
                <th className="pb-4 text-right pr-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredAttendance.length > 0 ? (
                filteredAttendance.map((record) => (
                  <tr key={record.id} className="group transition-all hover:bg-gray-50/50">
                    <td className="py-4 pl-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-blue-50 p-2 text-[#0A66FF]">
                          <Calendar size={18} />
                        </div>
                        <span className="font-bold text-gray-900">Subject Name</span>
                      </div>
                    </td>
                    <td className="py-4 text-gray-600">
                      {(() => {
                        const d = toDate(record.timestamp);
                        return d ? d.toLocaleDateString() : '—';
                      })()}
                    </td>
                    <td className="py-4 text-gray-500">
                      {(() => {
                        const d = toDate(record.timestamp);
                        return d ? d.toLocaleTimeString() : '—';
                      })()}
                    </td>
                    <td className="py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
                        record.status === 'present' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                      )}>
                        {record.status === 'present' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {record.status}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <div className={cn("h-1.5 w-1.5 rounded-full", record.verified ? "bg-green-500" : "bg-red-500")}></div>
                        <span className="text-xs text-gray-500">{record.verified ? 'Verified' : 'Unverified'}</span>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <button className="text-xs font-bold text-[#0A66FF] hover:underline">View</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">No attendance records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
