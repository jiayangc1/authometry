ALTER TABLE oauth_applications ADD COLUMN client_id_source text NOT NULL DEFAULT 'auto'
  CHECK (client_id_source IN ('auto', 'manifest'));
