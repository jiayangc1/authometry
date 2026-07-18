CREATE TABLE admin_social_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'github')),
  provider_subject text NOT NULL,
  provider_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject),
  UNIQUE (admin_user_id, provider)
);

ALTER TABLE admin_social_login_states
  ADD COLUMN intent text NOT NULL DEFAULT 'login' CHECK (intent IN ('login', 'link')),
  ADD COLUMN admin_user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE;

ALTER TABLE admin_social_login_states
  ADD CONSTRAINT admin_social_login_states_intent_target_check
  CHECK (
    (intent = 'login' AND admin_user_id IS NULL)
    OR (intent = 'link' AND admin_user_id IS NOT NULL)
  );

CREATE TABLE social_account_link_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  authorization_request_id uuid NOT NULL REFERENCES pending_authorization_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'github')),
  provider_subject text NOT NULL,
  provider_email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX social_account_link_tokens_expiry_idx ON social_account_link_tokens(expires_at);
