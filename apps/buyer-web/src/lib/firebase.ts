/**
 * DRAVIO — Firebase Client SDK Initializer (buyer-web)
 *
 * Initializes the Firebase JS SDK for client-side Google/Apple sign-in.
 * The frontend uses Firebase only to obtain an ID token via signInWithPopup.
 * That ID token is then sent to the DRAVIO backend (/v1/auth/oauth) where
 * Firebase Admin SDK verifies it and the backend issues its own session JWT.
 *
 * Required NEXT_PUBLIC_ env vars (set in Vercel Dashboard → Project → Environment Variables):
 *   NEXT_PUBLIC_FIREBASE_API_KEY        — From Firebase Console → Project Settings → Web App
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN    — <project-id>.firebaseapp.com
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID     — Your Firebase project ID
 *
 * NOTE: These are public/browser-safe keys. Do NOT confuse them with the
 * server-side FIREBASE_PRIVATE_KEY used by the backend (Railway).
 */
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  type UserCredential,
} from 'firebase/auth';

// ─── Firebase App Config ────────────────────────────────────────────

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'dummy_api_key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'dummy_domain.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'dummy_project_id',
};

// Avoid re-initializing on hot reload in Next.js dev mode
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

// ─── Provider Instances ─────────────────────────────────────────────

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

// ─── Sign-in Helpers ────────────────────────────────────────────────

/**
 * Opens a Google sign-in popup and returns the Firebase ID token.
 * Pass this token to api.auth.oauthLogin('google', { id_token }) in auth.tsx.
 *
 * @returns Firebase ID token string
 * @throws If the popup is closed or sign-in fails
 */
export async function signInWithGoogle(): Promise<string> {
  const result: UserCredential = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  // Sign out from Firebase immediately — DRAVIO manages its own session
  await signOut(auth);
  return idToken;
}

/**
 * Opens an Apple sign-in popup and returns the Firebase ID token.
 * Pass this token to api.auth.oauthLogin('apple', { id_token }) in auth.tsx.
 *
 * NOTE: Apple sign-in requires the authDomain to be added to Apple's
 * "Sign in with Apple" configuration in the Apple Developer Console.
 *
 * @returns Firebase ID token string
 * @throws If the popup is closed or sign-in fails
 */
export async function signInWithApple(): Promise<string> {
  const result: UserCredential = await signInWithPopup(auth, appleProvider);
  const idToken = await result.user.getIdToken();
  await signOut(auth);
  return idToken;
}

export { auth };
