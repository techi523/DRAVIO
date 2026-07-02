/**
 * DRAVIO — Firebase Client SDK Initializer (admin-portal)
 *
 * Same pattern as buyer-web/src/lib/firebase.ts — Firebase is used only
 * to obtain an ID token for Google sign-in. The DRAVIO backend (Railway)
 * then verifies the token via Firebase Admin SDK and issues its own JWT.
 *
 * Required NEXT_PUBLIC_ env vars (Vercel Dashboard → admin-portal → Environment Variables):
 *   NEXT_PUBLIC_FIREBASE_API_KEY        — From Firebase Console → Project Settings → Web App
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN    — <project-id>.firebaseapp.com
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID     — Your Firebase project ID
 */
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type UserCredential,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'dummy_api_key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'dummy_domain.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'dummy_project_id',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

/**
 * Opens a Google sign-in popup and returns a Firebase ID token.
 * Pass the token to api.auth.oauthLogin('google', { id_token }, 'ADMIN').
 */
export async function signInWithGoogle(): Promise<string> {
  const result: UserCredential = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  // Immediately sign out from Firebase — DRAVIO manages its own session
  await signOut(auth);
  return idToken;
}

export { auth };
