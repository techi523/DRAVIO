-- ============================================================
-- DRAVIO Phase 6: Performance Optimization – Database Indexes
-- Run this against the DRAVIO PostgreSQL instance.
-- ============================================================

-- users schema: speed up profile lookups by JWT subject ID
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_profiles_auth_user_id
  ON users.profiles (auth_user_id);

-- billing sessions: fast session lookup by token (most frequent query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_billing_sessions_token
  ON billing.sessions (session_token);

-- billing sessions: filter active sessions per user efficiently
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_billing_sessions_user_status
  ON billing.sessions (user_id, status);

-- payments: fast lookup by provider reference (webhook handler)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_transactions_provider_ref
  ON payments.transactions (provider_ref);

-- payments: list all transactions per user (wallet history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_transactions_user_id
  ON payments.transactions (user_id, created_at DESC);

-- ============================================================
-- DRAVIO Phase 6: Redis In-Memory Caching Layer Guidance
-- ============================================================
-- 1. Session data is cached in Redis (billing-service) via redisCache.getSession()
--    TTL: 1 hour. Key pattern: "session:{sessionToken}"
--
-- 2. Marketplace listings are cached in Redis (marketplace-service)
--    TTL: 30 seconds per heartbeat interval. Key pattern: "seller:{sellerId}"
--
-- 3. User profiles should be cached for read-heavy paths:
--    Add to user.repository.ts: check Redis before querying Postgres,
--    invalidate on PUT /v1/users/me.
-- ============================================================
