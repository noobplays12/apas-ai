export type UserRole = 'student' | 'teacher' | 'admin';

// Supabase returns timestamptz as ISO strings by default.
export type IsoTimestamp = string;

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  rollNo?: string;
  role: UserRole;
  classId?: string;
  deviceId?: string;
  createdAt: IsoTimestamp;
}

export interface Class {
  id: string;
  name: string;
  section?: string;
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
}

export interface Session {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  startTime: IsoTimestamp;
  endTime: IsoTimestamp;
  location?: {
    latitude: number;
    longitude: number;
    radius: number;
  };
  wifiSSID?: string;
  isActive: boolean;
  verifyGPS: boolean;
  verifyWiFi: boolean;
}

export interface Attendance {
  id: string;
  studentId: string;
  sessionId: string;
  timestamp: IsoTimestamp;
  status: 'present' | 'absent';
  deviceId: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  wifiSSID?: string;
  verified: boolean;
}
