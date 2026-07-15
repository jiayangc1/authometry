ALTER TABLE workspace_settings
  ADD COLUMN default_access_token_lifetime_seconds integer NOT NULL DEFAULT 900
    CHECK (default_access_token_lifetime_seconds BETWEEN 60 AND 86400),
  ADD COLUMN default_refresh_token_lifetime_seconds integer NOT NULL DEFAULT 2592000
    CHECK (default_refresh_token_lifetime_seconds BETWEEN 300 AND 31536000),
  ADD COLUMN require_consent boolean NOT NULL DEFAULT true;
