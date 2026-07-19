ALTER TABLE webhooks
  ADD COLUMN purpose text NOT NULL DEFAULT 'events'
  CHECK (purpose IN ('events', 'provisioning'));

CREATE INDEX webhooks_environment_purpose_idx
  ON webhooks(environment_id, purpose, created_at DESC);
