import { pool } from '../db/client.js';

export interface AuthUser {
  id: string;
  email: string;
  password_hash: string | null;
  roles: string[];
  created_at: Date;
}

export interface AuthProvider {
  id: string;
  user_id: string;
  provider_name: string;
  provider_id: string;
  provider_email: string | null;
}

export class AuthRepository {
  async findByEmail(email: string): Promise<AuthUser | null> {
    const result = await pool.query(
      'SELECT id, email, password_hash, roles, created_at FROM auth.users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  async findById(id: string): Promise<AuthUser | null> {
    const result = await pool.query(
      'SELECT id, email, password_hash, roles, created_at FROM auth.users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(email: string, passwordHash: string | null, role: string = 'BUYER'): Promise<string> {
    const result = await pool.query(
      'INSERT INTO auth.users (email, password_hash, roles) VALUES ($1, $2, $3) RETURNING id',
      [email, passwordHash, [role]]
    );
    return result.rows[0].id;
  }

  async delete(id: string): Promise<void> {
    await pool.query('DELETE FROM auth.users WHERE id = $1', [id]);
  }

  async findUserByProvider(providerName: string, providerId: string): Promise<AuthUser | null> {
    const result = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.roles, u.created_at 
       FROM auth.users u
       JOIN auth.providers p ON u.id = p.user_id
       WHERE p.provider_name = $1 AND p.provider_id = $2`,
      [providerName, providerId]
    );
    return result.rows[0] || null;
  }

  async linkProvider(userId: string, providerName: string, providerId: string, providerEmail?: string): Promise<void> {
    await pool.query(
      `INSERT INTO auth.providers (user_id, provider_name, provider_id, provider_email) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (provider_name, provider_id) DO NOTHING`,
      [userId, providerName, providerId, providerEmail || null]
    );
  }
}

export const authRepository = new AuthRepository();
