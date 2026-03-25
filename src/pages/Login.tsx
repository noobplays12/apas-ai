import { useState, useEffect } from 'react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { seedDemoData, db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';
import { 
  Fingerprint, 
  ShieldCheck, 
  ArrowRight, 
  Info, 
  Lock, 
  User,
  ShieldAlert,
  Key
} from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [fingerprintStatus, setFingerprintStatus] = useState('Capturing Device Fingerprint...');
  const [isFingerprinted, setIsFingerprinted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      setFingerprintStatus('Device Fingerprint Captured Successfully');
      setIsFingerprinted(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('Logged in successfully!');
      navigate('/');
    } catch (error: any) {
      console.error('Login Error:', error);
      
      const msg = typeof error?.message === 'string' ? error.message : 'Failed to login. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      toast.error('Google login is not enabled in Supabase for this project.');
    } catch (error: any) {
      console.error('Google Login Error:', error);
      toast.error('Google login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBypass = async (role: 'admin' | 'teacher' | 'student') => {
    const profiles = {
      admin: { uid: 'mock_admin', name: 'Dev Admin', email: 'admin@dev.local', role: 'admin', createdAt: { seconds: Date.now()/1000, nanoseconds: 0 } },
      teacher: { uid: 'mock_teacher', name: 'Dev Teacher', email: 'teacher@dev.local', role: 'teacher', department: 'Computer Science', createdAt: { seconds: Date.now()/1000, nanoseconds: 0 } },
      student: { uid: 'mock_student', name: 'Dev Student', email: 'student@dev.local', role: 'student', rollNo: 'DEV-001', classId: 'CS-2024-A', createdAt: { seconds: Date.now()/1000, nanoseconds: 0 } }
    };
    
    // IMPORTANT:
    // Do NOT auto-seed on bypass login. Seeding deactivates old active sessions
    // (and may overwrite data), which breaks the "teacher creates a live session,
    // then student logs in and sees it live" test flow.
    
    localStorage.setItem('mock_user', JSON.stringify(profiles[role]));
    window.location.reload(); // Reload to trigger App.tsx useEffect
  };

  const handleSeed = async () => {
    try {
      toast.info('Seeding demo data...');
      console.log('Calling seedDemoData...');
      await seedDemoData();
      toast.success('Demo data seeded successfully!');
      // Give it a moment before reloading
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Seeding failed:', error);
      toast.error('Seeding failed: ' + (error.message || 'Unknown error'));
    }
  };

  const testFirestore = async () => {
    try {
      toast.info('Testing Firestore connectivity...');
      const testDoc = doc(db, 'test', 'connection');
      await getDoc(testDoc);
      toast.success('Firestore is reachable!');
    } catch (error: any) {
      console.error('Firestore Test Error:', error);
      if (error.code === 'permission-denied') {
        toast.success('Firestore is reachable (Permission denied is expected for unauthenticated test).');
      } else {
        toast.error('Firestore connection failed: ' + error.message);
      }
    }
  };

  const testPermissions = async () => {
    try {
      toast.info('Testing public permissions...');
      console.log('Testing public permissions...');
      const [classesSnap, subjectsSnap] = await Promise.all([
        getDocs(collection(db, 'classes')),
        getDocs(collection(db, 'subjects'))
      ]);
      console.log('Permissions test successful!', { classes: classesSnap.size, subjects: subjectsSnap.size });
      toast.success(`Permissions test successful! Found ${classesSnap.size} classes and ${subjectsSnap.size} subjects.`);
    } catch (error: any) {
      console.error('Permission test failed:', error);
      toast.error('Permission test failed: ' + error.message);
    }
  };

  const clearStorage = () => {
    localStorage.clear();
    toast.success('Local storage cleared. Reloading...');
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gray-100 p-6 font-sans">
      {/* Background Image with Blur */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-40 blur-sm"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1541339907198-e08756eaa589?q=80&w=2070&auto=format&fit=crop")' }}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 flex w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl"
      >
        {/* Left Panel - Blue Info */}
        <div className="hidden w-1/2 flex-col justify-between bg-[#003399] p-12 text-white md:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/10 p-2 backdrop-blur-sm">
                <Fingerprint size={32} />
              </div>
              <span className="text-2xl font-extrabold tracking-tight">Academic Sentinel</span>
            </div>
            
            <div className="mt-24">
              <h1 className="text-5xl font-black leading-tight tracking-tight">
                Integrity in every <br />
                <span className="text-blue-200">presence.</span>
              </h1>
              <p className="mt-8 max-w-sm text-lg font-medium text-blue-100/80 leading-relaxed">
                Securing institutional attendance with advanced biometric-grade device fingerprinting and real-time verification.
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-4 rounded-2xl bg-white/10 p-5 backdrop-blur-md">
              <div className="rounded-xl bg-blue-500/30 p-2">
                <ShieldCheck size={24} className="text-blue-200" />
              </div>
              <div>
                <p className="font-bold">Anti-Proxy Active</p>
                <p className="text-xs text-blue-200/70">Multi-factor device validation enabled</p>
              </div>
            </div>
            <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300/50">
              UNIVERSITY PORTAL © 2024
            </p>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="flex w-full flex-col justify-center p-12 md:w-1/2 md:p-16">
          <div className="mb-10">
            <h2 className="text-4xl font-black text-gray-900">Welcome Back</h2>
            <p className="mt-3 text-lg font-medium text-gray-500">
              Please enter your academic credentials to proceed.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-gray-500">
                EMAIL / ROLL NUMBER
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. admin@sentinel.edu"
                  className="w-full rounded-xl border-none bg-gray-100 p-4 pl-5 text-sm font-bold text-gray-900 transition-all focus:bg-gray-200 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-gray-500">
                  PASSWORD
                </label>
                <button type="button" className="mb-2 text-[11px] font-bold text-[#003399] hover:underline">
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border-none bg-gray-100 p-4 pl-5 text-sm font-bold text-gray-900 transition-all focus:bg-gray-200 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="remember" 
                className="h-5 w-5 rounded-md border-gray-300 bg-gray-100 text-[#003399] focus:ring-[#003399]/20"
              />
              <label htmlFor="remember" className="text-sm font-bold text-gray-600">
                Remember this device
              </label>
            </div>

            <div className={
              `flex items-center justify-between rounded-xl p-4 transition-all duration-500 ${
                isFingerprinted ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
              }`
            }>
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${isFingerprinted ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`}></div>
                <span className="text-xs font-bold">{fingerprintStatus}</span>
              </div>
              <Info size={16} className="opacity-50" />
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#003399] py-5 text-lg font-bold text-white shadow-xl shadow-blue-900/20 transition-all hover:bg-[#002266] active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? (
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  <>
                    Login
                    <ArrowRight size={20} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-gray-100 py-4 text-sm font-bold text-gray-600 transition-all hover:bg-gray-50 active:scale-[0.98]"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
                Continue with Google
              </button>
            </div>
          </form>

          {/* Demo Accounts Section */}
          <div className="mt-8 rounded-2xl bg-gray-50 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#003399]">
                <Key size={18} />
                <span className="text-xs font-black uppercase tracking-widest">Local Test Mode</span>
              </div>
              <span className="text-[10px] font-bold text-orange-500">Bypass Auth</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => handleBypass('admin')} className="rounded-lg bg-white p-2 text-[10px] font-bold text-gray-600 shadow-sm transition-all hover:bg-orange-50 hover:text-orange-600">DEV ADMIN</button>
              <button onClick={() => handleBypass('teacher')} className="rounded-lg bg-white p-2 text-[10px] font-bold text-gray-600 shadow-sm transition-all hover:bg-orange-50 hover:text-orange-600">DEV TEACHER</button>
              <button onClick={() => handleBypass('student')} className="rounded-lg bg-white p-2 text-[10px] font-bold text-gray-600 shadow-sm transition-all hover:bg-orange-50 hover:text-orange-600">DEV STUDENT</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={testFirestore} className="flex-1 rounded-lg bg-blue-50 p-2 text-[10px] font-bold text-blue-600 transition-all hover:bg-blue-100">TEST FIRESTORE</button>
              <button onClick={testPermissions} className="flex-1 rounded-lg bg-indigo-50 p-2 text-[10px] font-bold text-indigo-600 transition-all hover:bg-indigo-100">TEST PERMISSIONS</button>
              <button onClick={handleSeed} className="flex-1 rounded-lg bg-orange-50 p-2 text-[10px] font-bold text-orange-600 transition-all hover:bg-orange-100">SEED DATA</button>
              <button onClick={clearStorage} className="flex-1 rounded-lg bg-red-50 p-2 text-[10px] font-bold text-red-600 transition-all hover:bg-red-100">CLEAR STORAGE</button>
            </div>
            <p className="mt-3 text-[10px] text-gray-400">
              Use these buttons to test the app <b>without</b> Firebase setup.
            </p>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm font-bold text-gray-500">
              Need assistance? <button className="text-[#003399] hover:underline">Contact Faculty Administrator</button>
            </p>
          </div>
        </div>
      </motion.div>

      <div className="absolute bottom-8 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
        SYSTEM IDENTITY: SENTINEL-NODE-04
      </div>
    </div>
  );
}
