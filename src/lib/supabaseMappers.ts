import type { Attendance, Session, UserProfile } from '../types';

export type ProfileRow = {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  roll_no: string | null;
  class_id: string | null;
  semester_id: string | null;
  section_id: string | null;
  device_id: string | null;
  created_at: string;
};

export type SessionRow = {
  id: string;
  class_id: string | null;
  semester_id: string | null;
  section_id: string | null;
  subject_id: string;
  teacher_id: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  verify_gps: boolean;
  verify_wifi: boolean;
  wifi_ssid: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_radius: number | null;
};

export type AttendanceRow = {
  id: string;
  student_id: string;
  session_id: string;
  timestamp: string;
  status: 'present' | 'absent';
  device_id: string;
  wifi_ssid: string | null;
  verified: boolean;
  location_lat: number | null;
  location_lng: number | null;
};

export function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    uid: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    rollNo: row.roll_no ?? undefined,
    classId: row.class_id ?? undefined,
    semesterId: row.semester_id ?? undefined,
    sectionId: row.section_id ?? undefined,
    deviceId: row.device_id ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapSessionRow(row: SessionRow): Session {
  return {
    id: row.id,
    classId: row.class_id ?? undefined,
    semesterId: row.semester_id ?? undefined,
    sectionId: row.section_id ?? undefined,
    subjectId: row.subject_id,
    teacherId: row.teacher_id,
    startTime: row.start_time,
    endTime: row.end_time,
    isActive: row.is_active,
    verifyGPS: row.verify_gps,
    verifyWiFi: row.verify_wifi,
    wifiSSID: row.wifi_ssid ?? undefined,
    location:
      row.location_lat != null && row.location_lng != null && row.location_radius != null
        ? { latitude: row.location_lat, longitude: row.location_lng, radius: row.location_radius }
        : undefined,
  };
}

export function mapAttendanceRow(row: AttendanceRow): Attendance {
  return {
    id: row.id,
    studentId: row.student_id,
    sessionId: row.session_id,
    timestamp: row.timestamp,
    status: row.status,
    deviceId: row.device_id,
    wifiSSID: row.wifi_ssid ?? undefined,
    verified: row.verified,
    location:
      row.location_lat != null && row.location_lng != null
        ? { latitude: row.location_lat, longitude: row.location_lng }
        : undefined,
  };
}

