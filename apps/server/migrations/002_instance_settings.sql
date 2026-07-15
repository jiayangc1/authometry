CREATE TABLE workspace_settings (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  session_lifetime_seconds integer NOT NULL DEFAULT 604800
    CHECK (session_lifetime_seconds BETWEEN 300 AND 31536000),
  trace_retention_days integer NOT NULL DEFAULT 30 CHECK (trace_retention_days BETWEEN 1 AND 365),
  audit_retention_days integer NOT NULL DEFAULT 365 CHECK (audit_retention_days BETWEEN 30 AND 2555),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO workspace_settings(workspace_id, display_name)
SELECT id, name FROM workspaces ON CONFLICT (workspace_id) DO NOTHING;

CREATE TABLE social_login_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  authorization_request_id uuid REFERENCES pending_authorization_requests(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'github')),
  state_hash text NOT NULL UNIQUE,
  nonce_hash text,
  nonce_encrypted text,
  code_verifier_encrypted text,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX social_login_states_expiry_idx ON social_login_states(expires_at);
