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

let _firebaseAuth: ReturnType<typeof getAuth> | null = null;
let _firebaseEnabled = true;

function initFirebaseAdmin() {
  // Avoid re-initializing in hot-reload / multi-import scenarios
  if (getApps().length > 0) {
    return getAuth();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    _firebaseEnabled = false;
    console.warn(
      'Firebase Admin SDK not configured — set FIREBASE_PROJECT_ID, ' +
      'FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables. ' +
      'OAuth/Google/Apple sign-in will fail.'
    );
    return null;
  }

  try {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    return getAuth();
  } catch (err) {
    _firebaseEnabled = false;
    console.warn('Firebase Admin SDK initialization failed:', err);
    return null;
  }
}

/**
 * Get the Firebase Auth instance. Returns null if Firebase is not configured.
 * Use firebaseAuth.verifyIdToken(idToken) to validate Google/Apple ID tokens.
 */
export function getFirebaseAuth() {
  if (!_firebaseAuth && _firebaseEnabled) {
    _firebaseAuth = initFirebaseAdmin();
  }
  return _firebaseAuth;
}

/**
 * Pre-initialized Firebase Auth instance (may be null if not configured).
 */
export const firebaseAuth = initFirebaseAdmin();
