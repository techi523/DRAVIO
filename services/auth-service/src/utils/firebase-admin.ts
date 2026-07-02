/**
 * Firebase Admin SDK — Singleton Initializer
 *
 * Initializes the Firebase Admin app once using environment variables.
 * Uses individual credential fields (FIREBASE_PROJECT_ID,
 * FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) which can be set
 * as Railway/Render environment variables without needing a JSON file.
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID    — Your Firebase project ID
 *   FIREBASE_CLIENT_EMAIL  — Service account email from Firebase Console
 *   FIREBASE_PRIVATE_KEY   — Private key string (with literal \n for newlines)
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function initFirebaseAdmin() {
  // Avoid re-initializing in hot-reload / multi-import scenarios
  if (getApps().length > 0) {
    return getAuth();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Railway stores the private key as a string with literal \n characters
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'FATAL: Firebase Admin SDK requires FIREBASE_PROJECT_ID, ' +
      'FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.'
    );
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

  return getAuth();
}

/**
 * Pre-initialized Firebase Auth instance.
 * Use firebaseAuth.verifyIdToken(idToken) to validate Google/Apple ID tokens.
 */
export const firebaseAuth = initFirebaseAdmin();
