CREATE TABLE admin_social_login_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('google', 'github')),
  state_hash text NOT NULL UNIQUE,
  nonce_encrypted text NOT NULL,
  code_verifier_encrypted text NOT NULL,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_social_login_states_expiry_idx ON admin_social_login_states(expires_at);
