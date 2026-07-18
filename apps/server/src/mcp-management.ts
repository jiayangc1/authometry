import { z } from "zod";
import { createCsrfToken } from "./auth/admin.js";
import { env } from "./env.js";
import { signAdminAccessToken } from "./lib/security.js";

export const mcpReadScope = "mcp:read";
export const mcpWriteScope = "mcp:write";

export type ManagementMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface ManagementRequest {
  method: ManagementMethod;
  path: string;
  environment?: string;
  query?: Record<string, string | number | boolean | string[]>;
  body?: Record<string, unknown>;
}

export interface ManagementPrincipal {
  userId: string;
  email: string;
  workspaceId: string;
  role: string;
  sourceIp?: string;
  userAgent?: string;
}

export type ManagementDispatcher = (
  principal: ManagementPrincipal,
  request: ManagementRequest,
) => Promise<Record<string, unknown>>;

interface ManagementOperation {
  method: ManagementMethod;
  path: string;
  purpose: string;
  matcher: RegExp;
}

function operation(
  method: ManagementMethod,
  path: string,
  purpose: string,
  matcher: RegExp,
): ManagementOperation {
  return { method, path, purpose, matcher };
}

export const managementOperations: readonly ManagementOperation[] = [
  operation("GET", "/overview", "Read dashboard metrics and recent activity.", /^\/overview$/),
  operation("GET", "/applications", "List OAuth applications.", /^\/applications$/),
  operation(
    "POST",
    "/applications",
    "Create an OAuth application or machine service.",
    /^\/applications$/,
  ),
  operation("POST", "/applications/slug", "Preview an application slug.", /^\/applications\/slug$/),
  operation(
    "GET",
    "/applications/:applicationId",
    "Read an application and its credentials.",
    /^\/applications\/[^/]+$/,
  ),
  operation(
    "PATCH",
    "/applications/:applicationId",
    "Edit a dashboard-owned application.",
    /^\/applications\/[^/]+$/,
  ),
  operation(
    "POST",
    "/applications/:applicationId/credentials",
    "Create an application credential and return its secret once.",
    /^\/applications\/[^/]+\/credentials$/,
  ),
  operation(
    "POST",
    "/applications/:applicationId/credentials/:credentialId/revoke",
    "Revoke an application credential.",
    /^\/applications\/[^/]+\/credentials\/[^/]+\/revoke$/,
  ),
  operation("GET", "/agents", "List registered AI agents.", /^\/agents$/),
  operation("POST", "/agents", "Register an AI agent and its OAuth client.", /^\/agents$/),
  operation("GET", "/agents/:agentId", "Read an AI agent registration.", /^\/agents\/[^/]+$/),
  operation(
    "POST",
    "/agents/:agentId/disable",
    "Disable an AI agent and revoke descendant grants.",
    /^\/agents\/[^/]+\/disable$/,
  ),
  operation(
    "POST",
    "/agents/:agentId/enable",
    "Re-enable an AI agent.",
    /^\/agents\/[^/]+\/enable$/,
  ),
  operation(
    "POST",
    "/agents/:agentId/rotate-key",
    "Rotate an AI agent public key.",
    /^\/agents\/[^/]+\/rotate-key$/,
  ),
  operation("GET", "/agent-grants", "List agent task grants.", /^\/agent-grants$/),
  operation(
    "POST",
    "/agent-grants/:grantId/revoke",
    "Revoke an agent grant and its descendants.",
    /^\/agent-grants\/[^/]+\/revoke$/,
  ),
  operation(
    "POST",
    "/agent-grants/:grantId/usage",
    "Consume usage against an agent grant ancestry.",
    /^\/agent-grants\/[^/]+\/usage$/,
  ),
  operation("GET", "/traces", "List redacted authorization traces.", /^\/traces$/),
  operation("GET", "/traces/:traceId", "Read a redacted authorization trace.", /^\/traces\/[^/]+$/),
  operation("GET", "/users", "List identity users.", /^\/users$/),
  operation("POST", "/users", "Create a password identity user.", /^\/users$/),
  operation(
    "GET",
    "/users/:userId",
    "Read an identity user and related sessions.",
    /^\/users\/[^/]+$/,
  ),
  operation("GET", "/sessions", "List identity sessions.", /^\/sessions$/),
  operation(
    "POST",
    "/sessions/:sessionId/revoke",
    "Revoke an identity session and refresh family.",
    /^\/sessions\/[^/]+\/revoke$/,
  ),
  operation("GET", "/scopes", "List built-in and custom resource scopes.", /^\/scopes$/),
  operation("POST", "/scopes", "Create a custom resource scope.", /^\/scopes$/),
  operation(
    "PATCH",
    "/scopes/:scopeId",
    "Edit a dashboard-owned custom scope.",
    /^\/scopes\/[^/]+$/,
  ),
  operation("GET", "/policies", "List authorization policies.", /^\/policies$/),
  operation("POST", "/policies", "Create an authorization policy.", /^\/policies$/),
  operation("GET", "/policies/:policyId", "Read an authorization policy.", /^\/policies\/[^/]+$/),
  operation(
    "PATCH",
    "/policies/:policyId",
    "Edit a dashboard-owned authorization policy.",
    /^\/policies\/[^/]+$/,
  ),
  operation("GET", "/events", "List audit events.", /^\/events$/),
  operation("GET", "/environments", "List workspace environments.", /^\/environments$/),
  operation("GET", "/search", "Search applications and traces.", /^\/search$/),
  operation("GET", "/config/export", "Export configuration manifests.", /^\/config\/export$/),
  operation(
    "POST",
    "/config/apply",
    "Plan or atomically apply configuration manifests.",
    /^\/config\/apply$/,
  ),
  operation("GET", "/config/status", "Read configuration drift status.", /^\/config\/status$/),
  operation(
    "GET",
    "/config/deployments",
    "List configuration deployments.",
    /^\/config\/deployments$/,
  ),
  operation(
    "GET",
    "/settings/general",
    "Read general workspace settings.",
    /^\/settings\/general$/,
  ),
  operation(
    "PATCH",
    "/settings/general",
    "Edit general workspace settings.",
    /^\/settings\/general$/,
  ),
  operation(
    "GET",
    "/settings/providers",
    "Read configured identity and email providers.",
    /^\/settings\/providers$/,
  ),
  operation("GET", "/settings/domains", "List custom domains.", /^\/settings\/domains$/),
  operation("POST", "/settings/domains", "Add a custom domain.", /^\/settings\/domains$/),
  operation(
    "POST",
    "/settings/domains/:domainId/verify",
    "Verify a custom domain's DNS record.",
    /^\/settings\/domains\/[^/]+\/verify$/,
  ),
  operation("GET", "/settings/signing-keys", "List signing keys.", /^\/settings\/signing-keys$/),
  operation(
    "POST",
    "/settings/signing-keys/rotate",
    "Rotate the environment signing key.",
    /^\/settings\/signing-keys\/rotate$/,
  ),
  operation("GET", "/settings/webhooks", "List webhook subscriptions.", /^\/settings\/webhooks$/),
  operation(
    "POST",
    "/settings/webhooks",
    "Create a webhook and return its signing secret once.",
    /^\/settings\/webhooks$/,
  ),
  operation(
    "GET",
    "/settings/members",
    "List workspace members and invitations.",
    /^\/settings\/members$/,
  ),
  operation(
    "POST",
    "/settings/members",
    "Invite or update a workspace member.",
    /^\/settings\/members$/,
  ),
  operation(
    "PATCH",
    "/settings/members/:memberId",
    "Change a workspace member role.",
    /^\/settings\/members\/[^/]+$/,
  ),
  operation(
    "GET",
    "/settings/tokens",
    "List the current admin's personal access tokens.",
    /^\/settings\/tokens$/,
  ),
  operation(
    "POST",
    "/settings/tokens",
    "Create a personal access token and return it once.",
    /^\/settings\/tokens$/,
  ),
  operation(
    "POST",
    "/settings/tokens/:tokenId/revoke",
    "Revoke a personal access token.",
    /^\/settings\/tokens\/[^/]+\/revoke$/,
  ),
  operation(
    "GET",
    "/settings/danger",
    "Read destructive-operation context.",
    /^\/settings\/danger$/,
  ),
  operation(
    "POST",
    "/settings/danger/status",
    "Enable or disable installation authorization traffic.",
    /^\/settings\/danger\/status$/,
  ),
  operation(
    "DELETE",
    "/settings/danger/workspace",
    "Permanently delete the current workspace after confirmation.",
    /^\/settings\/danger\/workspace$/,
  ),
  operation(
    "GET",
    "/auth/me",
    "Read the current administrator and workspace memberships.",
    /^\/auth\/me$/,
  ),
  operation(
    "GET",
    "/auth/connections",
    "List linked administrator social accounts.",
    /^\/auth\/connections$/,
  ),
  operation(
    "POST",
    "/auth/connections/:provider",
    "Start linking a Google or GitHub administrator account.",
    /^\/auth\/connections\/(google|github)$/,
  ),
  operation(
    "DELETE",
    "/auth/connections/:provider",
    "Disconnect a Google or GitHub administrator account.",
    /^\/auth\/connections\/(google|github)$/,
  ),
  operation(
    "POST",
    "/auth/workspaces",
    "Create a workspace and its default environments.",
    /^\/auth\/workspaces$/,
  ),
];

export const managementOperationInputs: Readonly<Record<string, string>> = {
  "POST /applications":
    "Body: { name: string, slug: lowercase-hyphenated string, type: web|spa|native|machine|device, description?: string, redirectUris: absolute URI[], postLogoutRedirectUris?: absolute URI[] }.",
  "POST /applications/slug": "Body: { name: string }.",
  "PATCH /applications/:applicationId":
    "Body: { version: positive integer, name?: string, description?: string|null, redirectUris?: absolute URI[], postLogoutRedirectUris?: absolute URI[], requirePkce?: boolean, requireConsent?: boolean, allowedScopes?: scope name[] }.",
  "POST /applications/:applicationId/credentials":
    "Body: { name: string, expiresInDays: positive integer up to 365|null }. Returns the secret once.",
  "POST /applications/:applicationId/credentials/:credentialId/revoke": "No body.",
  "POST /agents":
    "Body: { agentId, displayName, operatorId, publicJwk, redirectUris: URI[], capabilities: string[], allowedResources: URI[], mayReceiveDelegation?: boolean, mayDelegate?: boolean, maximumDelegationDepth?: 0..5, maximumAuthorizationSeconds?: 60..86400 }.",
  "POST /agents/:agentId/disable": "No body.",
  "POST /agents/:agentId/enable": "No body.",
  "POST /agents/:agentId/rotate-key": "Body: { publicJwk: public RSA RS256 or EC ES256 JWK }.",
  "POST /agent-grants/:grantId/revoke": "Optional body: { reason?: string }.",
  "POST /agent-grants/:grantId/usage": "No body.",
  "POST /users":
    "Body: { name: string, email: email, password: string of at least 12 characters, groups?: string[] }.",
  "POST /sessions/:sessionId/revoke": "No body.",
  "POST /scopes":
    "Body: { name: scope name, displayName: string, description: string, consentDescription: string, sensitivity?: standard|sensitive|restricted }.",
  "PATCH /scopes/:scopeId":
    "Body: { version: positive integer, displayName?: string, description?: string, consentDescription?: string, sensitivity?: standard|sensitive|restricted }.",
  "POST /policies":
    "Body: { name: lowercase-hyphenated string, displayName: string, description?: string, enabled?: boolean, applicationIds?: UUID[], conditions: { all: [{ field, operator: equals|not_equals|contains|in, value }] }, otherwise: { deny: { code, message } } }.",
  "PATCH /policies/:policyId":
    "Body: { version: positive integer, displayName?: string, description?: string, enabled?: boolean, applicationIds?: UUID[], conditions?: { all: condition[] }, otherwise?: { deny: { code, message } } }.",
  "POST /config/apply":
    "Body: { manifests: [{ path: string, manifest: authometry.dev/v1alpha1 manifest }], secrets?: { [resourceKey]: secret }, revision?: string, repository?: string }.",
  "PATCH /settings/general":
    "Body: { workspaceName?: string, environmentName?: string, sessionLifetimeSeconds?: 300..31536000, traceRetentionDays?: 1..365, auditRetentionDays?: 30..2555 }.",
  "POST /settings/domains":
    "Body: { hostname: fully qualified domain name }. Returns the DNS TXT verification value.",
  "POST /settings/domains/:domainId/verify": "No body; verifies the published DNS TXT record.",
  "POST /settings/signing-keys/rotate": "No body.",
  "POST /settings/webhooks":
    "Body: { name: string, url: public HTTPS URL, subscribedEvents: string[] }. Returns the webhook signing secret once.",
  "POST /settings/members":
    "Body: { email: email, name: string, role: admin|developer|auditor|viewer }.",
  "PATCH /settings/members/:memberId": "Body: { role: owner|admin|developer|auditor|viewer }.",
  "POST /settings/tokens":
    "Body: { name: string, scopes: string[], expiresInDays?: positive integer up to 365|null }. Returns the token once.",
  "POST /settings/tokens/:tokenId/revoke": "No body.",
  "POST /settings/danger/status": "Body: { status: active|disabled }.",
  "DELETE /settings/danger/workspace":
    "Body: { confirmation: exact workspace name }. Permanently deletes the workspace.",
  "POST /auth/connections/:provider":
    "No body. Provider is google or github. Returns an authorizationUrl that the administrator must open.",
  "DELETE /auth/connections/:provider": "No body. Provider is google or github.",
  "POST /auth/workspaces": "Body: { name: string, slug: lowercase-hyphenated string }.",
};

export const managementQuerySchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string()).max(100)]))
  .default({});

export function assertManagementOperation(method: ManagementMethod, path: string): void {
  let validSegments = false;
  try {
    validSegments = path
      .split("/")
      .filter(Boolean)
      .every((segment) => {
        const decoded = decodeURIComponent(segment);
        return ![".", ".."].includes(decoded) && /^[a-zA-Z0-9._:-]+$/.test(decoded);
      });
  } catch {
    validSegments = false;
  }
  const validPath =
    path.startsWith("/") &&
    !path.includes("//") &&
    !path.includes("?") &&
    !path.includes("#") &&
    validSegments;
  const allowed = validPath
    ? managementOperations.some(
        (candidate) => candidate.method === method && candidate.matcher.test(path),
      )
    : false;
  if (!allowed) {
    throw new Error(
      `${method} ${path} is not an MCP-enabled management operation. Call list_management_operations for the supported paths.`,
    );
  }
}

function appendQuery(
  url: URL,
  values: Record<string, string | number | boolean | string[]> = {},
): void {
  for (const [key, rawValue] of Object.entries(values)) {
    for (const value of Array.isArray(rawValue) ? rawValue : [rawValue]) {
      url.searchParams.append(key, String(value));
    }
  }
}

export async function dispatchManagementRequest(
  principal: ManagementPrincipal,
  request: ManagementRequest,
): Promise<Record<string, unknown>> {
  assertManagementOperation(request.method, request.path);
  const url = new URL(`/api/v1${request.path}`, `http://127.0.0.1:${env.PORT}`);
  appendQuery(url, request.query);
  const [adminAccess, csrf] = await Promise.all([
    signAdminAccessToken(principal),
    Promise.resolve(createCsrfToken()),
  ]);
  const response = await fetch(url, {
    method: request.method,
    headers: {
      accept: "application/json, application/yaml, text/yaml, text/plain",
      cookie: `authometry_admin_access=${adminAccess}; authometry_csrf=${csrf}`,
      "x-authometry-csrf": csrf,
      "x-request-id": `mcp_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
      ...(request.environment ? { "x-authometry-environment": request.environment } : {}),
      ...(principal.sourceIp ? { "x-forwarded-for": principal.sourceIp } : {}),
      ...(principal.userAgent ? { "user-agent": principal.userAgent } : {}),
      ...(request.body ? { "content-type": "application/json" } : {}),
    },
    ...(request.body ? { body: JSON.stringify(request.body) } : {}),
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const data: unknown =
    response.status === 204
      ? null
      : contentType.includes("json")
        ? await response.json()
        : await response.text();
  const result = {
    status: response.status,
    requestId: response.headers.get("x-request-id"),
    data,
  };
  if (!response.ok) {
    const apiError =
      typeof data === "object" && data !== null && "error" in data
        ? (data as { error?: { code?: string; message?: string; requestId?: string } }).error
        : undefined;
    throw new Error(
      `${apiError?.code ?? `management_api_${response.status}`}: ${apiError?.message ?? `Management API request failed with HTTP ${response.status}.`}${apiError?.requestId ? ` (request ${apiError.requestId})` : ""}`,
    );
  }
  return result;
}
