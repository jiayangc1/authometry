import { compare } from "bcryptjs";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { completeAdminSocialLogin, optionalAdmin, requireCsrf } from "../auth/admin.js";
import { env } from "../env.js";
import { query, transaction } from "../db.js";
import {
  decrypt,
  encrypt,
  hashToken,
  randomId,
  randomToken,
  sha256Base64Url,
} from "../lib/crypto.js";
import { ApiError, asyncRoute } from "../lib/http.js";
import { verifyIdentityMfa } from "../lib/identity-mfa.js";
import { evaluateAll } from "../lib/policy.js";
import { exchangeSocialCode, socialAuthorizationUrl } from "../lib/social.js";
import { TraceRecorder } from "../lib/trace.js";
import { assertApplicationRoute, findApplicationByClientId } from "./common.js";
import { mcpResourceForIssuer, resourceIndicatorsMatch } from "./resources.js";
import {
  actionCoveredByScopes,
  findAgentForClient,
  isLocationWithinResource,
  maximumUsage,
  verifyAgentAssertion,
  type AgentAuthorizationDetails,
} from "./agents.js";
import type {
  AuthorizationParameters,
  IdentityUserRow,
  OAuthApplicationRow,
  PendingAuthorizationRow,
} from "./types.js";

const userSessionCookie = "authometry_user_session";

interface McpAdminUser {
  id: string;
  email: string;
  name: string;
  workspace_id: string;
  role: string;
}

function isMcpAuthorization(
  parameters: AuthorizationParameters,
  application: OAuthApplicationRow,
): boolean {
  const scopes = parameters.scope.split(" ").filter(Boolean);
  return (
    scopes.includes("mcp:read") &&
    scopes.every((scope) => ["mcp:read", "mcp:write", "offline_access"].includes(scope)) &&
    Boolean(
      parameters.resource &&
      resourceIndicatorsMatch(parameters.resource, mcpResourceForIssuer(application.issuer)),
    )
  );
}

function oauthRedirect(
  parameters: AuthorizationParameters,
  error: string,
  description?: string,
): string {
  const redirect = new URL(parameters.redirect_uri);
  redirect.searchParams.set("error", error);
  if (description) redirect.searchParams.set("error_description", description);
  if (parameters.state) redirect.searchParams.set("state", parameters.state);
  return redirect.toString();
}

function enforceAdminCsrf(request: Request, response: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    requireCsrf(request, response, (error?: unknown) => {
      if (error) {
        reject(error instanceof Error ? error : new Error("CSRF validation failed."));
      } else resolve();
    });
  });
}

const authorizationSchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  response_type: z.literal("code"),
  scope: z.string().min(1),
  state: z.string().max(2048).optional(),
  nonce: z.string().max(2048).optional(),
  code_challenge: z.string().min(43).max(128).optional(),
  code_challenge_method: z.literal("S256").optional(),
  prompt: z.enum(["none", "login", "consent", "select_account"]).optional(),
  max_age: z.string().regex(/^\d+$/).optional(),
  resource: z.string().url().optional(),
});

const agentActionSchema = z.object({
  type: z.literal("agent_action"),
  actions: z.array(z.string().min(1)).min(1).max(25),
  locations: z.array(z.string().url()).min(1).max(25),
  resource: z.string().min(1),
  constraints: z.record(z.string(), z.unknown()).optional(),
  purpose: z.string().min(1).max(500).optional(),
});

const parSchema = authorizationSchema.extend({
  authorization_details: z.string().transform((value, context) => {
    try {
      return z.array(agentActionSchema).min(1).max(25).parse(JSON.parse(value));
    } catch {
      context.addIssue({
        code: "custom",
        message: "authorization_details must be valid agent actions",
      });
      return z.NEVER;
    }
  }),
  purpose: z.string().min(1).max(500),
  task_id: z.string().min(1).max(200).optional(),
});

async function resolveAuthorizationParameters(
  queryInput: unknown,
): Promise<AuthorizationParameters> {
  const pushed = z
    .object({ client_id: z.string().min(1), request_uri: z.string().min(1) })
    .safeParse(queryInput);
  if (!pushed.success) return authorizationSchema.parse(queryInput) as AuthorizationParameters;
  const [stored] = await query<{ parameters: AuthorizationParameters }>(
    `UPDATE pushed_authorization_requests p SET consumed_at = now()
     FROM oauth_applications a
     WHERE p.application_id = a.id AND p.request_uri = $1 AND a.client_id = $2
       AND p.consumed_at IS NULL AND p.expires_at > now()
     RETURNING p.parameters`,
    [pushed.data.request_uri, pushed.data.client_id],
  );
  if (!stored) {
    throw new ApiError(
      400,
      "invalid_request_uri",
      "The pushed authorization request is invalid, expired, or already used.",
    );
  }
  return stored.parameters;
}

async function loadPending(requestId: string): Promise<{
  pending: PendingAuthorizationRow;
  application: OAuthApplicationRow;
}> {
  const [pending] = await query<PendingAuthorizationRow>(
    "SELECT * FROM pending_authorization_requests WHERE request_id = $1",
    [requestId],
  );
  if (
    !pending ||
    pending.expires_at < new Date() ||
    ["completed", "denied", "expired"].includes(pending.status)
  ) {
    throw new ApiError(
      404,
      "authorization_request_not_found",
      "This authorization request is invalid or expired.",
    );
  }
  const application = await findApplicationByClientId(pending.parameters.client_id);
  if (!application)
    throw new ApiError(404, "application_not_found", "The application no longer exists.");
  return { pending, application };
}

async function existingUserSession(
  rawToken: string | undefined,
  workspaceId: string,
): Promise<IdentityUserRow | undefined> {
  if (!rawToken) return undefined;
  const [user] = await query<IdentityUserRow>(
    `SELECT u.* FROM user_sessions s JOIN identity_users u ON u.id = s.user_id
     WHERE s.session_token_hash = $1 AND s.workspace_id = $2 AND s.status = 'active'
       AND s.expires_at > now() AND u.status = 'active'`,
    [hashToken(rawToken), workspaceId],
  );
  return user;
}

function setUserSessionCookie(response: Response, token: string): void {
  response.cookie(userSessionCookie, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

async function continueAfterAuthentication(
  request: Request,
  response: Response,
  pending: PendingAuthorizationRow,
  application: OAuthApplicationRow,
  user: IdentityUserRow,
  jsonResponse = false,
): Promise<void> {
  const sessionToken = randomToken(40);
  await transaction(async (client) => {
    await client.query("UPDATE identity_users SET last_authenticated_at = now() WHERE id = $1", [
      user.id,
    ]);
    await client.query(
      `INSERT INTO user_sessions
        (workspace_id, environment_id, user_id, application_id, session_token_hash, status,
         scopes, ip_address, user_agent, expires_at)
       VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$8,now() + interval '7 days')`,
      [
        application.workspace_id,
        application.environment_id,
        user.id,
        application.id,
        hashToken(sessionToken),
        pending.parameters.scope.split(" "),
        request.ip,
        request.get("user-agent") ?? null,
      ],
    );
    await client.query("UPDATE pending_authorization_requests SET user_id = $1 WHERE id = $2", [
      user.id,
      pending.id,
    ]);
  });
  setUserSessionCookie(response, sessionToken);
  const [consent] = await query<{ scopes: string[] }>(
    `SELECT scopes FROM consent_grants
     WHERE environment_id = $1 AND application_id = $2 AND user_id = $3 AND revoked_at IS NULL`,
    [application.environment_id, application.id, user.id],
  );
  const requestedScopes = pending.parameters.scope.split(" ");
  if (
    pending.parameters.agent_id ||
    (application.require_consent &&
      !requestedScopes.every((scope) => consent?.scopes.includes(scope)))
  ) {
    await query(
      "UPDATE pending_authorization_requests SET status = 'awaiting_consent' WHERE id = $1",
      [pending.id],
    );
    const next = `${env.PUBLIC_ORIGIN}/authorize/consent?request_id=${encodeURIComponent(pending.request_id)}`;
    if (jsonResponse) response.json({ next });
    else response.redirect(next);
    return;
  }
  const next = await authorizationRedirect(pending, application, {
    ...user,
    last_authenticated_at: new Date(),
  });
  if (jsonResponse) response.json({ next });
  else response.redirect(next);
}

async function mcpAuthorizationRedirect(
  pending: PendingAuthorizationRow,
  application: OAuthApplicationRow,
  admin: McpAdminUser,
): Promise<string> {
  const code = randomToken(32);
  const scopes = pending.parameters.scope.split(" ").filter(Boolean);
  const resource = mcpResourceForIssuer(application.issuer);
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO authorization_codes
        (workspace_id, environment_id, application_id, user_id, admin_user_id, code_hash,
         redirect_uri, scope, code_challenge, code_challenge_method, nonce, auth_time,
         resource, expires_at)
       VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,now(),$11,
               now() + ($12 * interval '1 second'))`,
      [
        application.workspace_id,
        application.environment_id,
        application.id,
        admin.id,
        hashToken(code),
        pending.parameters.redirect_uri,
        scopes,
        pending.parameters.code_challenge ?? null,
        pending.parameters.code_challenge_method ?? null,
        pending.parameters.nonce ?? null,
        resource,
        application.authorization_code_lifetime_seconds,
      ],
    );
    await client.query(
      `UPDATE pending_authorization_requests
       SET status = 'completed', admin_user_id = $1, completed_at = now() WHERE id = $2`,
      [admin.id, pending.id],
    );
    await client.query(
      `UPDATE authorization_traces SET status = 'success', event_type = 'authorization_code_issued',
         user_snapshot = $2, resource = $3,
         steps = steps || $4::jsonb, completed_at = now(),
         duration_ms = extract(milliseconds from now() - started_at)::integer
       WHERE request_id = $1`,
      [
        pending.request_id,
        { id: admin.id, email: admin.email, name: admin.name, principal: "admin" },
        resource,
        JSON.stringify([
          {
            id: `${pending.request_id}_step_admin_authenticated`,
            index: 4,
            name: "Authometry admin authenticated",
            status: "passed",
            summary: admin.email,
            description: "The workspace administrator completed authentication.",
            startedOffsetMs: 0,
            decision: { outcome: "allowed", reason: `Authenticated with the ${admin.role} role.` },
          },
          {
            id: `${pending.request_id}_step_mcp_consent`,
            index: 5,
            name: "MCP consent approved",
            status: "passed",
            summary: scopes.join(" "),
            description: "The administrator approved access to the Authometry MCP server.",
            startedOffsetMs: 0,
          },
          {
            id: `${pending.request_id}_step_code`,
            index: 6,
            name: "Authorization code issued",
            status: "passed",
            summary: "Resource-bound one-time code created",
            description: "The code can only be exchanged for the approved MCP resource.",
            startedOffsetMs: 0,
          },
        ]),
      ],
    );
  });
  const redirect = new URL(pending.parameters.redirect_uri);
  redirect.searchParams.set("code", code);
  if (pending.parameters.state) redirect.searchParams.set("state", pending.parameters.state);
  redirect.searchParams.set("iss", application.issuer);
  return redirect.toString();
}

async function continueMcpAuthorization(
  request: Request,
  response: Response,
  pending: PendingAuthorizationRow,
  application: OAuthApplicationRow,
): Promise<void> {
  const principal = await optionalAdmin(request);
  if (!principal || principal.workspaceId !== application.workspace_id) {
    if (pending.parameters.prompt === "none") {
      response.redirect(oauthRedirect(pending.parameters, "login_required"));
      return;
    }
    const consentPath = `/authorize/consent?request_id=${encodeURIComponent(pending.request_id)}`;
    const login = new URL("/login", env.PUBLIC_ORIGIN);
    login.searchParams.set("returnTo", consentPath);
    response.redirect(login.toString());
    return;
  }
  const [admin] = await query<McpAdminUser>(
    `SELECT u.id, u.email, u.name, m.workspace_id, m.role
     FROM admin_users u JOIN workspace_memberships m ON m.admin_user_id = u.id
     WHERE u.id = $1 AND m.workspace_id = $2 AND u.disabled_at IS NULL`,
    [principal.userId, application.workspace_id],
  );
  if (!admin) {
    response.redirect(oauthRedirect(pending.parameters, "login_required"));
    return;
  }
  const resource = mcpResourceForIssuer(application.issuer);
  const requestedScopes = pending.parameters.scope.split(" ").filter(Boolean);
  const [consent] = await query<{ scopes: string[] }>(
    `SELECT scopes FROM mcp_admin_consent_grants
     WHERE environment_id = $1 AND application_id = $2 AND admin_user_id = $3
       AND resource = $4 AND revoked_at IS NULL`,
    [application.environment_id, application.id, admin.id, resource],
  );
  const consentCoversRequest = requestedScopes.every((scope) => consent?.scopes.includes(scope));
  if (pending.parameters.prompt !== "consent" && consentCoversRequest) {
    response.redirect(await mcpAuthorizationRedirect(pending, application, admin));
    return;
  }
  if (pending.parameters.prompt === "none") {
    response.redirect(oauthRedirect(pending.parameters, "consent_required"));
    return;
  }
  await query(
    `UPDATE pending_authorization_requests
     SET status = 'awaiting_consent', admin_user_id = $1 WHERE id = $2`,
    [admin.id, pending.id],
  );
  response.redirect(
    `${env.PUBLIC_ORIGIN}/authorize/consent?request_id=${encodeURIComponent(pending.request_id)}`,
  );
}

async function authorizationRedirect(
  pending: PendingAuthorizationRow,
  application: OAuthApplicationRow,
  user: IdentityUserRow,
): Promise<string> {
  const parameters = pending.parameters;
  const authorizationStepIndex = parameters.agent_id ? 7 : 4;
  const policies = await query<{
    id: string;
    display_name: string;
    conditions: {
      all: Array<{
        field: string;
        operator: "equals" | "not_equals" | "contains" | "in";
        value: string | string[] | boolean | number;
      }>;
    };
    decision: { otherwise?: { deny?: { code?: string; message?: string } } };
  }>(
    `SELECT id, display_name, conditions, decision FROM authorization_policies
     WHERE environment_id = $1 AND enabled = true AND (cardinality(application_ids) = 0 OR $2 = ANY(application_ids))
     ORDER BY name`,
    [application.environment_id, application.id],
  );
  for (const policy of policies) {
    const allowed = evaluateAll(policy.conditions.all, {
      environment: application.environment_slug,
      user: { groups: user.groups, email: user.email },
      application: { id: application.id, slug: application.slug, type: application.type },
      request: { scopes: parameters.scope.split(" ") },
    });
    if (!allowed) {
      const denial = policy.decision.otherwise?.deny;
      await transaction(async (client) => {
        await client.query(
          "UPDATE pending_authorization_requests SET status = 'denied', completed_at = now() WHERE id = $1",
          [pending.id],
        );
        await client.query(
          `UPDATE authorization_traces SET status = 'denied', event_type = 'policy_denied', oauth_error = 'access_denied',
             explanation = $2, steps = steps || $3::jsonb, completed_at = now(),
             duration_ms = extract(milliseconds from now() - started_at)::integer WHERE request_id = $1`,
          [
            pending.request_id,
            {
              code: denial?.code ?? "policy_denied",
              title: "Authorization policy denied the request",
              message:
                denial?.message ?? `${policy.display_name} did not match the request context.`,
              resolution: "Review the user's attributes or update the policy conditions.",
              action: { label: "Open policy", href: `/policies/${policy.id}` },
            },
            JSON.stringify([
              {
                id: `${pending.request_id}_policy`,
                index: 5,
                name: `Policy: ${policy.display_name}`,
                status: "failed",
                summary: denial?.message ?? "Policy conditions did not match",
                description: "The request was rejected by an authorization policy.",
                startedOffsetMs: 0,
                decision: {
                  outcome: "denied",
                  reason: denial?.message ?? "Policy conditions did not match.",
                },
              },
              {
                id: `${pending.request_id}_code_skipped`,
                index: 6,
                name: "Authorization code issued",
                status: "skipped",
                summary: "Not executed",
                description: "Execution stopped at the rejecting policy.",
                startedOffsetMs: 0,
              },
            ]),
          ],
        );
      });
      const denied = new URL(parameters.redirect_uri);
      denied.searchParams.set("error", "access_denied");
      denied.searchParams.set(
        "error_description",
        denial?.message ?? "Authorization policy denied the request.",
      );
      if (parameters.state) denied.searchParams.set("state", parameters.state);
      return denied.toString();
    }
  }
  const code = randomToken(32);
  await transaction(async (client) => {
    let delegationGrantId: string | null = null;
    let actorAgentId: string | null = null;
    let actorSnapshot: Record<string, string> | null = null;
    if (parameters.agent_id && parameters.resource && parameters.authorization_details) {
      const agent = await findAgentForClient(parameters.client_id);
      if (!agent || agent.agent_id !== parameters.agent_id || agent.status !== "active") {
        throw new ApiError(400, "invalid_client", "The registered agent is no longer active.");
      }
      const created = await client.query<{ id: string }>(
        `INSERT INTO delegation_grants
          (workspace_id, environment_id, application_id, subject_user_id, actor_agent_id,
           resource, scopes, authorization_details, purpose, task_id, maximum_usage, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
                 now() + ($12 * interval '1 second')) RETURNING id`,
        [
          application.workspace_id,
          application.environment_id,
          application.id,
          user.id,
          agent.id,
          parameters.resource,
          parameters.scope.split(" ").filter(Boolean),
          parameters.authorization_details,
          parameters.purpose ??
            parameters.authorization_details[0]?.purpose ??
            "Approved agent task",
          parameters.task_id ?? null,
          maximumUsage(parameters.authorization_details),
          Math.min(agent.maximum_authorization_seconds, application.access_token_lifetime_seconds),
        ],
      );
      delegationGrantId = created.rows[0]?.id ?? null;
      actorAgentId = agent.id;
      actorSnapshot = {
        id: agent.agent_id,
        displayName: agent.display_name,
        operator: agent.operator_id,
      };
    }
    await client.query(
      `INSERT INTO authorization_codes
        (workspace_id, environment_id, application_id, user_id, code_hash, redirect_uri, scope,
         code_challenge, code_challenge_method, nonce, auth_time, resource, expires_at,
         delegation_grant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
               now() + ($13 * interval '1 second'),$14)`,
      [
        application.workspace_id,
        application.environment_id,
        application.id,
        user.id,
        hashToken(code),
        parameters.redirect_uri,
        parameters.scope.split(" "),
        parameters.code_challenge ?? null,
        parameters.code_challenge_method ?? null,
        parameters.nonce ?? null,
        user.last_authenticated_at ?? new Date(),
        parameters.resource ?? null,
        application.authorization_code_lifetime_seconds,
        delegationGrantId,
      ],
    );
    await client.query(
      "UPDATE pending_authorization_requests SET status = 'completed', user_id = $1, completed_at = now() WHERE id = $2",
      [user.id, pending.id],
    );
    await client.query(
      `UPDATE authorization_traces SET status = 'success', event_type = 'authorization_code_issued',
         user_id = $1, user_snapshot = $2,
         steps = steps || $3::jsonb, completed_at = now(), duration_ms = extract(milliseconds from now() - started_at)::integer,
         actor_agent_id = $5, actor_snapshot = $6, resource = $7,
         authorization_details = $8, delegation_grant_id = $9, task_id = $10
       WHERE request_id = $4`,
      [
        user.id,
        { id: user.id, email: user.email, name: user.name },
        JSON.stringify([
          {
            id: `${pending.request_id}_step_authenticated`,
            index: authorizationStepIndex,
            name: "User authenticated",
            status: "passed",
            summary: user.email,
            description: "The user completed authentication.",
            startedOffsetMs: 0,
            decision: { outcome: "allowed", reason: "The user session is valid." },
          },
          {
            ...(delegationGrantId
              ? {
                  id: `${pending.request_id}_step_grant`,
                  index: authorizationStepIndex + 1,
                  name: "Delegation grant created",
                  status: "passed",
                  summary: parameters.purpose ?? "Approved agent task",
                  description:
                    "The user's decision was recorded independently from the access token.",
                  startedOffsetMs: 0,
                  decision: {
                    outcome: "allowed",
                    reason: "The user explicitly approved this structured agent task.",
                  },
                }
              : {
                  id: `${pending.request_id}_step_consent`,
                  index: authorizationStepIndex + 1,
                  name: "Consent evaluated",
                  status: "passed",
                  summary: "Access approved",
                  description: "The requested access was approved.",
                  startedOffsetMs: 0,
                }),
          },
          {
            id: `${pending.request_id}_step_code`,
            index: authorizationStepIndex + 2,
            name: "Authorization code issued",
            status: "passed",
            summary: "One-time code created",
            description: "A short-lived, single-use authorization code was issued.",
            startedOffsetMs: 0,
          },
          {
            id: `${pending.request_id}_step_redirect`,
            index: authorizationStepIndex + 3,
            name: "Redirect completed",
            status: "passed",
            summary: "302 Found",
            description: "The user agent was redirected to the registered redirect URI.",
            startedOffsetMs: 0,
          },
        ]),
        pending.request_id,
        actorAgentId,
        actorSnapshot,
        parameters.resource ?? null,
        parameters.authorization_details ?? null,
        delegationGrantId,
        parameters.task_id ?? null,
      ],
    );
  });
  const redirect = new URL(parameters.redirect_uri);
  redirect.searchParams.set("code", code);
  if (parameters.state) redirect.searchParams.set("state", parameters.state);
  redirect.searchParams.set("iss", application.issuer);
  return redirect.toString();
}

export const authorizationRouter = Router();

authorizationRouter.post(
  "/par",
  asyncRoute(async (request, response) => {
    const input = parSchema.parse(request.body);
    const application = await findApplicationByClientId(input.client_id);
    if (!application || application.status !== "active") {
      throw new ApiError(401, "invalid_client", "The requested OAuth client is not available.");
    }
    assertApplicationRoute(application, request);
    const assertion = request.get("authorization")?.match(/^AgentAssertion (.+)$/)?.[1];
    if (!assertion)
      throw new ApiError(401, "invalid_client", "A signed agent assertion is required.");
    const agent = await verifyAgentAssertion(
      assertion,
      input.client_id,
      `${application.issuer}/oauth/par`,
    );
    if (!agent.may_receive_delegation) {
      throw new ApiError(400, "unauthorized_client", "This agent cannot receive user delegation.");
    }
    const requestedScopes = input.scope.split(" ").filter(Boolean);
    if (
      !requestedScopes.every(
        (scope) =>
          scope === "openid" || scope === "agent:delegate" || agent.capabilities.includes(scope),
      )
    ) {
      throw new ApiError(
        400,
        "invalid_scope",
        "The request exceeds the agent's registered capabilities.",
      );
    }
    const requestedCapabilities = requestedScopes.filter((scope) =>
      agent.capabilities.includes(scope),
    );
    const actionCapabilities = input.authorization_details.flatMap((detail) =>
      detail.actions.flatMap((action) => {
        const matches = agent.capabilities.filter((scope) =>
          actionCoveredByScopes(action, [scope]),
        );
        const selected = requestedCapabilities.length
          ? matches.filter((scope) => requestedCapabilities.includes(scope))
          : matches;
        if (selected.length !== 1) {
          throw new ApiError(
            400,
            "invalid_authorization_details",
            `Action ${action} must map to exactly one requested agent capability.`,
          );
        }
        return selected;
      }),
    );
    const scopes = [...new Set(actionCapabilities)];
    if (!scopes.length) {
      throw new ApiError(
        400,
        "invalid_scope",
        "The structured request does not map to a registered agent capability.",
      );
    }
    if (!input.resource || !agent.allowed_resources.includes(input.resource)) {
      throw new ApiError(
        400,
        "invalid_target",
        "The requested resource is not assigned to this agent.",
      );
    }
    const malformedDetail = input.authorization_details.some(
      (detail) =>
        !detail.locations.every((location) =>
          isLocationWithinResource(location, input.resource!),
        ) || !detail.actions.every((action) => actionCoveredByScopes(action, scopes)),
    );
    if (malformedDetail) {
      throw new ApiError(
        400,
        "invalid_authorization_details",
        "Agent actions and locations must be covered by the requested scope and resource.",
      );
    }
    if (!application.redirect_uris.includes(input.redirect_uri)) {
      throw new ApiError(
        400,
        "invalid_request",
        "The redirect URI is not registered for this agent.",
      );
    }
    if (!input.code_challenge || input.code_challenge_method !== "S256") {
      throw new ApiError(400, "invalid_request", "Agent authorization requires S256 PKCE.");
    }
    const requestUri = `urn:ietf:params:oauth:request_uri:${randomId("par", 18)}`;
    const parameters = JSON.parse(
      JSON.stringify({
        ...input,
        scope: scopes.join(" "),
        authorization_details: input.authorization_details as AgentAuthorizationDetails[],
        agent_id: agent.agent_id,
      }),
    ) as AuthorizationParameters;
    await query(
      `INSERT INTO pushed_authorization_requests
        (workspace_id, environment_id, application_id, agent_identity_id, request_uri, parameters, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,now() + interval '90 seconds')`,
      [
        application.workspace_id,
        application.environment_id,
        application.id,
        agent.id,
        requestUri,
        parameters,
      ],
    );
    response.set("Cache-Control", "no-store");
    response.status(201).json({ request_uri: requestUri, expires_in: 90 });
  }),
);

authorizationRouter.get(
  "/authorize",
  asyncRoute(async (request, response) => {
    let parameters: AuthorizationParameters;
    try {
      parameters = await resolveAuthorizationParameters(request.query);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, "invalid_request", "The authorization request is malformed.");
    }
    const application = await findApplicationByClientId(parameters.client_id);
    if (!application || application.status !== "active") {
      throw new ApiError(400, "invalid_client", "The requested OAuth client is not available.");
    }
    assertApplicationRoute(application, request);
    const trace = new TraceRecorder({
      workspaceId: application.workspace_id,
      environmentId: application.environment_id,
      endpoint: "/oauth/authorize",
      method: "GET",
      eventType: "authorization_request",
      applicationId: application.id,
      applicationName: application.name,
      clientId: application.client_id,
      grantType: "Authorization Code + PKCE",
      request: { query: request.query, headers: request.headers },
    });
    trace.step(
      "Request received",
      "passed",
      "GET /oauth/authorize",
      "The authorization endpoint received the request.",
    );
    trace.step(
      "Client verified",
      "passed",
      application.client_id,
      "The requested client exists and is active.",
      {
        decision: { outcome: "allowed", reason: "The client is registered and enabled." },
      },
    );
    if (!application.redirect_uris.includes(parameters.redirect_uri)) {
      trace.step(
        "Redirect URI rejected",
        "failed",
        parameters.redirect_uri,
        "The redirect URI does not exactly match a registered URI.",
        {
          decision: { outcome: "denied", reason: "Exact redirect URI matching failed." },
        },
      );
      trace.skipRemaining([
        "PKCE challenge validated",
        "User authenticated",
        "Consent evaluated",
        "Authorization code issued",
      ]);
      await trace.finish("denied", {
        oauthError: "redirect_uri_mismatch",
        explanation: {
          code: "redirect_uri_mismatch",
          title: "Why was this request denied?",
          message: `The requested redirect URI is not registered for ${application.name}.`,
          observed: [{ label: "Received", value: parameters.redirect_uri, format: "uri" }],
          expected: application.redirect_uris.map((value) => ({
            label: "Registered redirect URI",
            value,
            format: "uri",
          })),
          resolution:
            "Add the requested URI to the application, or correct the URI sent by the application.",
          action: {
            label: "Open application settings",
            href: `/applications/${application.id}/configuration`,
          },
          documentationPath: "/docs/oauth/redirect-uris",
        },
      });
      throw new ApiError(
        400,
        "redirect_uri_mismatch",
        "The redirect URI is not registered for this application.",
      );
    }
    trace.step(
      "Redirect URI matched",
      "passed",
      parameters.redirect_uri,
      "The redirect URI exactly matches a registered value.",
    );

    const requestedScopes = parameters.scope.split(" ").filter(Boolean);
    const unknownScopes = requestedScopes.filter(
      (scope) => !application.allowed_scopes.includes(scope),
    );
    if (unknownScopes.length) {
      trace.step(
        "Scope denied",
        "failed",
        unknownScopes.join(", "),
        "The client requested scopes it is not assigned.",
      );
      trace.skipRemaining(["User authenticated", "Consent evaluated", "Authorization code issued"]);
      await trace.finish("denied", {
        oauthError: "invalid_scope",
        explanation: {
          code: "invalid_scope",
          title: "A requested scope is not assigned",
          message: `${unknownScopes.join(", ")} is not assigned to ${application.name}.`,
          observed: [{ label: "Requested", value: unknownScopes }],
          expected: [{ label: "Assigned", value: application.allowed_scopes }],
          resolution:
            "Assign the scope to the application or remove it from the authorization request.",
          action: {
            label: "Manage application scopes",
            href: `/applications/${application.id}/scopes`,
          },
        },
      });
      const redirect = new URL(parameters.redirect_uri);
      redirect.searchParams.set("error", "invalid_scope");
      if (parameters.state) redirect.searchParams.set("state", parameters.state);
      response.redirect(redirect.toString());
      return;
    }

    const expectedMcpResource = mcpResourceForIssuer(application.issuer);
    if (
      (requestedScopes.some((scope) => ["mcp:read", "mcp:write"].includes(scope)) ||
        (parameters.resource &&
          resourceIndicatorsMatch(parameters.resource, expectedMcpResource))) &&
      !isMcpAuthorization(parameters, application)
    ) {
      trace.step(
        "MCP resource rejected",
        "failed",
        parameters.resource ?? "Missing resource",
        "MCP authorization must target this issuer's canonical MCP resource.",
      );
      trace.skipRemaining(["User authenticated", "Consent evaluated", "Authorization code issued"]);
      await trace.finish("denied", { oauthError: "invalid_target" });
      response.redirect(
        oauthRedirect(parameters, "invalid_target", `The resource must be ${expectedMcpResource}.`),
      );
      return;
    }

    if (
      application.require_pkce &&
      (!parameters.code_challenge || parameters.code_challenge_method !== "S256")
    ) {
      trace.step(
        "PKCE challenge rejected",
        "failed",
        "S256 challenge required",
        "The request did not include a valid S256 PKCE challenge.",
      );
      trace.skipRemaining(["User authenticated", "Consent evaluated", "Authorization code issued"]);
      await trace.finish("denied", {
        oauthError: "invalid_request",
        explanation: {
          code: "pkce_required",
          title: "PKCE is required",
          message: "This application requires an S256 code challenge.",
          resolution:
            "Generate a code verifier and send its S256 challenge with the authorization request.",
          documentationPath: "/docs/oauth/pkce",
        },
      });
      const redirect = new URL(parameters.redirect_uri);
      redirect.searchParams.set("error", "invalid_request");
      redirect.searchParams.set("error_description", "S256 PKCE is required.");
      if (parameters.state) redirect.searchParams.set("state", parameters.state);
      response.redirect(redirect.toString());
      return;
    }
    trace.step(
      "PKCE challenge validated",
      "passed",
      "S256 challenge accepted",
      "The request contains an S256 PKCE challenge.",
    );
    if (parameters.agent_id) {
      trace.step(
        "Agent identified",
        "passed",
        parameters.agent_id,
        "The pushed request names a registered, active agent actor.",
      );
      trace.step(
        "Agent signature verified",
        "passed",
        "Single-use assertion accepted",
        "The pushed request was authenticated with the agent's registered public key.",
      );
      trace.step(
        "Task authority bounded",
        "passed",
        parameters.purpose ?? "Structured agent task",
        "The requested resource, actions, locations, scopes, and limits fit the agent registration.",
      );
    }
    await trace.finish("pending");
    await query(
      `INSERT INTO pending_authorization_requests
        (workspace_id, environment_id, application_id, request_id, parameters, expires_at)
       VALUES ($1,$2,$3,$4,$5,now() + interval '10 minutes')`,
      [
        application.workspace_id,
        application.environment_id,
        application.id,
        trace.requestId,
        parameters,
      ],
    );

    if (isMcpAuthorization(parameters, application)) {
      const { pending } = await loadPending(trace.requestId);
      await continueMcpAuthorization(request, response, pending, application);
      return;
    }

    let user = ["login", "select_account"].includes(parameters.prompt ?? "")
      ? undefined
      : await existingUserSession(
          request.cookies[userSessionCookie] as string | undefined,
          application.workspace_id,
        );
    if (
      user &&
      parameters.max_age &&
      (!user.last_authenticated_at ||
        Date.now() - user.last_authenticated_at.getTime() > Number(parameters.max_age) * 1000)
    ) {
      user = undefined;
    }
    if (parameters.prompt === "none" && !user) {
      const redirect = new URL(parameters.redirect_uri);
      redirect.searchParams.set("error", "login_required");
      if (parameters.state) redirect.searchParams.set("state", parameters.state);
      response.redirect(redirect.toString());
      return;
    }
    if (user) {
      const [consent] = await query<{ scopes: string[] }>(
        `SELECT scopes FROM consent_grants
         WHERE environment_id = $1 AND application_id = $2 AND user_id = $3 AND revoked_at IS NULL`,
        [application.environment_id, application.id, user.id],
      );
      const consentCoversRequest = requestedScopes.every((scope) =>
        consent?.scopes.includes(scope),
      );
      if (
        !parameters.agent_id &&
        (!application.require_consent || (parameters.prompt !== "consent" && consentCoversRequest))
      ) {
        response.redirect(
          await authorizationRedirect(
            (await loadPending(trace.requestId)).pending,
            application,
            user,
          ),
        );
        return;
      }
      if (parameters.prompt === "none") {
        const redirect = new URL(parameters.redirect_uri);
        redirect.searchParams.set("error", "consent_required");
        if (parameters.state) redirect.searchParams.set("state", parameters.state);
        response.redirect(redirect.toString());
        return;
      }
      await query(
        "UPDATE pending_authorization_requests SET status = 'awaiting_consent', user_id = $1 WHERE request_id = $2",
        [user.id, trace.requestId],
      );
      response.redirect(
        `${env.PUBLIC_ORIGIN}/authorize/consent?request_id=${encodeURIComponent(trace.requestId)}`,
      );
      return;
    }
    response.redirect(
      `${env.PUBLIC_ORIGIN}/authorize/login?request_id=${encodeURIComponent(trace.requestId)}`,
    );
  }),
);

export const authorizeApiRouter = Router();

authorizeApiRouter.get(
  "/requests/:requestId",
  asyncRoute(async (request, response) => {
    const { pending, application } = await loadPending(String(request.params.requestId));
    const scopes = await query<{
      name: string;
      display_name: string;
      consent_description: string;
      sensitivity: string;
    }>(
      "SELECT name, display_name, consent_description, sensitivity FROM resource_scopes WHERE environment_id = $1 AND name = ANY($2)",
      [application.environment_id, pending.parameters.scope.split(" ")],
    );
    response.json({
      requestId: pending.request_id,
      status: pending.status,
      application: {
        id: application.id,
        name: application.name,
        type: application.type,
        clientIdSource: application.client_id_source,
      },
      workspace: await query<{ name: string }>("SELECT name FROM workspaces WHERE id = $1", [
        application.workspace_id,
      ]).then(([workspace]) => ({ name: workspace?.name ?? "this workspace" })),
      ...(pending.parameters.agent_id
        ? {
            agent: await findAgentForClient(pending.parameters.client_id).then((agent) =>
              agent
                ? {
                    id: agent.agent_id,
                    displayName: agent.display_name,
                    operator: agent.operator_id,
                    mayDelegate: agent.may_delegate,
                    maximumDelegationDepth: agent.maximum_delegation_depth,
                    maximumAuthorizationSeconds: Math.min(
                      agent.maximum_authorization_seconds,
                      application.access_token_lifetime_seconds,
                    ),
                  }
                : undefined,
            ),
            resource: pending.parameters.resource,
            authorizationDetails: pending.parameters.authorization_details,
            purpose: pending.parameters.purpose,
            taskId: pending.parameters.task_id,
          }
        : {}),
      ...(isMcpAuthorization(pending.parameters, application)
        ? {
            mcp: {
              serverName: "Authometry MCP server",
              resource: mcpResourceForIssuer(application.issuer),
            },
          }
        : {}),
      scopes,
    });
  }),
);

authorizeApiRouter.post(
  "/login",
  asyncRoute(async (request, response) => {
    const input = z
      .object({
        requestId: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(1),
        mfaCode: z.string().trim().min(6).max(24).optional(),
        linkToken: z.string().min(32).optional(),
      })
      .parse(request.body);
    const { pending, application } = await loadPending(input.requestId);
    if (isMcpAuthorization(pending.parameters, application)) {
      await enforceAdminCsrf(request, response);
    }
    const [user] = await query<IdentityUserRow>(
      "SELECT * FROM identity_users WHERE workspace_id = $1 AND lower(email) = lower($2) AND status = 'active'",
      [application.workspace_id, input.email],
    );
    if (!user?.password_hash || !(await compare(input.password, user.password_hash))) {
      throw new ApiError(401, "invalid_credentials", "The email or password is incorrect.");
    }
    if (user.mfa_enabled) {
      if (!input.mfaCode) {
        throw new ApiError(
          401,
          "mfa_required",
          "Enter a code from your authenticator app or a recovery code.",
        );
      }
      if (!(await verifyIdentityMfa(user.id, user.mfa_totp_secret_encrypted, input.mfaCode))) {
        throw new ApiError(
          401,
          "invalid_mfa_code",
          "The authentication code is invalid or has already been used.",
        );
      }
    }
    if (input.linkToken) {
      const linkToken = input.linkToken;
      await transaction(async (client) => {
        const linkResult = await client.query<{
          id: string;
          user_id: string;
          provider: "google" | "github";
          provider_subject: string;
          provider_email: string;
        }>(
          `SELECT id, user_id, provider, provider_subject, provider_email
           FROM social_account_link_tokens
           WHERE token_hash = $1 AND authorization_request_id = $2 AND workspace_id = $3
             AND consumed_at IS NULL AND expires_at > now()
           FOR UPDATE`,
          [hashToken(linkToken), pending.id, application.workspace_id],
        );
        const link = linkResult.rows[0];
        if (!link || link.user_id !== user.id) {
          throw new ApiError(
            400,
            "invalid_account_link",
            "The social account link is invalid or expired. Start again with the social provider.",
          );
        }
        await client.query("SELECT id FROM identity_users WHERE id = $1 FOR UPDATE", [user.id]);
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `user:${link.provider}:${link.provider_subject}`,
        ]);
        const subjectResult = await client.query<{ user_id: string }>(
          `SELECT user_id FROM social_identities
           WHERE workspace_id = $1 AND provider = $2 AND provider_subject = $3`,
          [application.workspace_id, link.provider, link.provider_subject],
        );
        if (subjectResult.rows[0] && subjectResult.rows[0].user_id !== user.id) {
          throw new ApiError(
            409,
            "social_identity_in_use",
            `This ${link.provider} account is already linked to another user.`,
          );
        }
        const providerResult = await client.query<{ provider_subject: string }>(
          `SELECT provider_subject FROM social_identities
           WHERE workspace_id = $1 AND user_id = $2 AND provider = $3
           ORDER BY created_at LIMIT 1`,
          [application.workspace_id, user.id, link.provider],
        );
        if (
          providerResult.rows[0] &&
          providerResult.rows[0].provider_subject !== link.provider_subject
        ) {
          throw new ApiError(
            409,
            "social_provider_already_linked",
            `A different ${link.provider} account is already linked to this user.`,
          );
        }
        if (!subjectResult.rows[0]) {
          await client.query(
            `INSERT INTO social_identities
              (workspace_id, user_id, provider, provider_subject, provider_email)
             VALUES ($1,$2,$3,$4,$5)`,
            [
              application.workspace_id,
              user.id,
              link.provider,
              link.provider_subject,
              link.provider_email,
            ],
          );
        } else {
          await client.query(
            `UPDATE social_identities SET provider_email = $4
             WHERE workspace_id = $1 AND provider = $2 AND provider_subject = $3`,
            [application.workspace_id, link.provider, link.provider_subject, link.provider_email],
          );
        }
        await client.query(
          "UPDATE social_account_link_tokens SET consumed_at = now() WHERE id = $1",
          [link.id],
        );
      });
    }
    await continueAfterAuthentication(request, response, pending, application, user, true);
  }),
);

authorizeApiRouter.get("/providers", (_request, response) => {
  response.json({
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  });
});

authorizeApiRouter.get(
  "/social/:provider",
  asyncRoute(async (request, response) => {
    const provider = z.enum(["google", "github"]).parse(request.params.provider);
    const requestId = z.string().min(1).parse(request.query.request_id);
    const { pending, application } = await loadPending(requestId);
    const state = randomToken(32);
    const nonce = randomToken(24);
    const verifier = randomToken(48);
    const redirectUri = `${env.PUBLIC_ORIGIN}/api/v1/authorize/social/${provider}/callback`;
    const target = socialAuthorizationUrl(
      provider,
      redirectUri,
      state,
      sha256Base64Url(verifier),
      nonce,
    );
    await query(
      `INSERT INTO social_login_states
        (workspace_id, environment_id, authorization_request_id, provider, state_hash, nonce_hash,
         nonce_encrypted, code_verifier_encrypted, redirect_uri, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now() + interval '10 minutes')`,
      [
        application.workspace_id,
        application.environment_id,
        pending.id,
        provider,
        hashToken(state),
        hashToken(nonce),
        encrypt(nonce),
        encrypt(verifier),
        redirectUri,
      ],
    );
    response.redirect(target.toString());
  }),
);

authorizeApiRouter.get(
  "/social/:provider/callback",
  asyncRoute(async (request, response) => {
    const provider = z.enum(["google", "github"]).parse(request.params.provider);
    const input = z
      .object({ code: z.string().min(1), state: z.string().min(1) })
      .parse(request.query);
    if (await completeAdminSocialLogin(request, response, provider, input.code, input.state)) {
      return;
    }
    const stateResult = await transaction(async (client) => {
      const result = await client.query<{
        id: string;
        authorization_request_id: string;
        redirect_uri: string;
        code_verifier_encrypted: string;
        nonce_encrypted: string;
      }>(
        `SELECT id, authorization_request_id, redirect_uri, code_verifier_encrypted, nonce_encrypted
         FROM social_login_states WHERE state_hash = $1 AND provider = $2 AND consumed_at IS NULL
           AND expires_at > now() FOR UPDATE`,
        [hashToken(input.state), provider],
      );
      const state = result.rows[0];
      if (!state)
        throw new ApiError(
          401,
          "invalid_social_state",
          "The social login state is invalid or expired.",
        );
      await client.query("UPDATE social_login_states SET consumed_at = now() WHERE id = $1", [
        state.id,
      ]);
      return state;
    });
    const [pending] = await query<PendingAuthorizationRow>(
      "SELECT * FROM pending_authorization_requests WHERE id = $1",
      [stateResult.authorization_request_id],
    );
    if (!pending)
      throw new ApiError(
        404,
        "authorization_request_not_found",
        "This authorization request no longer exists.",
      );
    const { application } = await loadPending(pending.request_id);
    const profile = await exchangeSocialCode(
      provider,
      input.code,
      stateResult.redirect_uri,
      decrypt(stateResult.code_verifier_encrypted),
      decrypt(stateResult.nonce_encrypted),
    );
    if (!profile.emailVerified)
      throw new ApiError(
        401,
        "unverified_social_email",
        "The provider email address is not verified.",
      );
    const accountLinkToken = randomToken(40);
    const resolution = await transaction(async (client) => {
      const linked = await client.query<IdentityUserRow>(
        `SELECT u.* FROM social_identities s JOIN identity_users u ON u.id = s.user_id
         WHERE s.workspace_id = $1 AND s.provider = $2 AND s.provider_subject = $3`,
        [application.workspace_id, provider, profile.subject],
      );
      if (linked.rows[0]) {
        if (linked.rows[0].status !== "active") {
          throw new ApiError(403, "user_disabled", "This user account is disabled.");
        }
        await client.query(
          `UPDATE social_identities SET provider_email = $4
           WHERE workspace_id = $1 AND provider = $2 AND provider_subject = $3`,
          [application.workspace_id, provider, profile.subject, profile.email],
        );
        return { kind: "authenticated" as const, user: linked.rows[0] };
      }
      const existing = await client.query<IdentityUserRow>(
        "SELECT * FROM identity_users WHERE workspace_id = $1 AND lower(email) = $2",
        [application.workspace_id, profile.email],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].status !== "active") {
          throw new ApiError(403, "user_disabled", "This user account is disabled.");
        }
        if (!existing.rows[0].password_hash) {
          throw new ApiError(
            409,
            "account_link_unavailable",
            "Sign in with the social provider already connected to this account.",
          );
        }
        await client.query(
          `INSERT INTO social_account_link_tokens
            (workspace_id, environment_id, authorization_request_id, user_id, provider,
             provider_subject, provider_email, token_hash, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now() + interval '10 minutes')`,
          [
            application.workspace_id,
            application.environment_id,
            pending.id,
            existing.rows[0].id,
            provider,
            profile.subject,
            profile.email,
            hashToken(accountLinkToken),
          ],
        );
        return { kind: "link_required" as const };
      }
      const created = await client.query<IdentityUserRow>(
        `INSERT INTO identity_users(workspace_id, email, name, email_verified_at)
         VALUES ($1,$2,$3,now()) RETURNING *`,
        [application.workspace_id, profile.email, profile.name],
      );
      const identity = created.rows[0];
      if (!identity) throw new Error("The social identity user was not created.");
      await client.query(
        `INSERT INTO social_identities(workspace_id, user_id, provider, provider_subject, provider_email)
         VALUES ($1,$2,$3,$4,$5)`,
        [application.workspace_id, identity.id, provider, profile.subject, profile.email],
      );
      return { kind: "authenticated" as const, user: identity };
    });
    if (resolution.kind === "link_required") {
      const target = new URL("/authorize/login", env.PUBLIC_ORIGIN);
      target.searchParams.set("request_id", pending.request_id);
      target.searchParams.set("link_token", accountLinkToken);
      target.searchParams.set("provider", provider);
      response.redirect(target.toString());
      return;
    }
    await continueAfterAuthentication(request, response, pending, application, resolution.user);
  }),
);

authorizeApiRouter.post(
  "/consent",
  asyncRoute(async (request, response) => {
    const input = z
      .object({ requestId: z.string().min(1), approved: z.boolean() })
      .parse(request.body);
    const { pending, application } = await loadPending(input.requestId);
    const mcpRequest = isMcpAuthorization(pending.parameters, application);
    let mcpAdmin: McpAdminUser | undefined;
    if (mcpRequest) {
      await enforceAdminCsrf(request, response);
      const principal = await optionalAdmin(request);
      if (
        !principal ||
        principal.workspaceId !== application.workspace_id ||
        (pending.admin_user_id !== null && principal.userId !== pending.admin_user_id)
      ) {
        throw new ApiError(401, "login_required", "Sign in before reviewing MCP access.");
      }
      [mcpAdmin] = await query<McpAdminUser>(
        `SELECT u.id, u.email, u.name, m.workspace_id, m.role
         FROM admin_users u JOIN workspace_memberships m ON m.admin_user_id = u.id
         WHERE u.id = $1 AND m.workspace_id = $2 AND u.disabled_at IS NULL`,
        [principal.userId, application.workspace_id],
      );
      if (!mcpAdmin) {
        throw new ApiError(401, "login_required", "The admin session is unavailable.");
      }
    }
    if (!input.approved) {
      await transaction(async (client) => {
        await client.query(
          "UPDATE pending_authorization_requests SET status = 'denied', completed_at = now() WHERE id = $1",
          [pending.id],
        );
        await client.query(
          `UPDATE authorization_traces SET status = 'denied', event_type = 'consent_denied', oauth_error = 'access_denied',
             explanation = $2, steps = steps || $3::jsonb, completed_at = now(),
             duration_ms = extract(milliseconds from now() - started_at)::integer WHERE request_id = $1`,
          [
            pending.request_id,
            {
              code: "access_denied",
              title: "The user denied consent",
              message: "The resource owner declined the requested scopes.",
              resolution:
                "Request only the scopes the application needs and let the user decide again.",
            },
            JSON.stringify([
              {
                id: `${pending.request_id}_consent_denied`,
                index: 5,
                name: "Consent evaluated",
                status: "failed",
                summary: "User denied access",
                description: "The resource owner declined the requested scopes.",
                startedOffsetMs: 0,
                decision: { outcome: "denied", reason: "The user selected Deny." },
              },
              {
                id: `${pending.request_id}_code_skipped`,
                index: 6,
                name: "Authorization code issued",
                status: "skipped",
                summary: "Not executed",
                description: "No authorization code is issued after consent is denied.",
                startedOffsetMs: 0,
              },
            ]),
          ],
        );
      });
      const redirect = new URL(pending.parameters.redirect_uri);
      redirect.searchParams.set("error", "access_denied");
      if (pending.parameters.state) redirect.searchParams.set("state", pending.parameters.state);
      response.json({ next: redirect.toString() });
      return;
    }
    if (mcpRequest && mcpAdmin) {
      const scopes = pending.parameters.scope.split(" ").filter(Boolean);
      const resource = mcpResourceForIssuer(application.issuer);
      await query(
        `INSERT INTO mcp_admin_consent_grants
          (workspace_id, environment_id, application_id, admin_user_id, resource, scopes)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (environment_id, application_id, admin_user_id, resource)
         DO UPDATE SET scopes = EXCLUDED.scopes, granted_at = now(), revoked_at = NULL`,
        [
          application.workspace_id,
          application.environment_id,
          application.id,
          mcpAdmin.id,
          resource,
          scopes,
        ],
      );
      response.json({ next: await mcpAuthorizationRedirect(pending, application, mcpAdmin) });
      return;
    }
    if (!pending.user_id)
      throw new ApiError(401, "login_required", "Sign in before reviewing consent.");
    const [user] = await query<IdentityUserRow>("SELECT * FROM identity_users WHERE id = $1", [
      pending.user_id,
    ]);
    if (!user)
      throw new ApiError(401, "login_required", "The user session is no longer available.");
    const scopes = pending.parameters.scope.split(" ");
    await query(
      `INSERT INTO consent_grants(workspace_id, environment_id, application_id, user_id, scopes)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (environment_id, application_id, user_id)
       DO UPDATE SET scopes = EXCLUDED.scopes, granted_at = now(), revoked_at = NULL`,
      [application.workspace_id, application.environment_id, application.id, user.id, scopes],
    );
    response.json({ next: await authorizationRedirect(pending, application, user) });
  }),
);

export async function issueAuthorizationCodeForTesting(
  pending: PendingAuthorizationRow,
  application: OAuthApplicationRow,
  user: IdentityUserRow,
): Promise<string> {
  return authorizationRedirect(pending, application, user);
}
