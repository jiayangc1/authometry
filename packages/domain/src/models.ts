export type WorkspaceRole = "owner" | "admin" | "developer" | "auditor" | "viewer";
export type EnvironmentKind = "development" | "staging" | "production";
export type ResourceOwnership = "dashboard" | "manifest";

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
}

export interface Environment {
  id: string;
  workspaceId: string;
  slug: string;
  name: string;
  kind: EnvironmentKind;
  issuer: string;
  isDefault: boolean;
}

export interface DeploymentProvenance {
  source: "cli";
  revision?: string;
  repository?: string;
  actor: string;
  appliedAt: string;
  manifestPath?: string;
}

export type ApplicationType = "web" | "spa" | "native" | "machine" | "device";
export type ApplicationStatus = "active" | "disabled";
export type OAuthGrantType =
  | "authorization_code"
  | "refresh_token"
  | "client_credentials"
  | "urn:ietf:params:oauth:grant-type:device_code";

export interface OAuthApplication {
  id: string;
  workspaceId: string;
  environmentId: string;
  name: string;
  slug: string;
  clientId: string;
  type: ApplicationType;
  status: ApplicationStatus;
  description?: string;
  logoUri?: string;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  grantTypes: OAuthGrantType[];
  responseTypes: string[];
  tokenEndpointAuthMethod: "none" | "client_secret_basic" | "client_secret_post";
  requirePkce: boolean;
  requireConsent: boolean;
  allowedScopes: string[];
  accessTokenLifetimeSeconds: number;
  refreshTokenLifetimeSeconds: number;
  authorizationCodeLifetimeSeconds: number;
  rotateRefreshTokens: boolean;
  ownership: ResourceOwnership;
  provenance?: DeploymentProvenance;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  version: number;
}

export type ScopeSensitivity = "standard" | "sensitive" | "restricted";

export interface OAuthScope {
  id: string;
  workspaceId: string;
  environmentId: string;
  name: string;
  displayName: string;
  description: string;
  consentDescription: string;
  sensitivity: ScopeSensitivity;
  system: boolean;
  ownership: ResourceOwnership;
}

export type PolicyOperator = "equals" | "not_equals" | "contains" | "in";

export interface PolicyCondition {
  field: string;
  operator: PolicyOperator;
  value: string | string[] | boolean | number;
}

export interface AuthorizationPolicy {
  id: string;
  workspaceId: string;
  environmentId: string;
  name: string;
  displayName: string;
  description: string;
  enabled: boolean;
  match: { all: PolicyCondition[] };
  decision: { allow: true };
  otherwise: { deny: { code: string; message: string } };
  applicationIds: string[];
  ownership: ResourceOwnership;
  version: number;
}

export interface UserIdentity {
  id: string;
  workspaceId: string;
  email: string;
  name: string;
  emailVerified: boolean;
  status: "active" | "disabled";
  connection: "password" | "google" | "github";
  groups: string[];
  mfaEnabled: boolean;
  createdAt: string;
  lastAuthenticatedAt?: string;
}

export interface UserSession {
  id: string;
  workspaceId: string;
  environmentId: string;
  userId: string;
  applicationId: string;
  status: "active" | "expired" | "revoked";
  scopes: string[];
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  tokenFamilyStatus: "active" | "revoked" | "reused";
}

export interface AuditEvent {
  id: string;
  workspaceId: string;
  environmentId?: string;
  category: "authorization" | "configuration" | "security" | "user" | "system";
  severity: "info" | "warning" | "high";
  type: string;
  summary: string;
  actor?: string;
  resourceType?: string;
  resourceId?: string;
  sourceIp?: string;
  changes?: Array<{ path: string; before?: unknown; after?: unknown }>;
  traceId?: string;
  createdAt: string;
}
