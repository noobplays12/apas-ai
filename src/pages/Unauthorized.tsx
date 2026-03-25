import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFF] p-6 text-center">
      <div className="mb-8 rounded-full bg-red-100 p-8 text-red-500 shadow-xl shadow-red-100">
        <ShieldAlert size={64} />
      </div>
      <h1 className="text-4xl font-black text-gray-900">Access Denied</h1>
      <p className="mt-4 max-w-md text-lg text-gray-500">
        You don't have the required permissions to access this page. Please contact your administrator if you believe this is an error.
      </p>
      <Link
        to="/"
        className="mt-10 flex items-center gap-2 rounded-2xl bg-[#0A66FF] px-8 py-4 font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-[#0052D9] active:scale-95"
      >
        <ArrowLeft size={20} />
        Back to Dashboard
      </Link>
    </div>
  );
}
