import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Firebase bootstrap.
 *
 * The values below are PUBLIC by design — every Firebase web app ships its
 * config in the bundle. They identify the project; they do not authorise
 * anything. All access control lives in firestore.rules, which the server
 * enforces on every read and write. Never put a private key here.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * True when the project is configured. The storefront still renders without
 * it (catalog falls back to local data) so a missing .env during setup is a
 * degraded site rather than a white screen.
 */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(config);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);

  // Local development against the Firebase Emulator Suite.
  if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === '1') {
    connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080);
  }
}

/**
 * Accessors that fail loudly. Call sites should gate on
 * `isFirebaseConfigured` rather than handling a null instance.
 */
export function getAuthOrThrow(): Auth {
  if (!authInstance) {
    throw new Error(
      'Firebase is not configured. Copy .env.example to .env and fill in VITE_FIREBASE_* values.',
    );
  }
  return authInstance;
}

export function getDbOrThrow(): Firestore {
  if (!dbInstance) {
    throw new Error(
      'Firebase is not configured. Copy .env.example to .env and fill in VITE_FIREBASE_* values.',
    );
  }
  return dbInstance;
}

export const auth = authInstance;
export const db = dbInstance;
