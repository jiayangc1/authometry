ALTER TABLE oauth_applications
  DROP CONSTRAINT IF EXISTS oauth_applications_client_id_source_check;
ALTER TABLE oauth_applications
  ADD CONSTRAINT oauth_applications_client_id_source_check
  CHECK (client_id_source IN ('auto', 'manifest', 'dynamic'));

ALTER TABLE pending_authorization_requests
  ADD COLUMN admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE authorization_codes
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN admin_user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE,
  ADD COLUMN resource text,
  ADD CONSTRAINT authorization_codes_single_principal_check
    CHECK (num_nonnulls(user_id, admin_user_id) = 1);

ALTER TABLE refresh_token_families
  ADD COLUMN admin_user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE,
  ADD COLUMN resource text,
  ADD CONSTRAINT refresh_token_families_single_principal_check
    CHECK (num_nonnulls(user_id, admin_user_id) <= 1);

ALTER TABLE admin_social_login_states ADD COLUMN return_to text;

CREATE TABLE mcp_admin_consent_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES oauth_applications(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  resource text NOT NULL,
  scopes text[] NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (environment_id, application_id, admin_user_id, resource)
);

INSERT INTO resource_scopes
  (workspace_id, environment_id, name, display_name, description, consent_description,
   sensitivity, is_system)
SELECT e.workspace_id, e.id, 'mcp:read', 'Read Authometry with MCP',
       'Read OAuth configuration and redacted authorization traces through the Authometry MCP server.',
       'View applications, scopes, environments, and redacted authorization traces',
       'sensitive', true
FROM environments e
ON CONFLICT (environment_id, name) DO NOTHING;
