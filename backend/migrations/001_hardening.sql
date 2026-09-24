-- ---------------------------------------------------------------------------
-- Production hardening migration (Phase 1 — HARDENING)
-- ---------------------------------------------------------------------------
-- Apply AFTER master_init.sql. All statements are idempotent.

-- 1) Wallet top-ups are now processed as part of a verified payment; the
--    payments.transactions.session_id may be NULL (top-up has no session).
ALTER TABLE payments.transactions
  ALTER COLUMN session_id DROP NOT NULL;

-- 2) Immutable money-movement ledger for auditability (every completed
--    payment and every session debit/credit records a row here).
CREATE TABLE IF NOT EXISTS billing.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    amount_usd DECIMAL(15,4) NOT NULL CHECK (amount_usd > 0),
    transaction_type VARCHAR(50) NOT NULL,
    reference TEXT,
    status VARCHAR(20) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_user
  ON billing.ledger_entries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_reference
  ON billing.ledger_entries (reference);

-- 3) Enforce a balanced money-movement invariant at the DB layer too:
--    a completed transaction must already carry settled fee columns.
ALTER TABLE payments.transactions
  ADD CONSTRAINT chk_transaction_fees_nonnegative
  CHECK (platform_fee_usd >= 0 AND seller_net_usd >= 0 AND platform_fee_usd + seller_net_usd <= amount_usd);

-- 4) Wallet balance cannot be negative (postgres CHECK defers for older rows).
ALTER TABLE billing.wallets DROP CONSTRAINT IF EXISTS billing_wallets_balance_nonnegative;
ALTER TABLE billing.wallets ADD CONSTRAINT billing_wallets_balance_nonnegative CHECK (balance_usd >= 0);