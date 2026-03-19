CREATE SCHEMA IF NOT EXISTS sessions;

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

CREATE TABLE IF NOT EXISTS sessions.handoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions.sessions(id),
    old_seller_id UUID NOT NULL,
    new_seller_id UUID NOT NULL,
    handoff_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
