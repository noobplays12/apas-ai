import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, seedDemoData } from '../firebase';
import { UserProfile } from '../types';
import { GraduationCap, UserPlus, Search, Filter, MoreHorizontal, Loader2, DatabaseBackup } from 'lucide-react';
import { toast } from 'sonner';

interface StudentManagementProps {
  user: UserProfile;
}

export default function StudentManagement({ user }: StudentManagementProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    try {
      setSeeding(true);
      toast.info('Seeding demo data...');
      await seedDemoData();
      toast.success('Demo data seeded successfully!');
      window.location.reload();
    } catch (error: any) {
      toast.error('Seeding failed: ' + error.message);
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const q = query(collection(db, 'users'), where('role', '==', 'student'));
        const querySnapshot = await getDocs(q);
        const studentsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setStudents(studentsData);
      } catch (error: any) {
        console.error('Error fetching students:', error);
        toast.error('Failed to load students: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#003399]" />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12 font-sans">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#003399]">
            Administrative Tools
          </p>
          <h1 className="mt-2 text-5xl font-black tracking-tight text-gray-900">
            Student Registry.
          </h1>
        </div>
        <button className="flex items-center justify-center gap-3 rounded-xl bg-[#003399] px-8 py-5 text-lg font-bold text-white shadow-xl shadow-blue-900/20 transition-all hover:bg-[#002266] active:scale-95">
          <UserPlus size={24} />
          Add New Student
        </button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by name, ID or email..." 
            className="w-full rounded-2xl border border-gray-100 bg-white py-4 pl-12 pr-4 text-sm font-bold text-gray-900 shadow-sm focus:border-[#003399] focus:outline-none"
          />
        </div>
        <button className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-6 py-4 text-sm font-bold text-gray-600 shadow-sm hover:bg-gray-50">
          <Filter size={20} />
          Filters
        </button>
      </div>

      <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-sm border border-gray-50">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/50">
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Student ID</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Name</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Email</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Attendance</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-8 py-20 text-center">
                  <GraduationCap size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-xl font-black text-gray-400">No students found.</p>
                  <p className="mt-2 text-sm font-bold text-gray-400 mb-8">Please seed demo data to populate the registry.</p>
                  <button 
                    onClick={handleSeed}
                    disabled={seeding}
                    className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#003399] px-8 py-4 text-sm font-bold text-white shadow-lg transition-all hover:bg-[#002266] disabled:opacity-50"
                  >
                    <DatabaseBackup size={18} className={seeding ? 'animate-spin' : ''} />
                    {seeding ? 'Seeding...' : 'Seed Demo Data Now'}
                  </button>
                </td>
              </tr>
            ) : (
              students.map((student) => {
                const status = student.status ?? 'Active';
                return (
                <tr key={student.id} className="border-b border-gray-50 transition-all hover:bg-gray-50/50">
                  <td className="px-8 py-6 text-sm font-black text-gray-900">{student.id.substring(0, 8)}...</td>
                  <td className="px-8 py-6 text-sm font-bold text-gray-900">{student.name}</td>
                  <td className="px-8 py-6 text-sm font-bold text-gray-400">{student.email}</td>
                  <td className="px-8 py-6 text-sm font-black text-[#003399]">{student.attendanceRate || '0%'}</td>
                  <td className="px-8 py-6">
                    <span className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                      status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <button className="rounded-xl p-2 text-gray-400 hover:bg-gray-100">
                      <MoreHorizontal size={20} />
                    </button>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
