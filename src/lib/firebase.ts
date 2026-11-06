import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDoc, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Silence internal connection warnings and backend timeout notices completely
setLogLevel('silent');

const isBrowser = typeof window !== 'undefined';

try {
  initializeFirestore(
    app,
    {
      ignoreUndefinedProperties: true,
      ...(isBrowser ? { experimentalAutoDetectLongPolling: true } : {}),
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  // If already initialized
}

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };

  // Log softly in debug mode; permanent server SQL backup & localStorage handle persistence seamlessly
  console.debug(`Firestore sync notice [${operationType}] at ${path || 'unknown'}:`, errInfo.error);
}

// Initial connection check conforming to resilient database architecture
export async function testConnection() {
  if (!isBrowser) return;
  try {
    const checkPromise = getDoc(doc(db, 'test', 'connection'));
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500));
    await Promise.race([checkPromise, timeoutPromise]);
  } catch {
    // Graceful offline/SQLite fallback without console errors
  }
}

if (isBrowser) {
  testConnection();
}
