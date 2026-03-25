import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  setPersistence, 
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  setDoc, 
  getDoc, 
  Timestamp,
  terminate,
  initializeFirestore,
  collection,
  getDocs,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with databaseId if provided, otherwise use default
const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
  ? firebaseConfig.firestoreDatabaseId 
  : undefined;

// Standard initialization
export const db = getFirestore(app, databaseId);

export const auth = getAuth(app);

// Set persistence to local for better reliability in iframes
setPersistence(auth, browserLocalPersistence).catch(err => console.error('Persistence error:', err));

export const googleProvider = new GoogleAuthProvider();

// Error handling spec for Firestore
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection
async function testConnection() {
  try {
    // getDoc is a good test for connectivity
    await getDoc(doc(db, 'test', 'connection'));
  } catch (error: any) {
    // If it's a permission error, it means we ARE connected but just not authorized
    if (error.code === 'permission-denied') {
      console.log("Firestore connected (waiting for login).");
      return;
    }
    
    if (error.message?.includes('the client is offline') || error.code === 'unavailable') {
      console.error("Firestore connection failed. Please check your configuration or network.");
    }
  }
}
testConnection();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const loginWithEmail = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);
export const logout = () => signOut(auth);

// Helper to ensure demo users exist in Firestore
export const ensureDemoUser = async (uid: string, data: any) => {
  try {
    console.log(`Ensuring demo user: ${uid} (${data.role})`);
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      console.log(`Creating user doc for ${uid}...`);
      await setDoc(userRef, {
        ...data,
        uid,
        createdAt: Timestamp.now()
      });
      console.log(`User doc for ${uid} created.`);
    } else {
      console.log(`User doc for ${uid} already exists.`);
    }
  } catch (error: any) {
    console.error(`Error ensuring demo user ${uid}:`, error);
    throw error;
  }
};

// Seed demo data for testing
export const seedDemoData = async () => {
  try {
    console.log('Starting demo data seeding with WriteBatch...');
    console.log('Database ID:', databaseId || '(default)');

    // 0. Deactivate any existing active sessions (prevents "random" old sessions
    // from showing as live for teachers/students).
    try {
      const activeQ = query(collection(db, 'sessions'), where('isActive', '==', true));
      const activeSnap = await getDocs(activeQ);
      if (!activeSnap.empty) {
        console.log(`Deactivating ${activeSnap.size} active session(s)...`);
        const deactivateBatch = writeBatch(db);
        activeSnap.docs.forEach((d) => {
          deactivateBatch.update(d.ref, { isActive: false });
        });
        await deactivateBatch.commit();
        console.log('Active sessions deactivated.');
      }
    } catch (e) {
      console.warn('Failed to deactivate existing sessions (continuing):', e);
    }

    const batch = writeBatch(db);
    
    // 1. Seed Classes
    const classes = [
      { id: 'CS-2024-A', name: 'Computer Science 2024', section: 'A' },
      { id: 'CS-2024-B', name: 'Computer Science 2024', section: 'B' },
      { id: 'EE-2024-A', name: 'Electrical Engineering 2024', section: 'A' }
    ];

    for (const c of classes) {
      batch.set(doc(db, 'classes', c.id), c);
    }

    // 2. Seed Subjects
    const subjects = [
      { id: 'CS-402', name: 'Distributed Systems', code: 'CS-402' },
      { id: 'CS-301', name: 'Analysis of Algorithms', code: 'CS-301' },
      { id: 'CS-101', name: 'Introduction to Programming', code: 'CS-101' },
      { id: 'MA-201', name: 'Linear Algebra', code: 'MA-201' }
    ];

    for (const s of subjects) {
      batch.set(doc(db, 'subjects', s.id), s);
    }

    // 3. Seed Demo Students
    const demoStudents = [
      { uid: 'student_1', name: 'Alice Johnson', email: 'alice@example.com', rollNo: '2024-CS-001', role: 'student', classId: 'CS-2024-A' },
      { uid: 'student_2', name: 'Bob Smith', email: 'bob@example.com', rollNo: '2024-CS-002', role: 'student', classId: 'CS-2024-A' },
      { uid: 'student_3', name: 'Charlie Brown', email: 'charlie@example.com', rollNo: '2024-CS-003', role: 'student', classId: 'CS-2024-A' },
      { uid: 'student_4', name: 'David Wilson', email: 'david@example.com', rollNo: '2024-CS-004', role: 'student', classId: 'CS-2024-A' },
      { uid: 'student_5', name: 'Eva Green', email: 'eva@example.com', rollNo: '2024-CS-005', role: 'student', classId: 'CS-2024-A' },
      { uid: 'student_6', name: 'Frank Castle', email: 'frank@example.com', rollNo: '2024-CS-006', role: 'student', classId: 'CS-2024-B' },
      { uid: 'student_7', name: 'Grace Hopper', email: 'grace@example.com', rollNo: '2024-CS-007', role: 'student', classId: 'CS-2024-B' }
    ];

    for (const s of demoStudents) {
      batch.set(doc(db, 'users', s.uid), { ...s, createdAt: Timestamp.now() });
    }

    // 4. Seed Mock Users for Bypass Auth
    const mockUsers = [
      { uid: 'mock_admin', name: 'Dev Admin', email: 'admin@dev.local', role: 'admin' },
      { uid: 'mock_teacher', name: 'Dev Teacher', email: 'teacher@dev.local', role: 'teacher', department: 'Computer Science' },
      { uid: 'mock_student', name: 'Dev Student', email: 'student@dev.local', role: 'student', rollNo: 'DEV-001', classId: 'CS-2024-A' }
    ];

    for (const u of mockUsers) {
      batch.set(doc(db, 'users', u.uid), { ...u, createdAt: Timestamp.now() });
    }

    // 5. Seed Demo Sessions
    const sessions = [
      { 
        id: 'session_1', 
        classId: 'CS-2024-A', 
        subjectId: 'CS-402', 
        teacherId: 'mock_teacher', 
        startTime: Timestamp.fromDate(new Date(Date.now() - 3600000)),
        endTime: Timestamp.fromDate(new Date(Date.now() + 3600000)),
        // Demo-friendly default: sessions are NOT active until a teacher starts one.
        isActive: false,
        // Demo-friendly default: don't enforce GPS until the teacher creates a session
        // with a real geofence center (CreateSession captures current location).
        verifyGPS: false,
        verifyWiFi: false,
        location: { latitude: 37.7749, longitude: -122.4194, radius: 50 },
        wifiSSID: 'Campus-WiFi'
      },
      { 
        id: 'session_2', 
        classId: 'CS-2024-A', 
        subjectId: 'CS-301', 
        teacherId: 'mock_teacher', 
        startTime: Timestamp.fromDate(new Date(Date.now() - 86400000)),
        endTime: Timestamp.fromDate(new Date(Date.now() - 82800000)), 
        isActive: false,
        verifyGPS: false,
        verifyWiFi: false,
        location: { latitude: 37.7749, longitude: -122.4194, radius: 50 },
        wifiSSID: 'Campus-WiFi'
      }
    ];

    for (const s of sessions) {
      batch.set(doc(db, 'sessions', s.id), s);
    }

    // 6. Seed Demo Attendance
    const attendance = [
      { 
        id: 'att_1', 
        studentId: 'student_1', 
        sessionId: 'session_2', 
        timestamp: Timestamp.now(), 
        status: 'present', 
        deviceId: 'DEV-001',
        verified: true,
        location: { latitude: 37.7749, longitude: -122.4194 }
      },
      { 
        id: 'att_2', 
        studentId: 'student_2', 
        sessionId: 'session_2', 
        timestamp: Timestamp.now(), 
        status: 'present', 
        deviceId: 'DEV-002',
        verified: true,
        location: { latitude: 37.7749, longitude: -122.4194 }
      },
      { 
        id: 'att_3', 
        studentId: 'student_3', 
        sessionId: 'session_2', 
        timestamp: Timestamp.now(), 
        status: 'absent', 
        deviceId: 'DEV-003',
        verified: false,
        location: { latitude: 37.7749, longitude: -122.4194 }
      }
    ];

    for (const a of attendance) {
      batch.set(doc(db, 'attendance', a.id), a);
    }

    console.log('Committing batch...');
    await batch.commit();
    console.log('Batch committed successfully');

    console.log('Demo data seeded successfully');
  } catch (error: any) {
    console.error('Error seeding demo data:', error);
    throw error;
  }
};
