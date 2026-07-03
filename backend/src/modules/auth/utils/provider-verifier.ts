import axios from 'axios';
import { getFirebaseAuth } from './firebase-admin.js';

export interface VerifiedProviderUser {
  providerId: string;
  email?: string;
  name?: string;
}

export class ProviderVerifier {
  static async verifyGoogle(idToken: string): Promise<VerifiedProviderUser> {
    const fb = getFirebaseAuth();
    if (!fb) throw new Error('Firebase Admin SDK not configured — cannot verify Google token');
    const decoded = await fb.verifyIdToken(idToken);
    if (!decoded.uid) throw new Error('Invalid Google token: missing uid');
    return {
      providerId: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    };
  }

  static async verifyApple(idToken: string): Promise<VerifiedProviderUser> {
    const fb = getFirebaseAuth();
    if (!fb) throw new Error('Firebase Admin SDK not configured — cannot verify Apple token');
    const decoded = await fb.verifyIdToken(idToken);
    if (!decoded.uid) throw new Error('Invalid Apple token: missing uid');
    return {
      providerId: decoded.uid,
      email: decoded.email,
    };
  }

  static async verifyGitHub(accessToken: string): Promise<VerifiedProviderUser> {
    const { data } = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
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

  static async verifyX(accessToken: string): Promise<VerifiedProviderUser> {
    const { data } = await axios.get(
      'https://api.twitter.com/2/users/me?user.fields=id,name,username',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return {
      providerId: data.data.id,
      name: data.data.name || data.data.username,
    };
  }
}
