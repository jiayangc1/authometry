ALTER TABLE oauth_applications
  ADD COLUMN portal_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN launch_uri text;

ALTER TABLE identity_users
  ADD COLUMN mfa_totp_secret_encrypted text;

CREATE TABLE user_application_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES oauth_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  last_launched_at timestamptz,
  UNIQUE (environment_id, application_id, user_id)
);

CREATE INDEX user_application_assignments_user_idx
  ON user_application_assignments(user_id, environment_id);

CREATE TABLE identity_mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX identity_mfa_recovery_codes_user_idx
  ON identity_mfa_recovery_codes(user_id) WHERE used_at IS NULL;

CREATE TABLE portal_social_login_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES identity_users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'github')),
  intent text NOT NULL CHECK (intent IN ('login', 'link')),
  state_hash text NOT NULL UNIQUE,
  nonce_encrypted text NOT NULL,
  code_verifier_encrypted text NOT NULL,
  redirect_uri text NOT NULL,
  return_to text NOT NULL DEFAULT '/portal',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_social_state_target_check CHECK (
    (intent = 'login' AND user_id IS NULL)
    OR (intent = 'link' AND user_id IS NOT NULL)
  )
);

CREATE INDEX portal_social_login_states_expiry_idx
  ON portal_social_login_states(expires_at);
