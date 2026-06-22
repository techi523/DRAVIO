import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const appleJwksClient = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
});

function getAppleSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    appleJwksClient.getSigningKey(header.kid, (err, key) => {
      if (err || !key) {
        reject(err || new Error('Unable to get Apple signing key'));
      } else {
        resolve(key.getPublicKey());
      }
    });
  });
}

export interface VerifiedProviderUser {
  providerId: string;
  email?: string;
  name?: string;
}

export class ProviderVerifier {
  static async verifyGoogle(idToken: string): Promise<VerifiedProviderUser> {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error('Invalid Google token');
    return {
      providerId: payload.sub,
      email: payload.email,
      name: payload.name,
    };
  }

  static async verifyApple(idToken: string): Promise<VerifiedProviderUser> {
    return new Promise((resolve, reject) => {
      jwt.verify(idToken, getAppleSigningKey as any, {
        issuer: 'https://appleid.apple.com',
        audience: process.env.APPLE_CLIENT_ID, // e.g. com.dravio.app
      }, (err, decoded: any) => {
        if (err || !decoded) {
          return reject(err || new Error('Invalid Apple token'));
        }
        resolve({
          providerId: decoded.sub,
          email: decoded.email, // Apple only sends email on first auth, but sub is always there
        });
      });
    });
  }

  static async verifyGitHub(accessToken: string): Promise<VerifiedProviderUser> {
    const { data } = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // GitHub API might not return email in /user if it's private.
    // A production system would also query /user/emails, but we use the main profile for now.
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
    const { data } = await axios.get(`https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`);
    return {
      providerId: data.id,
      email: data.email,
      name: data.name,
    };
  }

  static async verifyX(accessToken: string): Promise<VerifiedProviderUser> {
    // X (Twitter) OAuth 2.0 API v2
    const { data } = await axios.get('https://api.twitter.com/2/users/me?user.fields=id,name,username', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return {
      providerId: data.data.id,
      name: data.data.name || data.data.username,
      // Twitter API v2 requires elevated permissions for email, we might not get it.
    };
  }
}
