import { pool } from '../db/client.js';

export interface AuthUser {
  id: string;
  email: string;
  password_hash: string;
  roles: string[];
  created_at: Date;
}

export class AuthRepository {
  async findByEmail(email: string): Promise<AuthUser | null> {
    const result = await pool.query(
      'SELECT id, email, password_hash, roles, created_at FROM auth.users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  async create(email: string, passwordHash: string, role: string = 'BUYER'): Promise<string> {
    const result = await pool.query(
      'INSERT INTO auth.users (email, password_hash, roles) VALUES ($1, $2, $3) RETURNING id',
      [email, passwordHash, [role]]
    );
    return result.rows[0].id;
  }

  async delete(id: string): Promise<void> {
    await pool.query('DELETE FROM auth.users WHERE id = $1', [id]);
  }
}

export const authRepository = new AuthRepository();
