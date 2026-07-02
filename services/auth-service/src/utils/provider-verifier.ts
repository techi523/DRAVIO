/**
 * DRAVIO — OAuth Provider Token Verifier
 *
 * Google & Apple: verified via Firebase Admin SDK (admin.auth().verifyIdToken)
 *   — replaces the previous google-auth-library + jwks-rsa implementations.
 *   — Firebase Admin handles key rotation, clock skew, and audience validation
 *     automatically. No GOOGLE_CLIENT_ID required on the backend.
 *
 * GitHub, Microsoft, Facebook, X: verified via their respective REST APIs
 *   using the bearer access_token sent by the frontend. These providers do not
 *   issue OIDC ID tokens, so Firebase is not applicable.
 */
import axios from 'axios';
import { firebaseAuth } from './firebase-admin.js';

export interface VerifiedProviderUser {
  providerId: string;
  email?: string;
  name?: string;
}

export class ProviderVerifier {
  /**
   * Verify a Google ID token using Firebase Admin SDK.
   * The frontend obtains this token via Firebase JS SDK (signInWithPopup).
   */
  static async verifyGoogle(idToken: string): Promise<VerifiedProviderUser> {
    const decoded = await firebaseAuth.verifyIdToken(idToken);
    if (!decoded.uid) throw new Error('Invalid Google token: missing uid');
    return {
      providerId: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    };
  }

  /**
   * Verify an Apple ID token using Firebase Admin SDK.
   * Firebase Admin supports Apple as a sign-in provider — it handles
   * Apple's JWKS endpoint, audience check, and nonce validation.
   */
  static async verifyApple(idToken: string): Promise<VerifiedProviderUser> {
    const decoded = await firebaseAuth.verifyIdToken(idToken);
    if (!decoded.uid) throw new Error('Invalid Apple token: missing uid');
    return {
      providerId: decoded.uid,
      email: decoded.email, // Apple only sends email on first auth
    };
  }

  /**
   * Verify a GitHub OAuth access_token by calling the GitHub user API.
   * GitHub does not issue OIDC tokens, so Firebase Admin is not used here.
   */
  static async verifyGitHub(accessToken: string): Promise<VerifiedProviderUser> {
    const { data } = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // GitHub may not return email if it's marked private — fall back to /user/emails
    let email = data.email;
    if (!email) {
      const emailRes = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const primary = emailRes.data.find((e: any) => e.primary);
      if (primary) email = primary.email;
    }
    return {
      providerId: data.id.toString(),
      email,
      name: data.name || data.login,
    };
  }

  /**
   * Verify a Microsoft access_token via the MS Graph API.
   */
  static async verifyMicrosoft(accessToken: string): Promise<VerifiedProviderUser> {
    const { data } = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return {
      providerId: data.id,
      email: data.mail || data.userPrincipalName,
      name: data.displayName,
    };
  }

  /**
   * Verify a Facebook access_token via the Graph API.
   */
  static async verifyFacebook(accessToken: string): Promise<VerifiedProviderUser> {
    const { data } = await axios.get(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`
    );
    return {
      providerId: data.id,
      email: data.email,
      name: data.name,
    };
  }

  /**
   * Verify an X (Twitter) OAuth 2.0 access_token via the Twitter API v2.
   * Note: Email access requires elevated Twitter API permissions.
   */
  static async verifyX(accessToken: string): Promise<VerifiedProviderUser> {
    const { data } = await axios.get(
      'https://api.twitter.com/2/users/me?user.fields=id,name,username',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return {
      providerId: data.data.id,
      name: data.data.name || data.data.username,
      // Twitter API v2 requires elevated permissions for email access
    };
  }
}
