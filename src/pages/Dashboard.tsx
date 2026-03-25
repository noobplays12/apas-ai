import { UserProfile } from '../types';
import StudentDashboard from './StudentDashboard';
import TeacherDashboard from './TeacherDashboard';
import AdminDashboard from './AdminDashboard';

interface DashboardProps {
  user: UserProfile;
}

export default function Dashboard({ user }: DashboardProps) {
  switch (user.role) {
    case 'student':
      return <StudentDashboard user={user} />;
    case 'teacher':
      return <TeacherDashboard user={user} />;
    case 'admin':
      return <AdminDashboard user={user} />;
    default:
      return <div>Unknown role</div>;
  }
}
