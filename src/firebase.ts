import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
console.log("Initializing Firebase with project:", firebaseConfig.projectId, "and database:", firebaseConfig.firestoreDatabaseId);
const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);

// Initialize Firestore with robust settings for iframes
let dbInstance;
try {
  const dbId = firebaseConfig.firestoreDatabaseId || undefined;
  console.log("[Firestore] Initializing with Database ID:", dbId || '(default)');
  
  // Using initializeFirestore instead of getFirestore to set experimentalForceLongPolling
  // This helps with connection issues in some proxy/iframe environments
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, dbId as any);
} catch (error) {
  console.warn("[Firestore] Failed to initialize with named database, falling back to default:", error);
  dbInstance = getFirestore(app);
}
export const db = dbInstance;

// Test connection to verify configuration
async function testConnection() {
  try {
    const { getDocFromServer, doc } = await import('firebase/firestore');
    // We use a dummy doc to test if we can reach the backend
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    console.log("[Firestore] Connection test successful.");
  } catch (error: any) {
    if (error.message?.includes('the client is offline') || error.code === 'unavailable') {
      console.error("CRITICAL: Could not reach Firestore. Please check if your domain is authorized in Firebase Console and if the API Key is valid.");
    }
  }
}
testConnection();

let storageInstance: any = null;

export const getFirebaseStorage = async () => {
  if (!storageInstance) {
    try {
      // Use dynamic import to ensure side-effects are loaded in a fresh context if needed
      const { getStorage: getStorageFn } = await import('firebase/storage');
      storageInstance = getStorageFn(app, firebaseConfig.storageBucket);
    } catch (error) {
      console.error("Firebase Storage is not available. Please ensure it is enabled in the Firebase Console.", error);
      throw new Error("Firebase Storage is not available. Please enable it in the Firebase Console at https://console.firebase.google.com/project/" + firebaseConfig.projectId + "/storage");
    }
  }
  return storageInstance;
};

export { signInAnonymously, signInWithCustomToken, GoogleAuthProvider, signInWithPopup };

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
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Check for Quota Exceeded
  if (errorMessage.includes("Quota exceeded")) {
    console.warn("Firestore Quota Exceeded. Switching to local mode for this operation.");
    return; 
  }

  // Check for Database Not Found
  if (errorMessage.includes("NOT_FOUND") || errorMessage.includes("not-found")) {
    console.warn("Firestore Database not found. This might be due to an incorrect database ID in firebase-applet-config.json.");
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
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
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default app;
