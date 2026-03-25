import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, seedDemoData } from '../firebase';
import { Class, UserProfile } from '../types';
import { BookOpen, PlusCircle, Search, Filter, MoreHorizontal, Users, Clock, Loader2, DatabaseBackup } from 'lucide-react';
import { toast } from 'sonner';

interface ClassManagementProps {
  user: UserProfile;
}

export default function ClassManagement({ user }: ClassManagementProps) {
  const [classes, setClasses] = useState<any[]>([]);
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
    const fetchClasses = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, 'classes'));
        const classesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setClasses(classesData);
      } catch (error: any) {
        console.error('Error fetching classes:', error);
        toast.error('Failed to load courses: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchClasses();
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
            Course Catalog.
          </h1>
        </div>
        <button className="flex items-center justify-center gap-3 rounded-xl bg-[#003399] px-8 py-5 text-lg font-bold text-white shadow-xl shadow-blue-900/20 transition-all hover:bg-[#002266] active:scale-95">
          <PlusCircle size={24} />
          Create New Course
        </button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by course name or ID..." 
            className="w-full rounded-2xl border border-gray-100 bg-white py-4 pl-12 pr-4 text-sm font-bold text-gray-900 shadow-sm focus:border-[#003399] focus:outline-none"
          />
        </div>
        <button className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-6 py-4 text-sm font-bold text-gray-600 shadow-sm hover:bg-gray-50">
          <Filter size={20} />
          Filters
        </button>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        {classes.length === 0 ? (
          <div className="col-span-2 rounded-[2.5rem] bg-gray-50 p-20 text-center">
            <BookOpen size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-xl font-black text-gray-400">No courses found.</p>
            <p className="mt-2 text-sm font-bold text-gray-400 mb-8">Please seed demo data to populate the catalog.</p>
            <button 
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#003399] px-8 py-4 text-sm font-bold text-white shadow-lg transition-all hover:bg-[#002266] disabled:opacity-50"
            >
              <DatabaseBackup size={18} className={seeding ? 'animate-spin' : ''} />
              {seeding ? 'Seeding...' : 'Seed Demo Data Now'}
            </button>
          </div>
        ) : (
          classes.map((course) => (
            <div key={course.id} className="group relative overflow-hidden rounded-[2.5rem] bg-white p-10 shadow-sm border border-gray-50 transition-all hover:shadow-xl hover:shadow-blue-900/5">
              <div className="flex items-start justify-between">
                <div className="rounded-2xl bg-blue-50 p-4 text-[#003399]">
                  <BookOpen size={24} />
                </div>
                <button className="rounded-xl p-2 text-gray-300 hover:bg-gray-50">
                  <MoreHorizontal size={20} />
                </button>
              </div>
              
              <div className="mt-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{course.id}</p>
                <h3 className="mt-1 text-2xl font-black text-gray-900 tracking-tight">{course.name}</h3>
                <p className="mt-2 text-sm font-bold text-gray-500">{course.section ? `Section ${course.section}` : 'No Section'}</p>
              </div>

              <div className="mt-10 flex items-center justify-between border-t border-gray-50 pt-8">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-gray-400" />
                  <span className="text-xs font-black text-gray-900">Active Course</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
