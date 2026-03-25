import { UserProfile } from '../types';
import { Shield, Smartphone, Globe, Database, Bell, Lock, DatabaseBackup, RefreshCcw } from 'lucide-react';
import { useState } from 'react';
import { seedDemoData } from '../firebase';
import { toast } from 'sonner';

interface SystemSettingsProps {
  user: UserProfile;
}

export default function SystemSettings({ user }: SystemSettingsProps) {
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    try {
      setSeeding(true);
      toast.info('Seeding demo environment...');
      await seedDemoData();
      toast.success('Demo data seeded successfully!');
      window.location.reload();
    } catch (error: any) {
      console.error('Seeding error:', error);
      toast.error('Failed to seed data: ' + (error.message || 'Unknown error'));
    } finally {
      setSeeding(false);
    }
  };

  const sections = [
    {
      title: 'Security & Authentication',
      icon: Shield,
      items: [
        { label: 'Device Binding', desc: 'Enforce single device per user account', enabled: true },
        { label: 'Biometric Auth', desc: 'Require fingerprint or face ID for attendance', enabled: false },
        { label: 'Session Timeout', desc: 'Automatically logout inactive users after 30 mins', enabled: true },
      ]
    },
    {
      title: 'Geofencing Settings',
      icon: Globe,
      items: [
        { label: 'GPS Verification', desc: 'Verify user location before marking attendance', enabled: true },
        { label: 'Accuracy Threshold', desc: 'Maximum allowed distance from classroom (50m)', enabled: true },
      ]
    },
    {
      title: 'System Notifications',
      icon: Bell,
      items: [
        { label: 'Attendance Alerts', desc: 'Notify students when attendance is marked', enabled: true },
        { label: 'Low Attendance Warning', desc: 'Alert students falling below 75%', enabled: true },
      ]
    }
  ];

  return (
    <div className="space-y-10 pb-12 font-sans">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#003399]">
          System Configuration
        </p>
        <h1 className="mt-2 text-5xl font-black tracking-tight text-gray-900">
          Settings.
        </h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {sections.map((section) => (
          <div key={section.title} className="rounded-[2.5rem] bg-white p-10 shadow-sm border border-gray-50">
            <div className="mb-8 flex items-center gap-4">
              <div className="rounded-2xl bg-blue-50 p-3 text-[#003399]">
                <section.icon size={24} />
              </div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">{section.title}</h3>
            </div>
            
            <div className="space-y-6">
              {section.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div>
                    <p className="font-black text-gray-900">{item.label}</p>
                    <p className="text-sm font-bold text-gray-400">{item.desc}</p>
                  </div>
                  <button className={`h-6 w-12 rounded-full transition-all ${item.enabled ? 'bg-[#003399]' : 'bg-gray-200'} relative`}>
                    <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${item.enabled ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Data Management Section */}
        <div className="rounded-[2.5rem] bg-white p-10 shadow-sm border border-gray-50">
          <div className="mb-8 flex items-center gap-4">
            <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
              <DatabaseBackup size={24} />
            </div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight">Data Management</h3>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-gray-900">Seed Demo Data</p>
                <p className="text-sm font-bold text-gray-400">Populate the system with demo subjects, classes, and students</p>
              </div>
              <button 
                onClick={handleSeed}
                disabled={seeding}
                className="flex items-center gap-2 rounded-xl bg-orange-50 px-6 py-3 text-sm font-black text-orange-600 transition-all hover:bg-orange-100 active:scale-95 disabled:opacity-50"
              >
                <RefreshCcw size={18} className={seeding ? 'animate-spin' : ''} />
                {seeding ? 'Seeding...' : 'Seed Now'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
