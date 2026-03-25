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
  /** Departmental mapping (preferred for attendance scoping) */
  semesterId?: string;
  sectionId?: string;
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
  /** Legacy class id; optional when semesterId + sectionId are set */
  classId?: string;
  semesterId?: string;
  sectionId?: string;
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

export interface Semester {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Section {
  id: string;
  semesterId: string;
  sectionName: string;
  displayLabel?: string;
}

export interface TimetableSlot {
  id: string;
  teacherId: string;
  subjectId: string;
  semesterId: string;
  sectionId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotLabel?: string;
}
