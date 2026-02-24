CREATE TABLE IF NOT EXISTS chain_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,
  program_id TEXT,
  event_type TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS advisory_messages (
  id BIGSERIAL PRIMARY KEY,
  message_text TEXT NOT NULL,
  confidence_score DOUBLE PRECISION,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
