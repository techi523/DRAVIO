import { pool } from '../db/client.js';

export interface UserProfile {
  id: string;
  auth_user_id: string;
  full_name: string;
  country_code: string;
  created_at: Date;
}

export class UserRepository {
  async findByAuthId(authUserId: string): Promise<UserProfile | null> {
    const result = await pool.query(
      'SELECT id, auth_user_id, full_name, country_code, created_at FROM users.profiles WHERE auth_user_id = $1',
      [authUserId]
    );
    return result.rows[0] || null;
  }

  async create(input: { auth_user_id: string; full_name: string; country_code: string }): Promise<string> {
    const result = await pool.query(
      'INSERT INTO users.profiles (auth_user_id, full_name, country_code) VALUES ($1, $2, $3) RETURNING id',
      [input.auth_user_id, input.full_name, input.country_code]
    );
    return result.rows[0].id;
  }
}

export const userRepository = new UserRepository();
