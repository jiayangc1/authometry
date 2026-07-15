CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  email_verified_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspace_memberships (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'developer', 'auditor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, admin_user_id)
);

CREATE TABLE environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('development', 'staging', 'production')),
  issuer text NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);
CREATE UNIQUE INDEX one_default_environment_per_workspace
  ON environments(workspace_id) WHERE is_default;

CREATE TABLE admin_refresh_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  family_id uuid NOT NULL,
  user_agent text,
  ip_address inet,
  expires_at timestamptz NOT NULL,
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_refresh_sessions_user_idx ON admin_refresh_sessions(admin_user_id);

CREATE TABLE personal_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  prefix text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE identity_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  password_hash text,
  email_verified_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  groups text[] NOT NULL DEFAULT '{}',
  custom_claims jsonb NOT NULL DEFAULT '{}',
  mfa_enabled boolean NOT NULL DEFAULT false,
  last_authenticated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);

CREATE TABLE social_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'github')),
  provider_subject text NOT NULL,
  provider_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, provider_subject)
);

CREATE TABLE one_time_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid,
  purpose text NOT NULL CHECK (purpose IN ('admin_bootstrap', 'email_verification', 'password_reset', 'account_link')),
  token_hash text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resource_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  consent_description text NOT NULL,
  sensitivity text NOT NULL CHECK (sensitivity IN ('standard', 'sensitive', 'restricted')),
  is_system boolean NOT NULL DEFAULT false,
  ownership text NOT NULL DEFAULT 'dashboard' CHECK (ownership IN ('dashboard', 'manifest')),
  manifest_path text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment_id, name)
);

CREATE TABLE oauth_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  client_id text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('web', 'spa', 'native', 'machine', 'device')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  description text,
  redirect_uris text[] NOT NULL DEFAULT '{}',
  post_logout_redirect_uris text[] NOT NULL DEFAULT '{}',
  grant_types text[] NOT NULL DEFAULT '{}',
  response_types text[] NOT NULL DEFAULT '{code}',
  token_endpoint_auth_method text NOT NULL DEFAULT 'client_secret_basic'
    CHECK (token_endpoint_auth_method IN ('none', 'client_secret_basic', 'client_secret_post')),
  require_pkce boolean NOT NULL DEFAULT true,
  require_consent boolean NOT NULL DEFAULT true,
  allowed_scopes text[] NOT NULL DEFAULT '{openid}',
  access_token_lifetime_seconds integer NOT NULL DEFAULT 900 CHECK (access_token_lifetime_seconds BETWEEN 60 AND 86400),
  refresh_token_lifetime_seconds integer NOT NULL DEFAULT 2592000 CHECK (refresh_token_lifetime_seconds BETWEEN 300 AND 31536000),
  authorization_code_lifetime_seconds integer NOT NULL DEFAULT 60 CHECK (authorization_code_lifetime_seconds BETWEEN 30 AND 600),
  rotate_refresh_tokens boolean NOT NULL DEFAULT true,
  ownership text NOT NULL DEFAULT 'dashboard' CHECK (ownership IN ('dashboard', 'manifest')),
  manifest_path text,
  last_used_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment_id, slug)
);

CREATE TABLE client_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES oauth_applications(id) ON DELETE CASCADE,
  name text NOT NULL,
  prefix text NOT NULL,
  secret_hash text NOT NULL,
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_credentials_application_idx ON client_credentials(application_id);

CREATE TABLE authorization_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  conditions jsonb NOT NULL,
  decision jsonb NOT NULL,
  application_ids uuid[] NOT NULL DEFAULT '{}',
  ownership text NOT NULL DEFAULT 'dashboard' CHECK (ownership IN ('dashboard', 'manifest')),
  manifest_path text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment_id, name)
);

CREATE TABLE claim_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_field text NOT NULL,
  target_claim text NOT NULL,
  include_in text[] NOT NULL,
  ownership text NOT NULL DEFAULT 'dashboard' CHECK (ownership IN ('dashboard', 'manifest')),
  manifest_path text,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (environment_id, name)
);

CREATE TABLE signing_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  kid text NOT NULL UNIQUE,
  algorithm text NOT NULL CHECK (algorithm IN ('RS256', 'ES256')),
  public_jwk jsonb NOT NULL,
  encrypted_private_jwk text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'retiring', 'retired')),
  activates_at timestamptz NOT NULL,
  retires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_signing_key_per_environment
  ON signing_keys(environment_id) WHERE status = 'active';

CREATE TABLE authorization_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES oauth_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  redirect_uri text NOT NULL,
  scope text[] NOT NULL,
  code_challenge text,
  code_challenge_method text,
  nonce text,
  auth_time timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refresh_token_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES oauth_applications(id) ON DELETE CASCADE,
  user_id uuid REFERENCES identity_users(id) ON DELETE CASCADE,
  scopes text[] NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'reused', 'expired')),
  revoked_reason text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES refresh_token_families(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  parent_id uuid REFERENCES refresh_tokens(id),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE device_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES oauth_applications(id) ON DELETE CASCADE,
  device_code_hash text NOT NULL UNIQUE,
  user_code text NOT NULL UNIQUE,
  scopes text[] NOT NULL,
  user_id uuid REFERENCES identity_users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'consumed', 'expired')),
  interval_seconds integer NOT NULL DEFAULT 5,
  last_polled_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  application_id uuid REFERENCES oauth_applications(id) ON DELETE CASCADE,
  session_token_hash text UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  scopes text[] NOT NULL DEFAULT '{}',
  ip_address inet,
  user_agent text,
  refresh_family_id uuid REFERENCES refresh_token_families(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE pending_authorization_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES oauth_applications(id) ON DELETE CASCADE,
  request_id text NOT NULL UNIQUE,
  parameters jsonb NOT NULL,
  user_id uuid REFERENCES identity_users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_consent', 'approved', 'denied', 'completed', 'expired')),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE authorization_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  request_id text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('success', 'denied', 'error', 'warning', 'pending')),
  event_type text NOT NULL,
  application_id uuid REFERENCES oauth_applications(id) ON DELETE SET NULL,
  application_name text,
  client_id text,
  user_id uuid REFERENCES identity_users(id) ON DELETE SET NULL,
  user_snapshot jsonb,
  grant_type text,
  endpoint text NOT NULL,
  method text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  duration_ms integer,
  oauth_error text,
  explanation jsonb,
  steps jsonb NOT NULL DEFAULT '[]',
  redacted_request jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX authorization_traces_environment_time_idx
  ON authorization_traces(environment_id, started_at DESC);
CREATE INDEX authorization_traces_status_idx ON authorization_traces(environment_id, status);

CREATE TABLE consent_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES oauth_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  scopes text[] NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (environment_id, application_id, user_id)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES environments(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('authorization', 'configuration', 'security', 'user', 'system')),
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'high')),
  event_type text NOT NULL,
  summary text NOT NULL,
  actor_type text,
  actor_id text,
  actor_name text,
  source_ip inet,
  user_agent text,
  resource_type text,
  resource_id text,
  changes jsonb,
  trace_id uuid REFERENCES authorization_traces(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_workspace_time_idx ON audit_events(workspace_id, created_at DESC);

CREATE TABLE configuration_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'cli',
  revision text,
  repository text,
  actor text NOT NULL,
  desired_hash text NOT NULL,
  manifest_snapshot jsonb NOT NULL,
  plan jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('applied', 'failed')),
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  hostname text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('pending', 'verified', 'failed')),
  verification_token_hash text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  secret_hash text NOT NULL,
  encrypted_secret text NOT NULL,
  secret_prefix text NOT NULL,
  subscribed_events text[] NOT NULL,
  status text NOT NULL CHECK (status IN ('enabled', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
  attempt integer NOT NULL DEFAULT 1,
  request_headers jsonb NOT NULL DEFAULT '{}',
  redacted_request_body jsonb NOT NULL DEFAULT '{}',
  response_status integer,
  response_headers jsonb,
  response_body text,
  duration_ms integer,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
