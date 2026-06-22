-- Migration Script: Support for Social Authentication
-- Run this against your local Postgres DB if you don't want to wipe the volume

-- 1. Make password_hash nullable
ALTER TABLE auth.users ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Create the providers table
CREATE TABLE IF NOT EXISTS auth.providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_name VARCHAR(50) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_name, provider_id)
);
