CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.session_telemetry (
  id           BIGSERIAL PRIMARY KEY,
  session_id   UUID NOT NULL,
  bytes_in     BIGINT DEFAULT 0,
  bytes_out    BIGINT DEFAULT 0,
  latency_ms   INTEGER,
  recorded_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_telemetry_session ON analytics.session_telemetry (session_id);
CREATE INDEX idx_telemetry_time ON analytics.session_telemetry (recorded_at);
