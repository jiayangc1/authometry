CREATE TABLE revoked_access_tokens (
  jti text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES oauth_applications(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX revoked_access_tokens_expiry_idx ON revoked_access_tokens(expires_at);
