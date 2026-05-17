-- Add roles column to auth.users
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{buyer}';

-- Initial setup for a Super Admin (example)
-- UPDATE auth.users SET roles = '{super_admin}' WHERE email = 'admin@dravio.com';

-- Index for role-based queries (if needed)
CREATE INDEX IF NOT EXISTS idx_auth_users_roles ON auth.users USING GIN (roles);
