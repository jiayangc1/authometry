import { Router } from "express";
import { z } from "zod";
import { query, transaction } from "../db.js";
import { randomId } from "../lib/crypto.js";
import { ApiError, asyncRoute } from "../lib/http.js";
import { auditMutation, requireEnvironment } from "./context.js";

const jwkSchema = z
  .object({
    kty: z.string().min(1),
    kid: z.string().optional(),
    alg: z.enum(["RS256", "ES256"]),
    use: z.string().optional(),
  })
  .passthrough()
  .refine(
    (jwk) =>
      ["RSA", "EC"].includes(jwk.kty) &&
      ((jwk.kty === "RSA" && jwk.alg === "RS256") || (jwk.kty === "EC" && jwk.alg === "ES256")) &&
      (!jwk.use || jwk.use === "sig") &&
      !["d", "p", "q", "dp", "dq", "qi", "oth", "k"].some((field) => field in jwk),
    "A public RSA or EC signing JWK without private key material is required.",
  );

const agentInputSchema = z.object({
  agentId: z.string().regex(/^[a-zA-Z0-9._:-]{3,160}$/),
  displayName: z.string().min(2).max(120),
  operatorId: z.string().min(2).max(160),
  publicJwk: jwkSchema,
  redirectUris: z.array(z.string().url()).min(1).max(25),
  capabilities: z.array(z.string().min(1)).min(1).max(100),
  allowedResources: z.array(z.string().url()).min(1).max(50),
  mayReceiveDelegation: z.boolean().default(true),
  mayDelegate: z.boolean().default(false),
  maximumDelegationDepth: z.number().int().min(0).max(5).default(0),
  maximumAuthorizationSeconds: z.number().int().min(60).max(86_400).default(900),
});

export const agentsRouter = Router();
agentsRouter.use(["/agents", "/agent-grants"], requireEnvironment);
agentsRouter.use(["/agents", "/agent-grants"], auditMutation);
agentsRouter.use(["/agents", "/agent-grants"], (request, _response, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
  if (["owner", "admin", "developer"].includes(request.admin?.role ?? "")) return next();
  next(new ApiError(403, "insufficient_role", "Developer, admin, or owner access is required."));
});

agentsRouter.get(
  "/agents",
  asyncRoute(async (request, response) => {
    const rows = await query(
      `SELECT g.id, g.agent_id, g.display_name, g.operator_id, g.capabilities,
              g.allowed_resources, g.may_receive_delegation, g.may_delegate,
              g.maximum_delegation_depth, g.maximum_authorization_seconds, g.status,
              g.version, g.created_at, g.updated_at, a.client_id,
              count(d.id) FILTER (WHERE d.status = 'active' AND d.expires_at > now())::integer AS active_grants
       FROM agent_identities g JOIN oauth_applications a ON a.id = g.application_id
       LEFT JOIN delegation_grants d ON d.actor_agent_id = g.id
       WHERE g.environment_id = $1
       GROUP BY g.id, a.client_id ORDER BY g.updated_at DESC`,
      [request.environment!.id],
    );
    response.json({ data: rows, meta: { total: rows.length } });
  }),
);

agentsRouter.post(
  "/agents",
  asyncRoute(async (request, response) => {
    const input = agentInputSchema.parse(request.body);
    if (input.mayDelegate && input.maximumDelegationDepth === 0) {
      throw new ApiError(
        422,
        "validation_failed",
        "Delegating agents need a positive maximum delegation depth.",
      );
    }
    const environment = request.environment!;
    const existingCapabilities = await query<{ name: string }>(
      "SELECT name FROM resource_scopes WHERE environment_id = $1 AND name = ANY($2)",
      [environment.id, input.capabilities],
    );
    const knownCapabilities = new Set(existingCapabilities.map(({ name }) => name));
    const unknownCapabilities = input.capabilities.filter(
      (capability) => !knownCapabilities.has(capability),
    );
    if (unknownCapabilities.length) {
      throw new ApiError(
        422,
        "unknown_agent_capability",
        `Register resource scopes before assigning them to an agent: ${unknownCapabilities.join(", ")}.`,
      );
    }
    const clientId = randomId("agent", 16);
    const result = await transaction(async (client) => {
      const app = await client.query<{ id: string }>(
        `INSERT INTO oauth_applications
          (workspace_id, environment_id, name, slug, client_id, type, description, redirect_uris,
           grant_types, token_endpoint_auth_method, require_pkce, require_consent, allowed_scopes,
           access_token_lifetime_seconds, refresh_token_lifetime_seconds)
         VALUES ($1,$2,$3,$4,$5,'web',$6,$7,$8,'private_key_jwt',true,true,$9,$10,300)
         RETURNING id`,
        [
          environment.workspaceId,
          environment.id,
          input.displayName,
          `agent-${randomId("", 8).toLowerCase()}`,
          clientId,
          `Agent operated by ${input.operatorId}`,
          input.redirectUris,
          [
            "authorization_code",
            "client_credentials",
            "urn:ietf:params:oauth:grant-type:token-exchange",
          ],
          input.capabilities,
          input.maximumAuthorizationSeconds,
        ],
      );
      const agent = await client.query<{ id: string }>(
        `INSERT INTO agent_identities
          (workspace_id, environment_id, application_id, agent_id, display_name, operator_id,
           public_jwk, capabilities, allowed_resources, may_receive_delegation, may_delegate,
           maximum_delegation_depth, maximum_authorization_seconds)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [
          environment.workspaceId,
          environment.id,
          app.rows[0]!.id,
          input.agentId,
          input.displayName,
          input.operatorId,
          input.publicJwk,
          input.capabilities,
          input.allowedResources,
          input.mayReceiveDelegation,
          input.mayDelegate,
          input.maximumDelegationDepth,
          input.maximumAuthorizationSeconds,
        ],
      );
      return agent.rows[0]!.id;
    });
    response.status(201).json({ id: result, agentId: input.agentId, clientId });
  }),
);

agentsRouter.get(
  "/agents/:agentId",
  asyncRoute(async (request, response) => {
    const [agent] = await query(
      `SELECT g.*, a.client_id, a.redirect_uris
       FROM agent_identities g JOIN oauth_applications a ON a.id = g.application_id
       WHERE g.id = $1 AND g.environment_id = $2`,
      [request.params.agentId, request.environment!.id],
    );
    if (!agent) throw new ApiError(404, "agent_not_found", "The agent was not found.");
    response.json(agent);
  }),
);

agentsRouter.post(
  "/agents/:agentId/disable",
  asyncRoute(async (request, response) => {
    const environment = request.environment!;
    const changed = await transaction(async (client) => {
      const result = await client.query<{ application_id: string }>(
        `UPDATE agent_identities SET status = 'disabled', version = version + 1, updated_at = now()
         WHERE id = $1 AND environment_id = $2 AND status <> 'disabled' RETURNING application_id`,
        [request.params.agentId, environment.id],
      );
      const agent = result.rows[0];
      if (!agent) return false;
      await client.query(
        "UPDATE oauth_applications SET status = 'disabled', updated_at = now() WHERE id = $1",
        [agent.application_id],
      );
      await client.query(
        `WITH RECURSIVE affected AS (
           SELECT id FROM delegation_grants WHERE actor_agent_id = $1
           UNION ALL
           SELECT child.id FROM delegation_grants child JOIN affected parent ON child.parent_grant_id = parent.id
         )
         UPDATE delegation_grants SET status = 'revoked', revoked_at = now(), revoked_reason = 'agent_disabled'
         WHERE id IN (SELECT id FROM affected) AND status = 'active'`,
        [request.params.agentId],
      );
      return true;
    });
    if (!changed) throw new ApiError(404, "agent_not_found", "The active agent was not found.");
    response.status(204).end();
  }),
);

agentsRouter.post(
  "/agents/:agentId/enable",
  asyncRoute(async (request, response) => {
    const changed = await transaction(async (client) => {
      const result = await client.query<{ application_id: string }>(
        `UPDATE agent_identities SET status = 'active', version = version + 1, updated_at = now()
         WHERE id = $1 AND environment_id = $2 AND status = 'disabled' RETURNING application_id`,
        [request.params.agentId, request.environment!.id],
      );
      const agent = result.rows[0];
      if (!agent) return false;
      await client.query(
        "UPDATE oauth_applications SET status = 'active', updated_at = now() WHERE id = $1",
        [agent.application_id],
      );
      return true;
    });
    if (!changed) throw new ApiError(404, "agent_not_found", "The disabled agent was not found.");
    response.status(204).end();
  }),
);

agentsRouter.post(
  "/agents/:agentId/rotate-key",
  asyncRoute(async (request, response) => {
    const input = z.object({ publicJwk: jwkSchema }).parse(request.body);
    const [agent] = await query(
      `UPDATE agent_identities SET public_jwk = $3, version = version + 1, updated_at = now()
       WHERE id = $1 AND environment_id = $2 RETURNING id, version, updated_at`,
      [request.params.agentId, request.environment!.id, input.publicJwk],
    );
    if (!agent) throw new ApiError(404, "agent_not_found", "The agent was not found.");
    response.json(agent);
  }),
);

agentsRouter.get(
  "/agent-grants",
  asyncRoute(async (request, response) => {
    const status = String(request.query.status ?? "");
    const rows = await query(
      `SELECT d.*, g.agent_id, g.display_name AS agent_name, g.operator_id,
              u.email AS subject_email, u.name AS subject_name, a.client_id
       FROM delegation_grants d
       JOIN agent_identities g ON g.id = d.actor_agent_id
       JOIN identity_users u ON u.id = d.subject_user_id
       JOIN oauth_applications a ON a.id = d.application_id
       WHERE d.environment_id = $1 AND ($2 = '' OR d.status = $2)
       ORDER BY d.created_at DESC LIMIT 100`,
      [request.environment!.id, status],
    );
    response.json({ data: rows, meta: { total: rows.length } });
  }),
);

agentsRouter.post(
  "/agent-grants/:grantId/revoke",
  asyncRoute(async (request, response) => {
    const input = z
      .object({ reason: z.string().min(1).max(300).default("admin_revocation") })
      .parse(request.body ?? {});
    const grants = await query(
      `WITH RECURSIVE affected AS (
         SELECT id FROM delegation_grants WHERE id = $1 AND environment_id = $2 AND status = 'active'
         UNION ALL
         SELECT child.id FROM delegation_grants child JOIN affected parent ON child.parent_grant_id = parent.id
       ), changed AS (
         UPDATE delegation_grants SET status = 'revoked', revoked_at = now(), revoked_reason = $3
         WHERE id IN (SELECT id FROM affected) AND status = 'active' RETURNING id
       ) SELECT id FROM changed`,
      [request.params.grantId, request.environment!.id, input.reason],
    );
    if (!grants.length)
      throw new ApiError(404, "grant_not_found", "The active grant was not found.");
    response.status(204).end();
  }),
);

agentsRouter.post(
  "/agent-grants/:grantId/usage",
  asyncRoute(async (request, response) => {
    const grant = await transaction(async (client) => {
      const lineageIds = await client.query<{ id: string }>(
        `WITH RECURSIVE lineage AS (
           SELECT id, parent_grant_id FROM delegation_grants WHERE id = $1 AND environment_id = $2
           UNION ALL
           SELECT parent.id, parent.parent_grant_id
           FROM delegation_grants parent JOIN lineage child ON child.parent_grant_id = parent.id
         ) SELECT id FROM lineage`,
        [request.params.grantId, request.environment!.id],
      );
      const lineage = await client.query<{
        id: string;
        status: string;
        expires_at: Date;
        usage_count: number;
        maximum_usage: number | null;
      }>(
        `SELECT id, status, expires_at, usage_count, maximum_usage
         FROM delegation_grants WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
        [lineageIds.rows.map(({ id }) => id)],
      );
      if (
        !lineage.rows.length ||
        lineage.rows.some(
          (item) =>
            item.status !== "active" ||
            item.expires_at <= new Date() ||
            (item.maximum_usage !== null && item.usage_count >= item.maximum_usage),
        )
      ) {
        return undefined;
      }
      const updated = await client.query<{
        id: string;
        status: string;
        usage_count: number;
        maximum_usage: number | null;
      }>(
        `UPDATE delegation_grants SET usage_count = usage_count + 1,
           status = CASE WHEN maximum_usage IS NOT NULL AND usage_count + 1 >= maximum_usage
                         THEN 'completed' ELSE status END
         WHERE id = ANY($1::uuid[])
         RETURNING id, status, usage_count, maximum_usage`,
        [lineage.rows.map(({ id }) => id)],
      );
      return updated.rows.find(({ id }) => id === request.params.grantId);
    });
    if (!grant)
      throw new ApiError(409, "grant_not_usable", "The grant is inactive, expired, or exhausted.");
    response.json(grant);
  }),
);
