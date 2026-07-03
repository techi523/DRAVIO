import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let _firebaseAuth: ReturnType<typeof getAuth> | null = null;
let _firebaseEnabled = true;

function initFirebaseAdmin() {
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

export function getFirebaseAuth() {
  if (!_firebaseAuth && _firebaseEnabled) {
    _firebaseAuth = initFirebaseAdmin();
  }
  return _firebaseAuth;
}

export const firebaseAuth = initFirebaseAdmin();
