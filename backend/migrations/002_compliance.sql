-- ---------------------------------------------------------------------------
-- Compliance engineering migration (Phase 35 — LEGAL, REGULATORY, POLICY)
-- ---------------------------------------------------------------------------
-- Apply AFTER master_init.sql and 001_hardening.sql. All statements idempotent.

-- 1) audit.audit_log is written by the dm.audit.log Kafka consumer which emits a
--    `metadata` JSONB column. Add it if absent so consumer inserts never fail.
ALTER TABLE audit.audit_log
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2) Compliance schema (governance, rights, provider onboarding, policy acceptance,
--    retention configuration, sanctions configuration).
CREATE SCHEMA IF NOT EXISTS compliance;

-- Immutable per-transition audit trail of payment status changes (CAS-guarded).
CREATE TABLE IF NOT EXISTS compliance.transaction_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    from_status VARCHAR(20) NOT NULL,
    to_status VARCHAR(20) NOT NULL,
    actor_id UUID,
    actor_role VARCHAR(50),
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transaction_events_transaction
  ON compliance.transaction_events (transaction_id, created_at);

-- Data-subject rights requests (ACCESS / CORRECTION / OBJECTION / DELETION / PORTABILITY).
CREATE TABLE IF NOT EXISTS compliance.privacy_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL,
    right_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    request_payload JSONB DEFAULT '{}'::jsonb,
    outcome JSONB,
    reviewed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_privacy_request_right CHECK (right_type IN ('ACCESS','CORRECTION','OBJECTION','DELETION','PORTABILITY')),
    CONSTRAINT chk_privacy_request_status CHECK (status IN ('PENDING','IN_REVIEW','COMPLETED','REJECTED','WITHDRAWN'))
);

CREATE INDEX IF NOT EXISTS idx_privacy_requests_requester
  ON compliance.privacy_requests (requester_id, created_at DESC);

-- Provider onboarding intake (type + verification fields, configurable).
CREATE TABLE IF NOT EXISTS compliance.provider_intake (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    provider_type VARCHAR(50) NOT NULL,
    verification JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_provider_intake_status CHECK (status IN ('SUBMITTED','APPROVED','REJECTED','WITHDRAWN'))
);

CREATE INDEX IF NOT EXISTS idx_provider_intake_user
  ON compliance.provider_intake (user_id, created_at DESC);

-- Policy version acceptance records (terms/privacy/AUP/provider-terms/buyer-terms).
CREATE TABLE IF NOT EXISTS compliance.policy_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    policy_id VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, policy_id, version)
);

CREATE INDEX IF NOT EXISTS idx_policy_acceptances_user
  ON compliance.policy_acceptances (user_id, policy_id);

-- Retention rule registry (categories + lawful basis + durations).
-- Seeded with factual categories from the actual implementation; durations are
-- configuration (tunable), documented in the retention registry module.
CREATE TABLE IF NOT EXISTS compliance.retention_rules (
    category VARCHAR(100) PRIMARY KEY,
    purpose TEXT NOT NULL,
    duration_days INTEGER,
    lawful_basis TEXT,
    legally_retained BOOLEAN NOT NULL DEFAULT FALSE,
    auto_deletable BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO compliance.retention_rules (category, purpose, duration_days, lawful_basis, legally_retained, auto_deletable, notes)
VALUES
  ('auth.credentials', 'Account authentication identity', 36500, 'CONTRACT_ISSUE_AND_SUPPORT', FALSE, TRUE, 'Erasable via data-deletion workflow; removed after account deletion'),
  ('auth.social_providers', 'Linked identity providers used to authenticate', 36500, 'CONTRACT_ISSUE_AND_SUPPORT', FALSE, TRUE, 'Removed on account deletion'),
  ('auth.refresh_tokens', 'Session refresh material (stored hashed)', 30, 'SECURITY_SESSION_MANAGEMENT', FALSE, TRUE, 'Short-lived; revoked on logout'),
  ('payments.transactions', 'Payment execution records', 7300, 'LEGAL_REQUIREMENT_ACCOUNTING', TRUE, FALSE, 'Financially significant records legally retained; linkage anonymized on deletion'),
  ('billing.ledger_entries', 'Immutable money-movement audit trail', NULL, 'LEGAL_REQUIREMENT_ACCOUNTING', TRUE, FALSE, 'Append-only; retained for accounting/audit'),
  ('billing.wallets', 'Pre-funded wallet balances', 36500, 'CONTRACT_SERVICE_PROVISION', FALSE, TRUE, 'Escrow/balance removed on account deletion'),
  ('billing.seller_earnings', 'Seller earnings entitlement records', 7300, 'CONTRACT_AND_ACCOUNTING', TRUE, FALSE, 'Retained; anonymized on deletion'),
  ('payments.payouts', 'Payout request records', 7300, 'CONTRACT_AND_ACCOUNTING', TRUE, FALSE, 'Retained; anonymized on deletion'),
  ('sessions.routing', 'Session routing records (buyer/seller linkage)', 3650, 'CONTRACT_AND_ACCOUNTING', TRUE, FALSE, 'Retained for billing disputes; anonymized on deletion'),
  ('billing.sessions', 'Session telemetry for billing', 3650, 'CONTRACT_AND_ACCOUNTING', TRUE, FALSE, 'Retained for billing disputes'),
  ('billing.usage_records', 'Usage metering for billing', 730, 'CONTRACT_AND_ACCOUNTING', TRUE, FALSE, 'Aggregate billing basis'),
  ('analytics.metrics', 'Aggregated product metrics', NULL, 'LEGITIMATE_INTEREST_PRODUCT', TRUE, FALSE, 'Aggregate; no personal identifiers retained'),
  ('analytics.session_telemetry', 'Session time-series telemetry', 730, 'CONTRACT_AND_NETWORK_OPS', TRUE, FALSE, 'Keyed by session id; no direct PII'),
  ('device.identifier', 'Client-generated hardware UUID', 3650, 'SECURITY_AND_FRAUD_PREVENTION', TRUE, FALSE, 'Not MAC/IMEI; client-generated UUID'),
  ('audit.audit_log', 'Security and compliance audit trail', 36500, 'LEGAL_REQUIREMENT_AND_SECURITY', TRUE, FALSE, 'Append-only governance log')
ON CONFLICT (category) DO NOTHING;

-- Sanctions/restricted-jurisdiction configuration (START-EMPTY by design).
-- No jurisdiction is pre-listed as restricted; operators may seed this table or
-- the SANCTIONED_COUNTRIES env override. Any restriction must be validated by
-- qualified counsel before activation.
CREATE TABLE IF NOT EXISTS compliance.sanctions_config (
    country_code CHAR(2) PRIMARY KEY,
    status VARCHAR(20) NOT NULL CHECK (status IN ('RESTRICTED','OBSERVE')),
    source TEXT,
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);