export default function MissingSupabaseEnv() {
  return (
    <div className="min-h-screen bg-[#F8FAFF] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-[2.5rem] bg-white p-10 shadow-xl shadow-blue-900/5 border border-gray-100">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Supabase is not configured</h1>
        <p className="mt-4 text-gray-600 font-medium leading-relaxed">
          This app needs <span className="font-black">VITE_SUPABASE_URL</span> and{' '}
          <span className="font-black">VITE_SUPABASE_ANON_KEY</span> in <span className="font-black">.env.local</span>.
        </p>

        <div className="mt-6 rounded-2xl bg-gray-50 border border-gray-200 p-4">
          <p className="text-sm font-black text-gray-800">Fix (local)</p>
          <ol className="mt-2 list-decimal pl-5 text-sm text-gray-700 space-y-1">
            <li>Open <span className="font-mono font-bold">.env.local</span> in the project root.</li>
            <li>Paste your Supabase Project URL and Anon key.</li>
            <li>Restart the dev server.</li>
          </ol>
        </div>

        <div className="mt-6">
          <p className="text-sm font-black text-gray-800">Example</p>
          <pre className="mt-2 overflow-auto rounded-2xl bg-[#0B1020] p-4 text-xs text-white">
{`VITE_SUPABASE_URL="https://xxxxxxxxxxxxxxxx.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`}
          </pre>
        </div>
      </div>
    </div>
  );
}

