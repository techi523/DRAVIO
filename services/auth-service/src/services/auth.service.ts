import bcrypt from 'bcrypt';
import axios from 'axios';
import { authRepository } from '../repositories/auth.repository.js';
import { RegisterInput, LoginInput } from '../schema/auth.schema.js';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';

export class AuthService {
  async register(input: RegisterInput) {
    const passwordHash = await bcrypt.hash(input.password, 10);
    
    // Check if user already exists
    const existing = await authRepository.findByEmail(input.email);
    if (existing) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    const userId = await authRepository.create(input.email, passwordHash);
    
    try {
      await axios.post(`${USER_SERVICE_URL}/v1/users`, { 
        auth_user_id: userId, 
        full_name: input.full_name, 
        country_code: input.country_code 
      });
      return userId;
    } catch (err) {
      // Rollback
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
