-- Consolidated Master Initializer for DRAVIO Platform
-- Set up all core database schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS payments;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS sessions;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS audit;

-- ==========================================
-- AUTH SCHEMA TABLES
-- ==========================================

-- Auth Users Table
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Refresh Tokens Table
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- USERS SCHEMA TABLES
-- ==========================================

-- Profiles Table
CREATE TABLE IF NOT EXISTS users.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL,
    full_name VARCHAR(255),
    kyc_level SMALLINT DEFAULT 0,
    country_code CHAR(2),
    phone_number VARCHAR(20),
    is_seller BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- PAYMENTS SCHEMA TABLES
-- ==========================================

-- Transactions Table
CREATE TABLE IF NOT EXISTS payments.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    user_id UUID NOT NULL,
    amount_usd DECIMAL(15,4) NOT NULL,
    platform_fee_usd DECIMAL(15,4) NOT NULL,
    seller_net_usd DECIMAL(15,4) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    provider_ref VARCHAR(255),
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payouts Table
CREATE TABLE IF NOT EXISTS payments.payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL,
    amount_usd DECIMAL(15,4) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    provider_ref VARCHAR(255),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- BILLING SCHEMA TABLES
-- ==========================================

-- Wallets Table
CREATE TABLE IF NOT EXISTS billing.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT UNIQUE NOT NULL,
    balance_usd DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sessions Table (Billing Telemetry Audit)
CREATE TABLE IF NOT EXISTS billing.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    hardware_id TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    bytes_used BIGINT DEFAULT 0,
    cost_accumulated DECIMAL(12,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS billing.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    isp_id UUID NOT NULL,
    amount_usd DECIMAL(15,4) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'UNPAID',
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Usage Records Table
CREATE TABLE IF NOT EXISTS billing.usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    session_id UUID NOT NULL,
    bytes_used BIGINT NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- SESSIONS SCHEMA TABLES (Active Routing)
-- ==========================================

-- Active Routing Sessions
CREATE TABLE IF NOT EXISTS sessions.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    package_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    data_amount_mb INTEGER NOT NULL,
    data_used_mb DECIMAL(15,4) DEFAULT 0,
    price_total_usd DECIMAL(15,4)
);

-- Session Handoffs Table (Dynamic seller switching)
CREATE TABLE IF NOT EXISTS sessions.handoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions.sessions(id),
    old_seller_id UUID NOT NULL,
    new_seller_id UUID NOT NULL,
    handoff_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- ANALYTICS SCHEMA TABLES
-- ==========================================

-- Metrics Aggregates
CREATE TABLE IF NOT EXISTS analytics.metrics (
    metric_name TEXT PRIMARY KEY,
    metric_value NUMERIC(15, 2),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Session Telemetry (Time-series packet details)
CREATE TABLE IF NOT EXISTS analytics.session_telemetry (
    id           BIGSERIAL PRIMARY KEY,
    session_id   UUID NOT NULL,
    bytes_in     BIGINT DEFAULT 0,
    bytes_out    BIGINT DEFAULT 0,
    latency_ms   INTEGER,
    recorded_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- AUDIT SCHEMA TABLES
-- ==========================================

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service TEXT,
    actor_id UUID,
    action TEXT,
    resource_type TEXT,
    resource_id TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- ==========================================

-- Profiles Lookups
CREATE INDEX IF NOT EXISTS idx_users_profiles_auth_user_id
  ON users.profiles (auth_user_id);

-- Session Tokens (Frequent query path)
CREATE INDEX IF NOT EXISTS idx_billing_sessions_token
  ON billing.sessions (session_token);

-- Active User Sessions Filter
CREATE INDEX IF NOT EXISTS idx_billing_sessions_user_status
  ON billing.sessions (customer_id, status);

-- Payments Transactions webhook resolver
CREATE INDEX IF NOT EXISTS idx_payments_transactions_provider_ref
  ON payments.transactions (provider_ref);

-- Payments Wallet ledger list
CREATE INDEX IF NOT EXISTS idx_payments_transactions_user_id
  ON payments.transactions (user_id, created_at DESC);

-- Analytics telemetries
CREATE INDEX IF NOT EXISTS idx_telemetry_session
  ON analytics.session_telemetry (session_id);

CREATE INDEX IF NOT EXISTS idx_telemetry_time
  ON analytics.session_telemetry (recorded_at);
