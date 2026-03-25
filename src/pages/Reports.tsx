import { UserProfile } from '../types';
import { FileText, Download, Filter, Search } from 'lucide-react';

export default function Reports({ user }: { user: UserProfile }) {
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance Reports</h1>
          <p className="text-gray-500">Generate and export detailed attendance analytics.</p>
        </div>
        <button className="flex items-center justify-center gap-2 rounded-2xl bg-[#0A66FF] px-6 py-3 font-semibold text-white shadow-lg shadow-blue-200 transition-all hover:bg-[#0052D9] active:scale-95">
          <Download size={20} />
          Export Reports
        </button>
      </header>
      <div className="rounded-3xl bg-white p-12 text-center shadow-sm shadow-blue-50">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50 text-[#0A66FF]">
          <FileText size={40} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">No Reports Generated</h2>
        <p className="mt-2 text-gray-500">Select a class and date range to generate a report.</p>
      </div>
    </div>
  );
}
