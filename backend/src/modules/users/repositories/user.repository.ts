import { pool } from '../../../db/client.js';

const profileCache = new Map<string, { data: UserProfile; expiresAt: number }>();
const PROFILE_CACHE_TTL_MS = 60_000;

export interface UserProfile {
  id: string;
  auth_user_id: string;
  full_name: string;
  country_code: string;
  created_at: Date;
}

export async function createUserProfile(input: {
  auth_user_id: string;
  email?: string | null;
  phone_number?: string;
  full_name: string;
  country_code: string;
  is_seller: boolean;
}): Promise<string> {
  const result = await pool.query(
    `INSERT INTO users.profiles (auth_user_id, full_name, country_code, email, phone_number, is_seller)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.auth_user_id, input.full_name, input.country_code, input.email || null, input.phone_number || null, input.is_seller]
  );
  return result.rows[0].id;
}

export class UserRepository {
  async findByAuthId(authUserId: string): Promise<UserProfile | null> {
    const cached = profileCache.get(authUserId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const result = await pool.query(
      'SELECT id, auth_user_id, full_name, country_code, created_at FROM users.profiles WHERE auth_user_id = $1',
      [authUserId]
    );
    const profile = result.rows[0] || null;

    if (profile) {
      profileCache.set(authUserId, { data: profile, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
    }

    return profile;
  }

  async create(input: { auth_user_id: string; full_name: string; country_code: string }): Promise<string> {
    const result = await pool.query(
      'INSERT INTO users.profiles (auth_user_id, full_name, country_code) VALUES ($1, $2, $3) RETURNING id',
      [input.auth_user_id, input.full_name, input.country_code]
    );
    return result.rows[0].id;
  }

  async update(id: string, updates: Partial<{ full_name: string; country_code: string }>): Promise<UserProfile> {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    if (fields.length === 0) {
      throw new Error('NO_FIELDS_TO_UPDATE');
    }

    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const result = await pool.query(
      `UPDATE users.profiles SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING id, auth_user_id, full_name, country_code, created_at`,
      [id, ...values]
    );

    const updated = result.rows[0];

    if (updated) {
      profileCache.delete(updated.auth_user_id);
    }

    return updated;
  }
}

export const userRepository = new UserRepository();
