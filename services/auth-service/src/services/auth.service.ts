import bcrypt from 'bcryptjs';
import axios from 'axios';
import { authRepository } from '../repositories/auth.repository.js';
import { RegisterInput, LoginInput } from '../schema/auth.schema.js';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';

export class AuthService {
  async register(input: RegisterInput): Promise<{ userId: string; role: string }> {
    const passwordHash = await bcrypt.hash(input.password, 10);
    
    // Check if user already exists
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
      // Rollback auth user on profile creation failure
      await authRepository.delete(userId);
      console.error('Failed to create user profile, rolled back auth user', err);
      throw new Error('PROFILE_CREATION_FAILED');
    }
  }

  async login(input: LoginInput) {
    const user = await authRepository.findByEmail(input.email);
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(input.password, user.password_hash);
    if (!isValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    return user;
  }
}

export const authService = new AuthService();
