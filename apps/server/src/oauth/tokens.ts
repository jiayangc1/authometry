import { Router } from "express";
import type { Request, Response } from "express";
import { decodeJwt } from "jose";
import { createApplicationSlug, redirectUriSchema } from "@authometry/domain";
import { z } from "zod";
import { query, transaction } from "../db.js";
import { hashToken, randomId, randomToken } from "../lib/crypto.js";
import { ApiError, asyncRoute } from "../lib/http.js";
import { issueTokenSet, verifyPkce } from "../lib/oauth.js";
import { verifyOAuthJwt } from "../lib/signing.js";
import { TraceRecorder } from "../lib/trace.js";
import { authenticateClient, findApplicationByClientId, oauthError } from "./common.js";
import type { IdentityUserRow, OAuthApplicationRow } from "./types.js";
import { defaultEnvironment, mcpResourceForIssuer, resourceIndicatorsMatch } from "./resources.js";
import {
  findAgentById,
  findAgentForClient,
  reduceAuthorizationDetails,
  verifyAgentAssertion,
  verifyDpopProof,
  type AgentIdentityRow,
  type DelegationGrantRow,
} from "./agents.js";

interface AuthorizationCodeRow {
  id: string;
  application_id: string;
  user_id: string | null;
  admin_user_id: string | null;
  redirect_uri: string;
  scope: string[];
  code_challenge: string | null;
  code_challenge_method: string | null;
  nonce: string | null;
  auth_time: Date;
  expires_at: Date;
  consumed_at: Date | null;
  delegation_grant_id: string | null;
  resource: string | null;
}

function noStore(response: Response): void {
  response.set("Cache-Control", "no-store");
  response.set("Pragma", "no-cache");
}

async function authorizationCodeGrant(
  application: OAuthApplicationRow,
  body: Record<string, unknown>,
  request: Request,
  trace: TraceRecorder,
): Promise<Record<string, unknown>> {
  const code = String(body.code ?? "");
  const redirectUri = String(body.redirect_uri ?? "");
  const verifier = String(body.code_verifier ?? "");
  const requestedResource = String(body.resource ?? "");
  return transaction(async (client) => {
    const codeResult = await client.query<AuthorizationCodeRow>(
      "SELECT * FROM authorization_codes WHERE code_hash = $1 FOR UPDATE",
      [hashToken(code)],
    );
    const authorizationCode = codeResult.rows[0];
    if (!authorizationCode || authorizationCode.application_id !== application.id) {
      throw new ApiError(400, "invalid_grant", "The authorization code is invalid.");
    }
    if (authorizationCode.consumed_at) {
      throw new ApiError(400, "invalid_grant", "The authorization code has already been used.");
    }
    if (authorizationCode.expires_at < new Date()) {
      throw new ApiError(400, "invalid_grant", "The authorization code has expired.");
    }
    if (authorizationCode.redirect_uri !== redirectUri) {
      throw new ApiError(
        400,
        "invalid_grant",
        "The redirect URI does not match the authorization request.",
      );
    }
    if (
      application.require_pkce &&
      (!authorizationCode.code_challenge ||
        !verifyPkce(
          verifier,
          authorizationCode.code_challenge,
          authorizationCode.code_challenge_method ?? "",
        ))
    ) {
      throw new ApiError(
        400,
        "invalid_grant",
        "The PKCE code verifier does not match the original challenge.",
      );
    }
    const requiresResource = Boolean(authorizationCode.admin_user_id);
    if (
      (requiresResource && !requestedResource) ||
      (requestedResource &&
        (!authorizationCode.resource ||
          !resourceIndicatorsMatch(requestedResource, authorizationCode.resource)))
    ) {
      throw new ApiError(
        400,
        "invalid_target",
        "The token request resource does not match the authorization request.",
      );
    }
    await client.query("UPDATE authorization_codes SET consumed_at = now() WHERE id = $1", [
      authorizationCode.id,
    ]);
    if (authorizationCode.admin_user_id) {
      const adminResult = await client.query<{
        id: string;
        email: string;
        name: string;
        workspace_id: string;
        role: string;
      }>(
        `SELECT u.id, u.email, u.name, m.workspace_id, m.role
         FROM admin_users u JOIN workspace_memberships m ON m.admin_user_id = u.id
         WHERE u.id = $1 AND m.workspace_id = $2 AND u.disabled_at IS NULL`,
        [authorizationCode.admin_user_id, application.workspace_id],
      );
      const admin = adminResult.rows[0];
      if (!admin) {
        throw new ApiError(400, "invalid_grant", "The Authometry admin is not active.");
      }
      if (
        !authorizationCode.resource ||
        !resourceIndicatorsMatch(
          authorizationCode.resource,
          mcpResourceForIssuer(application.issuer),
        )
      ) {
        throw new ApiError(400, "invalid_grant", "The authorization code has an invalid resource.");
      }
      trace.identifyUser({ id: admin.id, email: admin.email, name: admin.name });
      return issueTokenSet({
        application,
        issuer: application.issuer,
        subject: admin.id,
        scopes: authorizationCode.scope,
        audience: authorizationCode.resource,
        resource: authorizationCode.resource,
        adminUserId: admin.id,
        includeRefreshToken: authorizationCode.scope.includes("offline_access"),
        accessTokenClaims: {
          authometry_principal: "admin",
          workspace_id: admin.workspace_id,
          role: admin.role,
          email: admin.email,
          name: admin.name,
        },
      });
    }

    const userResult = await client.query<IdentityUserRow>(
      "SELECT * FROM identity_users WHERE id = $1",
      [authorizationCode.user_id],
    );
    const user = userResult.rows[0];
    if (!user || user.status !== "active")
      throw new ApiError(400, "invalid_grant", "The user is not active.");
    trace.identifyUser({ id: user.id, email: user.email, name: user.name });

    let grant: DelegationGrantRow | undefined;
    let agent: AgentIdentityRow | undefined;
    let dpopJkt: string | undefined;
    if (authorizationCode.delegation_grant_id) {
      const grantResult = await client.query<DelegationGrantRow>(
        `SELECT * FROM delegation_grants WHERE id = $1 FOR UPDATE`,
        [authorizationCode.delegation_grant_id],
      );
      grant = grantResult.rows[0];
      agent = await findAgentForClient(application.client_id);
      if (
        !grant ||
        grant.status !== "active" ||
        grant.expires_at < new Date() ||
        !agent ||
        agent.status !== "active" ||
        grant.actor_agent_id !== agent.id
      ) {
        throw new ApiError(
          400,
          "invalid_grant",
          "The agent delegation grant is inactive or expired.",
        );
      }
      const proof = await verifyDpopProof(request, "POST", `${application.issuer}/oauth/token`);
      dpopJkt = proof.jkt;
      await client.query("UPDATE delegation_grants SET dpop_jkt = $2 WHERE id = $1", [
        grant.id,
        dpopJkt,
      ]);
    }

    // Token issuance performs its own writes after this code is committed. The code remains one-time even if signing fails.
    return issueTokenSet({
      application,
      issuer: application.issuer,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        groups: user.groups,
        customClaims: user.custom_claims,
        emailVerified: Boolean(user.email_verified_at),
        authTime: authorizationCode.auth_time,
      },
      scopes: authorizationCode.scope,
      ...(authorizationCode.resource
        ? { audience: authorizationCode.resource, resource: authorizationCode.resource }
        : {}),
      ...(authorizationCode.nonce ? { nonce: authorizationCode.nonce } : {}),
      includeRefreshToken: grant ? false : authorizationCode.scope.includes("offline_access"),
      ...(grant && agent && dpopJkt
        ? {
            audience: grant.resource,
            tokenType: "DPoP" as const,
            accessTokenLifetimeSeconds: Math.max(
              1,
              Math.min(
                application.access_token_lifetime_seconds,
                Math.floor((grant.expires_at.getTime() - Date.now()) / 1000),
              ),
            ),
            accessTokenClaims: {
              act: { sub: agent.agent_id, operator: agent.operator_id },
              authorization_details: grant.authorization_details,
              authometry_grant_id: grant.id,
              ...(grant.task_id ? { authometry_task_id: grant.task_id } : {}),
              cnf: { jkt: dpopJkt },
            },
          }
        : {}),
    });
  });
}

async function refreshTokenGrant(
  application: OAuthApplicationRow,
  rawToken: string,
  trace: TraceRecorder,
  requestedScope?: string,
  requestedResource?: string,
): Promise<Record<string, unknown>> {
  let reuseDetected = false;
  const result = await transaction(async (client) => {
    const result = await client.query<{
      id: string;
      family_id: string;
      expires_at: Date;
      consumed_at: Date | null;
      revoked_at: Date | null;
      status: "active" | "revoked" | "reused" | "expired";
      application_id: string;
      user_id: string | null;
      admin_user_id: string | null;
      resource: string | null;
      scopes: string[];
      family_expires_at: Date;
    }>(
      `SELECT t.id, t.family_id, t.expires_at, t.consumed_at, t.revoked_at,
              f.status, f.application_id, f.user_id, f.admin_user_id, f.resource, f.scopes,
              f.expires_at AS family_expires_at
       FROM refresh_tokens t JOIN refresh_token_families f ON f.id = t.family_id
       WHERE t.token_hash = $1 FOR UPDATE`,
      [hashToken(rawToken)],
    );
    const current = result.rows[0];
    if (
      !current ||
      current.application_id !== application.id ||
      current.revoked_at ||
      current.status !== "active"
    ) {
      throw new ApiError(400, "invalid_grant", "The refresh token is invalid or revoked.");
    }
    if (current.consumed_at) {
      await client.query(
        "UPDATE refresh_token_families SET status = 'reused', revoked_reason = 'refresh_token_reuse', updated_at = now() WHERE id = $1",
        [current.family_id],
      );
      await client.query("UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1", [
        current.family_id,
      ]);
      await client.query(
        `INSERT INTO audit_events
          (workspace_id, environment_id, category, severity, event_type, summary, resource_type, resource_id)
         VALUES ($1,$2,'security','high','refresh_token_reuse','A rotated refresh token was reused. The token family was revoked.','token_family',$3)`,
        [application.workspace_id, application.environment_id, current.family_id],
      );
      reuseDetected = true;
      return {};
    }
    if (current.expires_at < new Date() || current.family_expires_at < new Date()) {
      await client.query(
        "UPDATE refresh_token_families SET status = 'expired', updated_at = now() WHERE id = $1",
        [current.family_id],
      );
      throw new ApiError(400, "invalid_grant", "The refresh token has expired.");
    }
    const scopes = requestedScope ? requestedScope.split(" ").filter(Boolean) : current.scopes;
    if (!scopes.every((scope) => current.scopes.includes(scope))) {
      throw new ApiError(
        400,
        "invalid_scope",
        "A refresh request cannot expand the original scope.",
      );
    }
    const requiresResource = Boolean(current.admin_user_id);
    if (
      (requiresResource && !requestedResource) ||
      (requestedResource &&
        (!current.resource || !resourceIndicatorsMatch(requestedResource, current.resource)))
    ) {
      throw new ApiError(400, "invalid_target", "The refresh token is bound to another resource.");
    }
    const nextToken = randomToken(48);
    await client.query("UPDATE refresh_tokens SET consumed_at = now() WHERE id = $1", [current.id]);
    await client.query(
      `INSERT INTO refresh_tokens(family_id, token_hash, parent_id, expires_at)
       VALUES ($1,$2,$3,LEAST($4, now() + ($5 * interval '1 second')))`,
      [
        current.family_id,
        hashToken(nextToken),
        current.id,
        current.family_expires_at,
        application.refresh_token_lifetime_seconds,
      ],
    );
    let user: IdentityUserRow | undefined;
    let admin:
      { id: string; email: string; name: string; workspace_id: string; role: string } | undefined;
    if (current.user_id) {
      user = (
        await client.query<IdentityUserRow>("SELECT * FROM identity_users WHERE id = $1", [
          current.user_id,
        ])
      ).rows[0];
    }
    if (current.admin_user_id) {
      admin = (
        await client.query<{
          id: string;
          email: string;
          name: string;
          workspace_id: string;
          role: string;
        }>(
          `SELECT u.id, u.email, u.name, m.workspace_id, m.role
           FROM admin_users u JOIN workspace_memberships m ON m.admin_user_id = u.id
           WHERE u.id = $1 AND m.workspace_id = $2 AND u.disabled_at IS NULL`,
          [current.admin_user_id, application.workspace_id],
        )
      ).rows[0];
      if (!admin) throw new ApiError(400, "invalid_grant", "The Authometry admin is not active.");
    }
    if (admin) {
      trace.identifyUser({ id: admin.id, email: admin.email, name: admin.name });
    } else if (user) {
      trace.identifyUser({ id: user.id, email: user.email, name: user.name });
    }
    const tokenSet = await issueTokenSet({
      application,
      issuer: application.issuer,
      ...(user
        ? {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              groups: user.groups,
              customClaims: user.custom_claims,
              emailVerified: Boolean(user.email_verified_at),
              authTime: user.last_authenticated_at ?? new Date(),
            },
          }
        : {}),
      scopes,
      ...(current.resource ? { audience: current.resource, resource: current.resource } : {}),
      ...(admin
        ? {
            subject: admin.id,
            adminUserId: admin.id,
            accessTokenClaims: {
              authometry_principal: "admin",
              workspace_id: admin.workspace_id,
              role: admin.role,
              email: admin.email,
              name: admin.name,
            },
          }
        : {}),
      includeRefreshToken: false,
    });
    return { ...tokenSet, refresh_token: nextToken };
  });
  if (reuseDetected) {
    throw new ApiError(
      400,
      "invalid_grant",
      "Refresh token reuse was detected. The token family has been revoked.",
    );
  }
  return result;
}

async function deviceCodeGrant(
  application: OAuthApplicationRow,
  rawDeviceCode: string,
  trace: TraceRecorder,
): Promise<Record<string, unknown>> {
  let protocolError: ApiError | undefined;
  const tokenSet = await transaction(async (client) => {
    const result = await client.query<{
      id: string;
      user_id: string | null;
      scopes: string[];
      status: "pending" | "approved" | "denied" | "consumed" | "expired";
      interval_seconds: number;
      last_polled_at: Date | null;
      expires_at: Date;
    }>("SELECT * FROM device_authorizations WHERE device_code_hash = $1 FOR UPDATE", [
      hashToken(rawDeviceCode),
    ]);
    const device = result.rows[0];
    if (!device || device.expires_at < new Date())
      throw new ApiError(400, "expired_token", "The device code has expired.");
    if (
      device.last_polled_at &&
      Date.now() - device.last_polled_at.getTime() < device.interval_seconds * 1000
    ) {
      await client.query(
        "UPDATE device_authorizations SET interval_seconds = interval_seconds + 5 WHERE id = $1",
        [device.id],
      );
      protocolError = new ApiError(400, "slow_down", "Poll less frequently.");
      return {};
    }
    await client.query("UPDATE device_authorizations SET last_polled_at = now() WHERE id = $1", [
      device.id,
    ]);
    if (device.status === "pending") {
      protocolError = new ApiError(
        400,
        "authorization_pending",
        "The user has not completed verification.",
      );
      return {};
    }
    if (device.status === "denied") {
      protocolError = new ApiError(400, "access_denied", "The user denied the device request.");
      return {};
    }
    if (device.status !== "approved" || !device.user_id)
      throw new ApiError(400, "invalid_grant", "The device code is no longer valid.");
    const user = (
      await client.query<IdentityUserRow>("SELECT * FROM identity_users WHERE id = $1", [
        device.user_id,
      ])
    ).rows[0];
    if (!user) throw new ApiError(400, "invalid_grant", "The user is no longer available.");
    trace.identifyUser({ id: user.id, email: user.email, name: user.name });
    await client.query("UPDATE device_authorizations SET status = 'consumed' WHERE id = $1", [
      device.id,
    ]);
    return issueTokenSet({
      application,
      issuer: application.issuer,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        groups: user.groups,
        customClaims: user.custom_claims,
        emailVerified: Boolean(user.email_verified_at),
        authTime: user.last_authenticated_at ?? new Date(),
      },
      scopes: device.scopes,
      includeRefreshToken: device.scopes.includes("offline_access"),
    });
  });
  if (protocolError) throw protocolError;
  return tokenSet;
}

async function tokenExchangeGrant(
  application: OAuthApplicationRow,
  body: Record<string, unknown>,
  request: Request,
  trace: TraceRecorder,
): Promise<Record<string, unknown>> {
  const subjectToken = String(body.subject_token ?? "");
  const subjectTokenType = String(body.subject_token_type ?? "");
  const actorToken = String(body.actor_token ?? "");
  const actorTokenType = String(body.actor_token_type ?? "");
  const resource = String(body.resource ?? "");
  const scopes = String(body.scope ?? "")
    .split(" ")
    .filter(Boolean);
  if (
    subjectTokenType !== "urn:ietf:params:oauth:token-type:access_token" ||
    actorTokenType !== "urn:ietf:params:oauth:token-type:jwt" ||
    !subjectToken ||
    !actorToken ||
    !resource ||
    !scopes.length
  ) {
    throw new ApiError(
      400,
      "invalid_request",
      "Token exchange requires subject, actor, resource, and scope inputs.",
    );
  }
  const requesterAgent = await findAgentForClient(application.client_id);
  if (!requesterAgent || requesterAgent.status !== "active") {
    throw new ApiError(400, "invalid_actor", "The delegating agent is not active.");
  }
  let actorIdentity: ReturnType<typeof decodeJwt>;
  try {
    actorIdentity = decodeJwt(actorToken);
  } catch {
    throw new ApiError(400, "invalid_actor", "The actor token is malformed.");
  }
  const targetAgentId = typeof actorIdentity.iss === "string" ? actorIdentity.iss : "";
  const agent = await findAgentById(application.environment_id, targetAgentId);
  if (!agent || agent.status !== "active" || !agent.may_receive_delegation) {
    throw new ApiError(400, "invalid_actor", "The receiving agent cannot accept delegated grants.");
  }
  const [targetApplication] = await query<OAuthApplicationRow>(
    `SELECT a.*, e.issuer, e.slug AS environment_slug
     FROM oauth_applications a JOIN environments e ON e.id = a.environment_id
     WHERE a.id = $1 AND a.status = 'active'`,
    [agent.application_id],
  );
  if (!targetApplication) {
    throw new ApiError(400, "invalid_actor", "The receiving agent client is disabled.");
  }
  await verifyAgentAssertion(
    actorToken,
    targetApplication.client_id,
    `${application.issuer}/oauth/token`,
  );
  const { payload } = await verifyOAuthJwt(subjectToken, application.issuer);
  const parentGrantId =
    typeof payload.authometry_grant_id === "string" ? payload.authometry_grant_id : "";
  if (payload.token_use !== "access" || !payload.sub || !parentGrantId) {
    throw new ApiError(400, "invalid_grant", "The subject token is not an agent delegation token.");
  }
  const proof = await verifyDpopProof(request, "POST", `${application.issuer}/oauth/token`);
  const result = await transaction(async (client) => {
    const parentResult = await client.query<
      DelegationGrantRow & { parent_may_delegate: boolean; maximum_delegation_depth: number }
    >(
      `SELECT g.*, a.may_delegate AS parent_may_delegate,
              a.maximum_delegation_depth
       FROM delegation_grants g JOIN agent_identities a ON a.id = g.actor_agent_id
       WHERE g.id = $1 FOR UPDATE`,
      [parentGrantId],
    );
    const parent = parentResult.rows[0];
    const tokenAudience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (
      !parent ||
      parent.status !== "active" ||
      parent.expires_at < new Date() ||
      !parent.parent_may_delegate ||
      parent.delegation_depth >= parent.maximum_delegation_depth ||
      parent.actor_agent_id !== requesterAgent.id ||
      parent.subject_user_id !== payload.sub ||
      !tokenAudience.includes(parent.resource)
    ) {
      throw new ApiError(400, "invalid_grant", "The parent grant cannot be delegated.");
    }
    if (resource !== parent.resource || !scopes.every((scope) => parent.scopes.includes(scope))) {
      throw new ApiError(
        400,
        "invalid_scope",
        "A child grant must be a strict subset of its parent.",
      );
    }
    if (
      !agent.allowed_resources.includes(resource) ||
      !scopes.every((scope) => agent.capabilities.includes(scope))
    ) {
      throw new ApiError(
        400,
        "invalid_target",
        "The receiving agent is not registered for the requested authority.",
      );
    }
    const childDetails = reduceAuthorizationDetails(parent.authorization_details, scopes);
    if (!childDetails.length) {
      throw new ApiError(
        400,
        "invalid_scope",
        "The reduced scope does not authorize any parent action.",
      );
    }
    const child = await client.query<{ id: string }>(
      `INSERT INTO delegation_grants
        (workspace_id, environment_id, application_id, subject_user_id, actor_agent_id,
         parent_grant_id, resource, scopes, authorization_details, purpose, task_id, dpop_jkt,
         delegation_depth, maximum_usage, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [
        application.workspace_id,
        application.environment_id,
        targetApplication.id,
        parent.subject_user_id,
        agent.id,
        parent.id,
        resource,
        scopes,
        childDetails,
        parent.purpose,
        parent.task_id,
        proof.jkt,
        parent.delegation_depth + 1,
        parent.maximum_usage,
        parent.expires_at,
      ],
    );
    return { parent, childDetails, childId: child.rows[0]!.id };
  });
  const userRows = await query<IdentityUserRow>("SELECT * FROM identity_users WHERE id = $1", [
    payload.sub,
  ]);
  const user = userRows[0];
  if (!user || user.status !== "active")
    throw new ApiError(400, "invalid_grant", "The subject is inactive.");
  trace.identifyUser({ id: user.id, email: user.email, name: user.name });
  const parentAct = typeof payload.act === "object" && payload.act ? payload.act : undefined;
  const expiresIn = Math.max(
    1,
    Math.min(
      targetApplication.access_token_lifetime_seconds,
      Math.floor((result.parent.expires_at.getTime() - Date.now()) / 1000),
    ),
  );
  const issued = await issueTokenSet({
    application: targetApplication,
    issuer: targetApplication.issuer,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      groups: user.groups,
      customClaims: user.custom_claims,
      emailVerified: Boolean(user.email_verified_at),
      authTime: user.last_authenticated_at ?? new Date(),
    },
    scopes,
    includeRefreshToken: false,
    audience: resource,
    tokenType: "DPoP",
    accessTokenLifetimeSeconds: expiresIn,
    accessTokenClaims: {
      act: {
        sub: agent.agent_id,
        operator: agent.operator_id,
        ...(parentAct ? { act: parentAct } : {}),
      },
      authorization_details: result.childDetails,
      authometry_grant_id: result.childId,
      authometry_parent_grant: result.parent.id,
      ...(result.parent.task_id ? { authometry_task_id: result.parent.task_id } : {}),
      cnf: { jkt: proof.jkt },
    },
  });
  return {
    ...issued,
    issued_token_type: "urn:ietf:params:oauth:token-type:access_token",
  };
}

export const tokenRouter = Router({ mergeParams: true });

const dynamicRedirectUriSchema = redirectUriSchema.superRefine((value, context) => {
  const parsed = new URL(value);
  if (parsed.username || parsed.password) {
    context.addIssue({ code: "custom", message: "Redirect URIs cannot contain credentials." });
  }
});

export const dynamicRegistrationSchema = z.object({
  client_name: z.string().trim().min(2).max(100).default("MCP client"),
  redirect_uris: z.array(dynamicRedirectUriSchema).min(1).max(10),
  grant_types: z
    .array(z.enum(["authorization_code", "refresh_token"]))
    .min(1)
    .default(["authorization_code", "refresh_token"]),
  response_types: z.array(z.literal("code")).min(1).max(1).default(["code"]),
  token_endpoint_auth_method: z.literal("none").default("none"),
  client_uri: z.string().url().optional(),
});

tokenRouter.post(
  "/register",
  asyncRoute(async (request, response) => {
    noStore(response);
    const parsed = dynamicRegistrationSchema.safeParse(request.body);
    if (!parsed.success) {
      oauthError(
        response,
        400,
        "invalid_client_metadata",
        parsed.error.issues[0]?.message ?? "The client metadata is invalid.",
      );
      return;
    }
    const input = parsed.data;
    if (!input.grant_types.includes("authorization_code")) {
      oauthError(response, 400, "invalid_client_metadata", "Authorization Code is required.");
      return;
    }
    const environment = await defaultEnvironment(request);
    const baseSlug = createApplicationSlug(input.client_name).slice(0, 50) || "mcp-client";
    const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
    const clientId = randomId("amt_mcp_client", 18);
    const allowedScopes = [
      "mcp:read",
      "mcp:write",
      ...(input.grant_types.includes("refresh_token") ? ["offline_access"] : []),
    ];
    await transaction(async (client) => {
      const application = await client.query<{ id: string }>(
        `INSERT INTO oauth_applications
          (workspace_id, environment_id, name, slug, client_id, client_id_source, type,
           description, redirect_uris, grant_types, response_types, token_endpoint_auth_method,
           require_pkce, require_consent, allowed_scopes)
         VALUES ($1,$2,$3,$4,$5,'dynamic','native',$6,$7,$8,$9,'none',true,true,$10)
         RETURNING id`,
        [
          environment.workspace_id,
          environment.id,
          input.client_name,
          slug,
          clientId,
          input.client_uri ? `Dynamically registered by ${input.client_uri}` : "MCP OAuth client",
          input.redirect_uris,
          input.grant_types,
          input.response_types,
          allowedScopes,
        ],
      );
      const applicationId = application.rows[0]?.id;
      if (!applicationId) throw new Error("The dynamic OAuth client was not created.");
      await client.query(
        `INSERT INTO audit_events
          (workspace_id, environment_id, category, severity, event_type, summary, actor_type,
           actor_name, source_ip, user_agent, resource_type, resource_id, changes)
         VALUES ($1,$2,'security','info','oauth_dynamic_client_registered',$3,'oauth_client',$4,
                 $5,$6,'application',$7,$8)`,
        [
          environment.workspace_id,
          environment.id,
          `Dynamic MCP client registered: ${input.client_name}`,
          input.client_name,
          request.ip,
          request.get("user-agent") ?? null,
          applicationId,
          {
            clientId,
            clientUri: input.client_uri ?? null,
            redirectUris: input.redirect_uris,
            grantTypes: input.grant_types,
          },
        ],
      );
    });
    response.status(201).json({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: input.client_name,
      redirect_uris: input.redirect_uris,
      grant_types: input.grant_types,
      response_types: input.response_types,
      token_endpoint_auth_method: "none",
      scope: allowedScopes.join(" "),
    });
  }),
);

tokenRouter.post(
  "/token",
  asyncRoute(async (request, response) => {
    noStore(response);
    let trace: TraceRecorder | undefined;
    try {
      const application = await authenticateClient(request);
      const grantType = String(request.body.grant_type ?? "");
      if (!application.grant_types.includes(grantType)) {
        throw new ApiError(400, "unauthorized_client", "This grant is not enabled for the client.");
      }
      trace = new TraceRecorder({
        workspaceId: application.workspace_id,
        environmentId: application.environment_id,
        endpoint: "/oauth/token",
        method: "POST",
        eventType: "token_request",
        applicationId: application.id,
        applicationName: application.name,
        clientId: application.client_id,
        grantType,
        request: { query: request.body, headers: request.headers },
      });
      trace.step(
        "Request received",
        "passed",
        "POST /oauth/token",
        "The token endpoint received the request.",
      );
      trace.step(
        "Client authenticated",
        "passed",
        application.client_id,
        "The client authenticated using its configured method.",
      );
      let tokens: Record<string, unknown>;
      switch (grantType) {
        case "authorization_code":
          tokens = await authorizationCodeGrant(
            application,
            request.body as Record<string, unknown>,
            request,
            trace,
          );
          break;
        case "refresh_token":
          tokens = await refreshTokenGrant(
            application,
            String(request.body.refresh_token ?? ""),
            trace,
            request.body.scope ? String(request.body.scope) : undefined,
            request.body.resource ? String(request.body.resource) : undefined,
          );
          break;
        case "client_credentials": {
          const requested = String(request.body.scope ?? "")
            .split(" ")
            .filter(Boolean);
          const scopes = requested.length
            ? requested
            : application.allowed_scopes.filter((scope) => scope !== "openid");
          if (!scopes.every((scope) => application.allowed_scopes.includes(scope))) {
            throw new ApiError(400, "invalid_scope", "The client requested an unassigned scope.");
          }
          const agent = await findAgentForClient(application.client_id);
          const resource = String(request.body.resource ?? "");
          if (agent && (!resource || !agent.allowed_resources.includes(resource))) {
            throw new ApiError(
              400,
              "invalid_target",
              "Registered agents must request an assigned resource audience.",
            );
          }
          tokens = await issueTokenSet({
            application,
            issuer: application.issuer,
            scopes,
            includeRefreshToken: false,
            ...(agent
              ? {
                  subject: agent.agent_id,
                  audience: resource,
                  accessTokenClaims: { agent_operator: agent.operator_id },
                }
              : {}),
          });
          break;
        }
        case "urn:ietf:params:oauth:grant-type:device_code":
          tokens = await deviceCodeGrant(
            application,
            String(request.body.device_code ?? ""),
            trace,
          );
          break;
        case "urn:ietf:params:oauth:grant-type:token-exchange":
          tokens = await tokenExchangeGrant(
            application,
            request.body as Record<string, unknown>,
            request,
            trace,
          );
          break;
        default:
          throw new ApiError(
            400,
            "unsupported_grant_type",
            "The requested grant type is not supported.",
          );
      }
      trace.step(
        "Token issued",
        "passed",
        "Signed token response",
        "The request passed validation and tokens were issued.",
      );
      await trace.finish("success");
      response.json(tokens);
    } catch (error) {
      if (error instanceof ApiError) {
        if (trace) {
          trace.step("Token request rejected", "failed", error.code, error.message, {
            decision: { outcome: "denied", reason: error.message },
          });
          await trace.finish("denied", {
            oauthError: error.code,
            explanation: {
              code: error.code,
              title: "The token request was rejected",
              message: error.message,
              resolution:
                "Correct the client authentication, grant inputs, or token value and retry.",
              documentationPath: "/docs/oauth/token-endpoint",
            },
          });
        }
        oauthError(response, error.status === 401 ? 401 : 400, error.code, error.message);
        return;
      }
      throw error;
    }
  }),
);

tokenRouter.post(
  "/device/authorization",
  asyncRoute(async (request, response) => {
    noStore(response);
    const application = await authenticateClient(request);
    if (!application.grant_types.includes("urn:ietf:params:oauth:grant-type:device_code")) {
      throw new ApiError(
        400,
        "unauthorized_client",
        "Device authorization is not enabled for this client.",
      );
    }
    const scopes = String(request.body.scope ?? "openid")
      .split(" ")
      .filter(Boolean);
    if (!scopes.every((scope) => application.allowed_scopes.includes(scope))) {
      throw new ApiError(400, "invalid_scope", "The client requested an unassigned scope.");
    }
    const deviceCode = randomToken(40);
    const userCode = `${randomToken(4).slice(0, 4)}-${randomToken(4).slice(0, 4)}`.toUpperCase();
    await query(
      `INSERT INTO device_authorizations
        (workspace_id, environment_id, application_id, device_code_hash, user_code, scopes, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,now() + interval '10 minutes')`,
      [
        application.workspace_id,
        application.environment_id,
        application.id,
        hashToken(deviceCode),
        userCode,
        scopes,
      ],
    );
    response.json({
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: `${application.issuer}/oauth/device`,
      verification_uri_complete: `${application.issuer}/oauth/device?user_code=${encodeURIComponent(userCode)}`,
      expires_in: 600,
      interval: 5,
    });
  }),
);

tokenRouter.post(
  "/revoke",
  asyncRoute(async (request, response) => {
    const application = await authenticateClient(request);
    const token = String(request.body.token ?? "");
    const [refresh] = await query<{ family_id: string }>(
      "SELECT family_id FROM refresh_tokens WHERE token_hash = $1",
      [hashToken(token)],
    );
    if (refresh) {
      await transaction(async (client) => {
        await client.query(
          "UPDATE refresh_token_families SET status = 'revoked', revoked_reason = 'client_revocation', updated_at = now() WHERE id = $1",
          [refresh.family_id],
        );
        await client.query("UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1", [
          refresh.family_id,
        ]);
      });
    } else {
      try {
        const { payload } = await verifyOAuthJwt(token, application.issuer);
        if (payload.jti && payload.exp && payload.client_id === application.client_id) {
          await query(
            `INSERT INTO revoked_access_tokens(jti, workspace_id, environment_id, application_id, expires_at)
             VALUES ($1,$2,$3,$4,to_timestamp($5)) ON CONFLICT (jti) DO NOTHING`,
            [
              payload.jti,
              application.workspace_id,
              application.environment_id,
              application.id,
              payload.exp,
            ],
          );
        }
      } catch {
        // RFC 7009 revocation does not reveal whether the token was valid.
      }
    }
    response.status(200).end();
  }),
);

tokenRouter.post(
  "/introspect",
  asyncRoute(async (request, response) => {
    const application = await authenticateClient(request);
    const token = String(request.body.token ?? "");
    try {
      const payload = decodeJwt(token);
      const { payload: verified } = await verifyOAuthJwt(token, application.issuer);
      const tokenClient =
        typeof verified.client_id === "string"
          ? await findApplicationByClientId(verified.client_id)
          : undefined;
      if (!tokenClient || tokenClient.environment_id !== application.environment_id) {
        throw new Error("wrong environment");
      }
      if (verified.jti) {
        const [revoked] = await query("SELECT jti FROM revoked_access_tokens WHERE jti = $1", [
          verified.jti,
        ]);
        if (revoked) throw new Error("revoked");
      }
      if (typeof verified.authometry_grant_id === "string") {
        const grants = await query<{
          status: string;
          expires_at: Date;
          agent_status: string;
        }>(
          `WITH RECURSIVE lineage AS (
             SELECT id, parent_grant_id, status, expires_at, actor_agent_id
             FROM delegation_grants WHERE id = $1
             UNION ALL
             SELECT parent.id, parent.parent_grant_id, parent.status, parent.expires_at,
                    parent.actor_agent_id
             FROM delegation_grants parent JOIN lineage child ON child.parent_grant_id = parent.id
           )
           SELECT lineage.status, lineage.expires_at, agent.status AS agent_status
           FROM lineage JOIN agent_identities agent ON agent.id = lineage.actor_agent_id`,
          [verified.authometry_grant_id],
        );
        if (
          !grants.length ||
          grants.some(
            (grant) =>
              grant.status !== "active" ||
              grant.agent_status !== "active" ||
              grant.expires_at < new Date(),
          )
        ) {
          throw new Error("inactive grant");
        }
      } else {
        const audience = Array.isArray(verified.aud) ? verified.aud : [verified.aud];
        if (!audience.includes(application.client_id)) throw new Error("wrong audience");
      }
      response.json({
        active: true,
        scope: verified.scope,
        client_id: verified.client_id,
        sub: verified.sub,
        token_type: verified.cnf ? "DPoP" : "Bearer",
        exp: verified.exp,
        iat: verified.iat,
        iss: verified.iss,
        aud: payload.aud,
        ...(verified.act ? { act: verified.act } : {}),
        ...(verified.authorization_details
          ? { authorization_details: verified.authorization_details }
          : {}),
        ...(verified.authometry_grant_id
          ? { authometry_grant_id: verified.authometry_grant_id }
          : {}),
        ...(verified.cnf ? { cnf: verified.cnf } : {}),
      });
      return;
    } catch {
      const [refresh] = await query<{
        scopes: string[];
        status: string;
        expires_at: Date;
        application_id: string;
        user_id: string | null;
      }>(
        `SELECT f.scopes, f.status, t.expires_at, f.application_id, f.user_id
         FROM refresh_tokens t JOIN refresh_token_families f ON f.id = t.family_id
         WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND t.consumed_at IS NULL`,
        [hashToken(token)],
      );
      if (
        refresh?.application_id === application.id &&
        refresh.status === "active" &&
        refresh.expires_at > new Date()
      ) {
        response.json({
          active: true,
          scope: refresh.scopes.join(" "),
          client_id: application.client_id,
          sub: refresh.user_id,
          token_type: "refresh_token",
          exp: Math.floor(refresh.expires_at.getTime() / 1000),
        });
        return;
      }
      response.json({ active: false });
    }
  }),
);
