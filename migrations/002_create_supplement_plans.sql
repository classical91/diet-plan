-- Separate from dinner_plans; initialized lazily by the sync endpoint as well.
CREATE TABLE IF NOT EXISTS supplement_plans (
  identity_hash TEXT PRIMARY KEY,
  plan JSONB NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
