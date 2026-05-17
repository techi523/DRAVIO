import { pool } from '../db/client.js';

// Lightweight in-memory fallback cache for profile lookups (Redis-compatible shape)
// In production: replace with actual ioredis/redis client connected to the Redis container.
const profileCache = new Map<string, { data: UserProfile; expiresAt: number }>();
const PROFILE_CACHE_TTL_MS = 60_000; // 60 seconds

export interface UserProfile {
  id: string;
  auth_user_id: string;
  full_name: string;
  country_code: string;
  created_at: Date;
}

export class UserRepository {
  async findByAuthId(authUserId: string): Promise<UserProfile | null> {
    // Phase 6: Cache-first profile lookup
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

    // Phase 6: Invalidate cache on update to prevent stale profile reads
    if (updated) {
      profileCache.delete(updated.auth_user_id);
    }

    return updated;
  }
}


export const userRepository = new UserRepository();

