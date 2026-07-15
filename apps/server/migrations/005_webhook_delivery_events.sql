ALTER TABLE webhook_deliveries
  ADD COLUMN audit_event_id uuid REFERENCES audit_events(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX webhook_deliveries_event_idx
  ON webhook_deliveries(webhook_id, audit_event_id) WHERE audit_event_id IS NOT NULL;
