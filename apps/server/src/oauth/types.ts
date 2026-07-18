import type { AgentAuthorizationDetails } from "./agents.js";

export interface OAuthApplicationRow {
  id: string;
  workspace_id: string;
  environment_id: string;
  environment_slug: string;
  issuer: string;
  name: string;
  slug: string;
  client_id: string;
  client_id_source: "auto" | "manifest" | "dynamic";
  type: "web" | "spa" | "native" | "machine" | "device";
  status: "active" | "disabled";
  redirect_uris: string[];
  post_logout_redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method:
    "none" | "client_secret_basic" | "client_secret_post" | "private_key_jwt";
  require_pkce: boolean;
  require_consent: boolean;
  allowed_scopes: string[];
  access_token_lifetime_seconds: number;
  refresh_token_lifetime_seconds: number;
  authorization_code_lifetime_seconds: number;
  rotate_refresh_tokens: boolean;
}

export interface IdentityUserRow {
  id: string;
  workspace_id: string;
  email: string;
  name: string;
  password_hash: string | null;
  status: "active" | "disabled";
  groups: string[];
  custom_claims: Record<string, unknown>;
  email_verified_at: Date | null;
  last_authenticated_at: Date | null;
}

export interface PendingAuthorizationRow {
  id: string;
  workspace_id: string;
  environment_id: string;
  application_id: string;
  request_id: string;
  parameters: AuthorizationParameters;
  user_id: string | null;
  admin_user_id: string | null;
  status: "pending" | "awaiting_consent" | "approved" | "denied" | "completed" | "expired";
  expires_at: Date;
}

export interface AuthorizationParameters {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope: string;
  state?: string;
  nonce?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  prompt?: string;
  max_age?: string;
  resource?: string;
  authorization_details?: AgentAuthorizationDetails[];
  purpose?: string;
  task_id?: string;
  agent_id?: string;
}
