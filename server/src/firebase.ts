import { cert, initializeApp, type AppOptions } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Admin SDK access. It bypasses firestore.rules, which is exactly why marking
 * an order paid lives here and nowhere a browser can reach.
 *
 * FIREBASE_SERVICE_ACCOUNT holds the service-account JSON, either raw or
 * Base64-encoded (easier to paste into a hosting panel). Against the local
 * emulators (FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST) no
 * credential is needed.
 */
function options(): AppOptions {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || undefined;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return { projectId };

  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const account = JSON.parse(json) as { project_id?: string };
  return { credential: cert(account as Parameters<typeof cert>[0]), projectId: projectId ?? account.project_id };
}

const app = initializeApp(options());

export const db = getFirestore(app);
export const auth = getAuth(app);
