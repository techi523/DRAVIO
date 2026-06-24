import bcrypt from 'bcryptjs';
import axios from 'axios';
import { authRepository, AuthUser } from '../repositories/auth.repository.js';
import { RegisterInput, LoginInput, OAuthLoginInput } from '../schema/auth.schema.js';
import { ProviderVerifier } from '../utils/provider-verifier.js';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || (process.env.LOCAL_DEV === 'true' ? 'http://localhost:3002' : 'http://user-service:3002');

export class AuthService {
  async register(input: RegisterInput): Promise<{ userId: string; role: string }> {
    const passwordHash = await bcrypt.hash(input.password, 10);
    
    const existing = await authRepository.findByEmail(input.email);
    if (existing) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    const role = input.role || 'BUYER';
    const userId = await authRepository.create(input.email, passwordHash, role);
    
    try {
      await axios.post(`${USER_SERVICE_URL}/v1/users`, { 
        auth_user_id: userId, 
        email: input.email,
        full_name: input.full_name, 
        country_code: input.country_code,
        is_seller: role === 'SELLER',
      });
      return { userId, role };
    } catch (err) {
      await authRepository.delete(userId);
      console.error('Failed to create user profile, rolled back auth user', err);
      throw new Error('PROFILE_CREATION_FAILED');
    }
  }

  async login(input: LoginInput) {
    const user = await authRepository.findByEmail(input.email);
    if (!user || !user.password_hash) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(input.password, user.password_hash);
    if (!isValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    return user;
  }

  async oauthLogin(input: OAuthLoginInput): Promise<AuthUser> {
    let verifiedUser;
    
    if (input.provider === 'google' && input.id_token) {
      verifiedUser = await ProviderVerifier.verifyGoogle(input.id_token);
    } else if (input.provider === 'apple' && input.id_token) {
      verifiedUser = await ProviderVerifier.verifyApple(input.id_token);
    } else if (input.provider === 'github' && input.access_token) {
      verifiedUser = await ProviderVerifier.verifyGitHub(input.access_token);
    } else if (input.provider === 'microsoft' && input.access_token) {
      verifiedUser = await ProviderVerifier.verifyMicrosoft(input.access_token);
    } else if (input.provider === 'facebook' && input.access_token) {
      verifiedUser = await ProviderVerifier.verifyFacebook(input.access_token);
    } else if (input.provider === 'x' && input.access_token) {
      verifiedUser = await ProviderVerifier.verifyX(input.access_token);
    } else {
      throw new Error('INVALID_OAUTH_PAYLOAD');
    }

    // 1. Check if user is already linked
    let user = await authRepository.findUserByProvider(input.provider, verifiedUser.providerId);
    
    if (!user) {
      // 2. If not linked, check if email exists to auto-link, else create new
      const emailToUse = verifiedUser.email;
      if (!emailToUse) {
        throw new Error('EMAIL_REQUIRED_FOR_NEW_OAUTH_ACCOUNT');
      }

      user = await authRepository.findByEmail(emailToUse);
      if (!user) {
        // Create new user (password is null)
        const role = input.role_preference || 'BUYER';
        const userId = await authRepository.create(emailToUse, null, role);
        
        try {
          await axios.post(`${USER_SERVICE_URL}/v1/users`, { 
            auth_user_id: userId, 
            email: emailToUse,
            full_name: verifiedUser.name || 'User', 
            country_code: 'US', // default or extract from IP later
            is_seller: role === 'SELLER',
          });
          user = await authRepository.findById(userId);
        } catch (err) {
          await authRepository.delete(userId);
          throw new Error('PROFILE_CREATION_FAILED');
        }
      }
      
      // Link the new or existing user to this provider
      if (user) {
         await authRepository.linkProvider(user.id, input.provider, verifiedUser.providerId, emailToUse);
      }
    }

    if (!user) throw new Error('OAUTH_LOGIN_FAILED');
    return user;
  }

  async otpLogin(phoneNumber: string, rolePreference: string): Promise<AuthUser> {
    // 1. Check if user is already linked to this phone number
    let user = await authRepository.findUserByProvider('phone', phoneNumber);
    
    if (!user) {
      // 2. We don't have an email for phone auth unless they linked it previously.
      // For phone-only users, we might use a placeholder email or require email later.
      const mockEmail = `${phoneNumber.replace(/[^0-9]/g, '')}@phone.dravio.local`;
      
      user = await authRepository.findByEmail(mockEmail);
      if (!user) {
        const role = rolePreference || 'BUYER';
        const userId = await authRepository.create(mockEmail, null, role);
        
        try {
          await axios.post(`${USER_SERVICE_URL}/v1/users`, { 
            auth_user_id: userId, 
            email: null, // Phone users might not have email initially
            phone_number: phoneNumber,
            full_name: 'User', 
            country_code: 'US',
            is_seller: role === 'SELLER',
          });
          user = await authRepository.findById(userId);
        } catch (err) {
          await authRepository.delete(userId);
          throw new Error('PROFILE_CREATION_FAILED');
        }
      }
      
      if (user) {
         await authRepository.linkProvider(user.id, 'phone', phoneNumber, undefined);
      }
    }

    if (!user) throw new Error('OTP_LOGIN_FAILED');
    return user;
  }
}

export const authService = new AuthService();
