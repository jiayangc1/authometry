ALTER TABLE oauth_applications
  DROP CONSTRAINT IF EXISTS oauth_applications_token_endpoint_auth_method_check;
ALTER TABLE oauth_applications
  ADD CONSTRAINT oauth_applications_token_endpoint_auth_method_check
  CHECK (token_endpoint_auth_method IN ('none', 'client_secret_basic', 'client_secret_post', 'private_key_jwt'));

CREATE TABLE agent_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES oauth_applications(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  display_name text NOT NULL,
  operator_id text NOT NULL,
  public_jwk jsonb NOT NULL,
  capabilities text[] NOT NULL DEFAULT '{}',
  allowed_resources text[] NOT NULL DEFAULT '{}',
  may_receive_delegation boolean NOT NULL DEFAULT true,
  may_delegate boolean NOT NULL DEFAULT false,
  maximum_delegation_depth integer NOT NULL DEFAULT 0 CHECK (maximum_delegation_depth BETWEEN 0 AND 5),
  maximum_authorization_seconds integer NOT NULL DEFAULT 900 CHECK (maximum_authorization_seconds BETWEEN 60 AND 86400),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment_id, agent_id),
  UNIQUE (environment_id, application_id)
);

CREATE TABLE pushed_authorization_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES oauth_applications(id) ON DELETE CASCADE,
  agent_identity_id uuid NOT NULL REFERENCES agent_identities(id) ON DELETE CASCADE,
  request_uri text NOT NULL UNIQUE,
  parameters jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_assertion_jtis (
  agent_identity_id uuid NOT NULL REFERENCES agent_identities(id) ON DELETE CASCADE,
  jti text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_identity_id, jti)
);

CREATE TABLE dpop_proof_jtis (
  jkt text NOT NULL,
  jti text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (jkt, jti)
);

CREATE TABLE delegation_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES oauth_applications(id) ON DELETE CASCADE,
  subject_user_id uuid NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  actor_agent_id uuid NOT NULL REFERENCES agent_identities(id) ON DELETE CASCADE,
  parent_grant_id uuid REFERENCES delegation_grants(id) ON DELETE CASCADE,
  resource text NOT NULL,
  scopes text[] NOT NULL,
  authorization_details jsonb NOT NULL,
  purpose text NOT NULL,
  task_id text,
  dpop_jkt text,
  delegation_depth integer NOT NULL DEFAULT 0 CHECK (delegation_depth BETWEEN 0 AND 5),
  maximum_usage integer CHECK (maximum_usage IS NULL OR maximum_usage > 0),
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'revoked', 'expired')),
  approved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX delegation_grants_environment_status_idx
  ON delegation_grants(environment_id, status, expires_at);
CREATE INDEX delegation_grants_subject_idx ON delegation_grants(subject_user_id, created_at DESC);

ALTER TABLE authorization_codes
  ADD COLUMN delegation_grant_id uuid REFERENCES delegation_grants(id) ON DELETE SET NULL;

ALTER TABLE authorization_traces
  ADD COLUMN actor_agent_id uuid REFERENCES agent_identities(id) ON DELETE SET NULL,
  ADD COLUMN actor_snapshot jsonb,
  ADD COLUMN resource text,
  ADD COLUMN authorization_details jsonb,
  ADD COLUMN delegation_grant_id uuid REFERENCES delegation_grants(id) ON DELETE SET NULL,
  ADD COLUMN task_id text;
