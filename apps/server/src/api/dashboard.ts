import { hash } from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { applicationInputSchema, createApplicationSlug, scopeNameSchema } from "@authometry/domain";
import { query, transaction } from "../db.js";
import { hashToken, randomId } from "../lib/crypto.js";
import { ApiError, asyncRoute } from "../lib/http.js";
import { type IdentityUserLifecycleRow, userLifecycleData } from "../lib/user-lifecycle.js";
import { auditMutation, requireEnvironment } from "./context.js";

export const dashboardRouter = Router();
const launchUriSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      const target = new URL(value);
      const local = ["localhost", "127.0.0.1", "::1"].includes(target.hostname);
      return (
        !target.username &&
        !target.password &&
        (target.protocol === "https:" || (local && target.protocol === "http:"))
      );
    },
    { message: "Launch URLs must use HTTPS and cannot contain embedded credentials." },
  );
dashboardRouter.use(requireEnvironment);
dashboardRouter.use(auditMutation);
dashboardRouter.use("/applications", (request, _response, next) => {
  const scopes = request.admin?.tokenScopes;
  if (!scopes) return next();
  const required = ["GET", "HEAD", "OPTIONS"].includes(request.method)
    ? "applications:read"
    : "applications:write";
  if (scopes.includes(required)) return next();
  next(new ApiError(403, "insufficient_scope", `The API token requires ${required}.`));
});
dashboardRouter.use((request, _response, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
  if (["owner", "admin", "developer"].includes(request.admin?.role ?? "")) return next();
  next(new ApiError(403, "insufficient_role", "Developer, admin, or owner access is required."));
});

dashboardRouter.get(
  "/overview",
  asyncRoute(async (request, response) => {
    const environment = request.environment!;
    const [metrics] = await query<{
      total: string;
      success: string;
      failed: string;
      active_sessions: string;
    }>(
      `SELECT
        count(*) FILTER (WHERE started_at > now() - interval '24 hours')::text AS total,
        count(*) FILTER (WHERE started_at > now() - interval '24 hours' AND status = 'success')::text AS success,
        count(*) FILTER (WHERE started_at > now() - interval '24 hours' AND status IN ('denied','error'))::text AS failed,
        (SELECT count(*)::text FROM user_sessions WHERE environment_id = $1 AND status = 'active' AND expires_at > now()) AS active_sessions
       FROM authorization_traces WHERE environment_id = $1`,
      [environment.id],
    );
    const recentTraces = await query(
      `SELECT id, request_id, status, event_type, application_name, user_snapshot, duration_ms, started_at
       FROM authorization_traces WHERE environment_id = $1 ORDER BY started_at DESC LIMIT 8`,
      [environment.id],
    );
    const recentEvents = await query(
      `SELECT id, event_type, summary, actor_name, resource_type, created_at
       FROM audit_events WHERE environment_id = $1 ORDER BY created_at DESC LIMIT 6`,
      [environment.id],
    );
    const chartRows = await query<{
      bucket: Date;
      successful: string;
      denied: string;
      failed: string;
    }>(
      `SELECT date_trunc('hour', started_at) AS bucket,
              count(*) FILTER (WHERE status = 'success')::text AS successful,
              count(*) FILTER (WHERE status = 'denied')::text AS denied,
              count(*) FILTER (WHERE status = 'error')::text AS failed
       FROM authorization_traces
       WHERE environment_id = $1 AND started_at > now() - interval '24 hours'
       GROUP BY bucket ORDER BY bucket`,
      [environment.id],
    );
    const total = Number(metrics?.total ?? 0);
    const success = Number(metrics?.success ?? 0);
    response.json({
      health: { status: "operational", label: "All systems operational" },
      issuer: environment.issuer,
      environment: environment.name,
      version: "0.1.1",
      metrics: {
        authorizationRequests: total,
        successRate: total ? (success / total) * 100 : 100,
        activeSessions: Number(metrics?.active_sessions ?? 0),
        failedRequests: Number(metrics?.failed ?? 0),
      },
      chart: chartRows.map((row) => ({
        time: new Date(row.bucket).toLocaleTimeString("en", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        successful: Number(row.successful),
        denied: Number(row.denied),
        failed: Number(row.failed),
      })),
      recentTraces,
      recentEvents,
    });
  }),
);

dashboardRouter.get(
  "/applications",
  asyncRoute(async (request, response) => {
    const search = String(request.query.q ?? "");
    const type = String(request.query.type ?? "");
    const status = String(request.query.status ?? "");
    const applications = await query(
      `SELECT * FROM oauth_applications
       WHERE environment_id = $1
         AND client_id_source <> 'dynamic'
         AND ($2 = '' OR name ILIKE '%' || $2 || '%' OR slug ILIKE '%' || $2 || '%' OR client_id ILIKE '%' || $2 || '%')
         AND ($3 = '' OR type = $3)
         AND ($4 = '' OR status = $4)
       ORDER BY updated_at DESC`,
      [request.environment!.id, search, type, status],
    );
    response.json({ data: applications, meta: { total: applications.length } });
  }),
);

dashboardRouter.post(
  "/applications",
  asyncRoute(async (request, response) => {
    const input = applicationInputSchema.parse(request.body);
    const environment = request.environment!;
    const [defaults] = await query<{
      default_access_token_lifetime_seconds: number;
      default_refresh_token_lifetime_seconds: number;
      require_consent: boolean;
    }>(
      `SELECT default_access_token_lifetime_seconds, default_refresh_token_lifetime_seconds, require_consent
       FROM workspace_settings WHERE workspace_id = $1`,
      [environment.workspaceId],
    );
    const clientId = randomId("amt_client", 12);
    const needsSecret = ["web", "machine"].includes(input.type);
    const secret = needsSecret ? randomId("amt_secret", 32) : undefined;
    const result = await transaction(async (client) => {
      const created = await client.query<{ id: string }>(
        `INSERT INTO oauth_applications
          (workspace_id, environment_id, name, slug, client_id, type, description, logo_uri, redirect_uris,
           post_logout_redirect_uris, grant_types, token_endpoint_auth_method, require_pkce, require_consent,
           allowed_scopes, access_token_lifetime_seconds, refresh_token_lifetime_seconds)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
        [
          environment.workspaceId,
          environment.id,
          input.name,
          input.slug,
          clientId,
          input.type,
          input.description ?? null,
          input.logoUri ?? null,
          input.redirectUris,
          input.postLogoutRedirectUris,
          input.type === "machine"
            ? ["client_credentials"]
            : input.type === "device"
              ? ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"]
              : ["authorization_code", "refresh_token"],
          needsSecret ? "client_secret_basic" : "none",
          input.type !== "machine",
          defaults?.require_consent ?? true,
          input.allowedScopes ?? (input.type === "machine" ? [] : ["openid", "profile", "email"]),
          defaults?.default_access_token_lifetime_seconds ?? 900,
          defaults?.default_refresh_token_lifetime_seconds ?? 2_592_000,
        ],
      );
      const id = created.rows[0]?.id;
      if (!id) throw new Error("Application was not created.");
      if (secret) {
        await client.query(
          `INSERT INTO client_credentials
            (workspace_id, environment_id, application_id, name, prefix, secret_hash)
           VALUES ($1,$2,$3,'Primary secret',$4,$5)`,
          [environment.workspaceId, environment.id, id, secret.slice(0, 18), hashToken(secret)],
        );
      }
      await client.query(
        `INSERT INTO audit_events
          (workspace_id, environment_id, category, severity, event_type, summary, actor_type, actor_id, actor_name, resource_type, resource_id)
         VALUES ($1,$2,'configuration','info','application.created',$3,'admin',$4,$5,'application',$6)`,
        [
          environment.workspaceId,
          environment.id,
          `${input.name} created`,
          request.admin!.userId,
          request.admin!.email,
          id,
        ],
      );
      return id;
    });
    response.status(201).json({
      id: result,
      issuer: environment.issuer,
      clientId,
      ...(secret ? { clientSecret: secret } : {}),
    });
  }),
);

dashboardRouter.get(
  "/applications/:applicationId",
  asyncRoute(async (request, response) => {
    const [application] = await query(
      `SELECT a.*,
              EXISTS (
                SELECT 1 FROM webhooks w WHERE w.environment_id = a.environment_id
                  AND w.purpose = 'provisioning' AND w.status = 'enabled'
              ) AS provisioning_enabled
       FROM oauth_applications a
       WHERE a.id = $1 AND a.environment_id = $2 AND a.client_id_source <> 'dynamic'`,
      [request.params.applicationId, request.environment!.id],
    );
    if (!application)
      throw new ApiError(404, "application_not_found", "The application was not found.");
    const credentials = await query(
      `SELECT id, name, prefix, expires_at, last_used_at, revoked_at, created_at
       FROM client_credentials WHERE application_id = $1 ORDER BY created_at DESC`,
      [request.params.applicationId],
    );
    response.json({ ...application, credentials });
  }),
);

dashboardRouter.patch(
  "/applications/:applicationId",
  asyncRoute(async (request, response) => {
    const input = z
      .object({
        name: z.string().min(2).max(100).optional(),
        description: z.string().max(500).nullable().optional(),
        logoUri: applicationInputSchema.shape.logoUri.nullable().optional(),
        redirectUris: z.array(z.string().url()).max(25).optional(),
        postLogoutRedirectUris: z.array(z.string().url()).max(25).optional(),
        requirePkce: z.boolean().optional(),
        requireConsent: z.boolean().optional(),
        allowedScopes: z.array(scopeNameSchema).optional(),
        portalEnabled: z.boolean().optional(),
        launchUri: launchUriSchema.nullable().optional(),
        version: z.number().int().positive(),
      })
      .parse(request.body);
    const [existing] = await query<{
      ownership: string;
      portal_enabled: boolean;
      launch_uri: string | null;
    }>(
      `SELECT ownership, portal_enabled, launch_uri FROM oauth_applications
       WHERE id = $1 AND environment_id = $2 AND client_id_source <> 'dynamic'`,
      [request.params.applicationId, request.environment!.id],
    );
    if (!existing)
      throw new ApiError(404, "application_not_found", "The application was not found.");
    if (existing.ownership === "manifest") {
      throw new ApiError(
        409,
        "manifest_managed",
        "This application is managed by a manifest and is read-only.",
      );
    }
    const nextPortalEnabled = input.portalEnabled ?? existing.portal_enabled;
    const nextLaunchUri = Object.hasOwn(input, "launchUri") ? input.launchUri : existing.launch_uri;
    if (nextPortalEnabled && !nextLaunchUri) {
      throw new ApiError(
        422,
        "launch_uri_required",
        "Add the application's sign-in URL before enabling employee portal access.",
      );
    }
    const [updated] = await query(
      `UPDATE oauth_applications SET
        name = COALESCE($3, name), description = CASE WHEN $4::boolean THEN $5 ELSE description END,
        redirect_uris = COALESCE($6, redirect_uris), post_logout_redirect_uris = COALESCE($7, post_logout_redirect_uris),
        require_pkce = COALESCE($8, require_pkce), require_consent = COALESCE($9, require_consent),
        allowed_scopes = COALESCE($10, allowed_scopes),
        portal_enabled = COALESCE($11, portal_enabled),
        launch_uri = CASE WHEN $12::boolean THEN $13 ELSE launch_uri END,
        logo_uri = CASE WHEN $14::boolean THEN $15 ELSE logo_uri END,
        version = version + 1, updated_at = now()
       WHERE id = $1 AND environment_id = $2 AND version = $16 RETURNING *`,
      [
        request.params.applicationId,
        request.environment!.id,
        input.name ?? null,
        Object.hasOwn(input, "description"),
        input.description ?? null,
        input.redirectUris ?? null,
        input.postLogoutRedirectUris ?? null,
        input.requirePkce ?? null,
        input.requireConsent ?? null,
        input.allowedScopes ?? null,
        input.portalEnabled ?? null,
        Object.hasOwn(input, "launchUri"),
        input.launchUri ?? null,
        Object.hasOwn(input, "logoUri"),
        input.logoUri ?? null,
        input.version,
      ],
    );
    if (!updated)
      throw new ApiError(
        409,
        "version_conflict",
        "The application changed elsewhere. Reload and try again.",
      );
    response.json(updated);
  }),
);

dashboardRouter.delete(
  "/applications/:applicationId",
  asyncRoute(async (request, response) => {
    const environment = request.environment!;
    await transaction(async (client) => {
      const application = await client.query<{
        id: string;
        name: string;
        ownership: string;
      }>(
        `SELECT id, name, ownership FROM oauth_applications
         WHERE id = $1 AND environment_id = $2 AND client_id_source <> 'dynamic'
         FOR UPDATE`,
        [request.params.applicationId, environment.id],
      );
      const existing = application.rows[0];
      if (!existing) {
        throw new ApiError(404, "application_not_found", "The application was not found.");
      }
      if (existing.ownership === "manifest") {
        throw new ApiError(
          409,
          "manifest_managed",
          "This application is managed by a manifest and must be deleted from its configuration repository.",
        );
      }

      await client.query(
        `UPDATE authorization_policies
         SET application_ids = array_remove(application_ids, $1::uuid),
             version = version + 1, updated_at = now()
         WHERE environment_id = $2 AND $1::uuid = ANY(application_ids)`,
        [existing.id, environment.id],
      );
      await client.query(
        `INSERT INTO audit_events
          (workspace_id, environment_id, category, severity, event_type, summary, actor_type,
           actor_id, actor_name, resource_type, resource_id)
         VALUES ($1,$2,'configuration','warning','application.deleted',$3,'admin',$4,$5,'application',$6)`,
        [
          environment.workspaceId,
          environment.id,
          `${existing.name} deleted`,
          request.admin!.userId,
          request.admin!.email,
          existing.id,
        ],
      );
      await client.query("DELETE FROM oauth_applications WHERE id = $1", [existing.id]);
    });
    response.status(204).end();
  }),
);

dashboardRouter.post(
  "/applications/:applicationId/credentials",
  asyncRoute(async (request, response) => {
    const input = z
      .object({
        name: z.string().min(2).max(100),
        expiresInDays: z.number().int().positive().max(365).nullable(),
      })
      .parse(request.body);
    const secret = randomId("amt_secret", 32);
    const [credential] = await query<{ id: string }>(
      `INSERT INTO client_credentials
        (workspace_id, environment_id, application_id, name, prefix, secret_hash, expires_at)
       SELECT workspace_id, environment_id, id, $3, $4, $5,
              CASE WHEN $6::integer IS NULL THEN NULL ELSE now() + ($6 * interval '1 day') END
       FROM oauth_applications
       WHERE id = $1 AND environment_id = $2 AND client_id_source <> 'dynamic' RETURNING id`,
      [
        request.params.applicationId,
        request.environment!.id,
        input.name,
        secret.slice(0, 18),
        hashToken(secret),
        input.expiresInDays,
      ],
    );
    if (!credential)
      throw new ApiError(404, "application_not_found", "The application was not found.");
    response.status(201).json({ id: credential.id, secret });
  }),
);

dashboardRouter.post(
  "/applications/:applicationId/credentials/:credentialId/revoke",
  asyncRoute(async (request, response) => {
    await query(
      `UPDATE client_credentials SET revoked_at = now()
       WHERE id = $1 AND application_id = $2 AND environment_id = $3`,
      [request.params.credentialId, request.params.applicationId, request.environment!.id],
    );
    response.status(204).end();
  }),
);

dashboardRouter.get(
  "/traces",
  asyncRoute(async (request, response) => {
    const status = String(request.query.status ?? "");
    const application = String(request.query.application ?? "");
    const search = String(request.query.q ?? "");
    const limit = Math.min(Math.max(Number(request.query.limit ?? 50), 1), 100);
    const traces = await query(
      `SELECT id, request_id, status, event_type, application_id, application_name, client_id,
              user_snapshot, grant_type, endpoint, duration_ms, oauth_error, started_at
       FROM authorization_traces
       WHERE environment_id = $1 AND ($2 = '' OR status = $2)
         AND ($3 = '' OR application_id::text = $3 OR client_id = $3)
         AND ($4 = '' OR request_id ILIKE '%' || $4 || '%' OR client_id ILIKE '%' || $4 || '%'
              OR application_name ILIKE '%' || $4 || '%' OR user_snapshot->>'email' ILIKE '%' || $4 || '%')
       ORDER BY started_at DESC LIMIT $5`,
      [request.environment!.id, status, application, search, limit],
    );
    response.json({ data: traces, meta: { total: traces.length } });
  }),
);

dashboardRouter.get(
  "/traces/:traceId",
  asyncRoute(async (request, response) => {
    const [trace] = await query(
      `SELECT * FROM authorization_traces
       WHERE (id::text = $1 OR request_id = $1) AND environment_id = $2`,
      [request.params.traceId, request.environment!.id],
    );
    if (!trace)
      throw new ApiError(
        404,
        "trace_not_found",
        "This trace may have expired, been deleted, or belong to another environment.",
      );
    response.json(trace);
  }),
);

dashboardRouter.get(
  "/users",
  asyncRoute(async (request, response) => {
    const search = String(request.query.q ?? "");
    const users = await query(
      `SELECT u.id, u.email, u.name, u.email_verified_at, u.status, u.groups, u.mfa_enabled,
              u.created_at, u.last_authenticated_at,
              COALESCE(array_agg(DISTINCT s.provider) FILTER (WHERE s.provider IS NOT NULL), '{}') AS social_connections,
              (SELECT count(*)::integer FROM user_sessions us WHERE us.user_id = u.id AND us.status = 'active') AS active_sessions
       FROM identity_users u LEFT JOIN social_identities s ON s.user_id = u.id
       WHERE u.workspace_id = $1 AND ($2 = '' OR u.email ILIKE '%' || $2 || '%' OR u.name ILIKE '%' || $2 || '%')
       GROUP BY u.id ORDER BY u.last_authenticated_at DESC NULLS LAST`,
      [request.environment!.workspaceId, search],
    );
    response.json({ data: users, meta: { total: users.length } });
  }),
);

dashboardRouter.post(
  "/users",
  asyncRoute(async (request, response) => {
    const input = z
      .object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(12),
        groups: z.array(z.string()).default([]),
      })
      .parse(request.body);
    const environment = request.environment!;
    const user = await transaction(async (client) => {
      const created = await client.query<IdentityUserLifecycleRow>(
        `INSERT INTO identity_users(workspace_id, email, name, password_hash, email_verified_at, groups)
         VALUES ($1, lower($2), $3, $4, now(), $5)
         RETURNING id, email, name, groups, status, email_verified_at`,
        [
          environment.workspaceId,
          input.email,
          input.name,
          await hash(input.password, 12),
          input.groups,
        ],
      );
      const createdUser = created.rows[0];
      if (!createdUser) throw new Error("User was not created.");
      await client.query(
        `INSERT INTO audit_events
          (workspace_id, environment_id, category, severity, event_type, summary, actor_type,
           actor_id, actor_name, resource_type, resource_id, changes)
         SELECT $1, e.id, 'user', 'info', 'user.created', $2, 'admin', $3, $4, 'user', $5, $6
         FROM environments e
         WHERE e.workspace_id = $1 AND
           (e.id = $7 OR EXISTS (
             SELECT 1 FROM webhooks w
             WHERE w.environment_id = e.id AND w.purpose = 'provisioning' AND w.status = 'enabled'
           ))`,
        [
          environment.workspaceId,
          `${createdUser.email} created`,
          request.admin!.userId,
          request.admin!.email,
          createdUser.id,
          userLifecycleData(createdUser),
          environment.id,
        ],
      );
      return createdUser;
    });
    response.status(201).json({ id: user.id });
  }),
);

dashboardRouter.get(
  "/users/:userId",
  asyncRoute(async (request, response) => {
    const [user] = await query(
      `SELECT id, workspace_id, email, name, email_verified_at, status, groups, custom_claims,
              mfa_enabled, last_authenticated_at, created_at, updated_at,
              (password_hash IS NOT NULL) AS password_enabled
       FROM identity_users WHERE id = $1 AND workspace_id = $2`,
      [request.params.userId, request.environment!.workspaceId],
    );
    if (!user) throw new ApiError(404, "user_not_found", "The user was not found.");
    const [sessions, socialConnections, assignments, availableApplications] = await Promise.all([
      query(
        `SELECT s.*, a.name AS application_name FROM user_sessions s
         LEFT JOIN oauth_applications a ON a.id = s.application_id WHERE s.user_id = $1 ORDER BY s.last_active_at DESC`,
        [request.params.userId],
      ),
      query(
        `SELECT provider, provider_email, created_at FROM social_identities
         WHERE user_id = $1 ORDER BY provider`,
        [request.params.userId],
      ),
      query(
        `SELECT ua.application_id, ua.assigned_at, ua.last_launched_at, a.name, a.slug,
                EXISTS (
                  SELECT 1 FROM webhooks w WHERE w.environment_id = a.environment_id
                    AND w.purpose = 'provisioning' AND w.status = 'enabled'
                ) AS provisioning_enabled
         FROM user_application_assignments ua
         JOIN oauth_applications a ON a.id = ua.application_id
         WHERE ua.user_id = $1 AND ua.environment_id = $2 ORDER BY a.name`,
        [request.params.userId, request.environment!.id],
      ),
      query(
        `SELECT a.id, a.name, a.slug, a.portal_enabled, a.launch_uri,
                EXISTS (
                  SELECT 1 FROM webhooks w WHERE w.environment_id = a.environment_id
                    AND w.purpose = 'provisioning' AND w.status = 'enabled'
                ) AS provisioning_enabled
         FROM oauth_applications a
         WHERE a.environment_id = $1 AND a.status = 'active' AND a.client_id_source <> 'dynamic'
           AND a.portal_enabled = true AND a.launch_uri IS NOT NULL
         ORDER BY a.name`,
        [request.environment!.id],
      ),
    ]);
    response.json({
      ...user,
      sessions,
      social_connections: socialConnections,
      application_assignments: assignments,
      available_applications: availableApplications,
    });
  }),
);

dashboardRouter.put(
  "/users/:userId/applications/:applicationId",
  asyncRoute(async (request, response) => {
    const environment = request.environment!;
    const [assignment] = await query(
      `INSERT INTO user_application_assignments
        (workspace_id, environment_id, application_id, user_id, assigned_by)
       SELECT $1,$2,a.id,u.id,$5
       FROM oauth_applications a
       JOIN identity_users u ON u.id = $3 AND u.workspace_id = $1
       WHERE a.id = $4 AND a.environment_id = $2 AND a.portal_enabled = true
         AND a.status = 'active' AND a.launch_uri IS NOT NULL
       ON CONFLICT (environment_id, application_id, user_id)
       DO UPDATE SET assigned_by = EXCLUDED.assigned_by, assigned_at = now()
       RETURNING *`,
      [
        environment.workspaceId,
        environment.id,
        request.params.userId,
        request.params.applicationId,
        request.admin!.userId,
      ],
    );
    if (!assignment) {
      throw new ApiError(
        404,
        "portal_assignment_target_not_found",
        "The user or portal-enabled application was not found.",
      );
    }
    response.json(assignment);
  }),
);

dashboardRouter.delete(
  "/users/:userId/applications/:applicationId",
  asyncRoute(async (request, response) => {
    await query(
      `DELETE FROM user_application_assignments
       WHERE user_id = $1 AND application_id = $2 AND environment_id = $3`,
      [request.params.userId, request.params.applicationId, request.environment!.id],
    );
    response.status(204).end();
  }),
);

dashboardRouter.delete(
  "/users/:userId",
  asyncRoute(async (request, response) => {
    const environment = request.environment!;
    await transaction(async (client) => {
      const result = await client.query<IdentityUserLifecycleRow>(
        `SELECT id, email, name, groups, status, email_verified_at
         FROM identity_users WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
        [request.params.userId, environment.workspaceId],
      );
      const user = result.rows[0];
      if (!user) throw new ApiError(404, "user_not_found", "The user was not found.");
      await client.query(
        `INSERT INTO audit_events
          (workspace_id, environment_id, category, severity, event_type, summary, actor_type,
           actor_id, actor_name, resource_type, resource_id, changes)
         SELECT $1, e.id, 'user', 'warning', 'user.deleted', $2, 'admin', $3, $4, 'user', $5, $6
         FROM environments e
         WHERE e.workspace_id = $1 AND
           (e.id = $7 OR EXISTS (
             SELECT 1 FROM webhooks w
             WHERE w.environment_id = e.id AND w.purpose = 'provisioning' AND w.status = 'enabled'
           ))`,
        [
          environment.workspaceId,
          `${user.email} deleted`,
          request.admin!.userId,
          request.admin!.email,
          user.id,
          userLifecycleData(user),
          environment.id,
        ],
      );
      await client.query("DELETE FROM identity_users WHERE id = $1", [user.id]);
    });
    response.status(204).end();
  }),
);

dashboardRouter.get(
  "/sessions",
  asyncRoute(async (request, response) => {
    const sessions = await query(
      `SELECT s.*, u.email, u.name AS user_name, a.name AS application_name
       FROM user_sessions s JOIN identity_users u ON u.id = s.user_id
       LEFT JOIN oauth_applications a ON a.id = s.application_id
       WHERE s.environment_id = $1 ORDER BY s.last_active_at DESC`,
      [request.environment!.id],
    );
    response.json({ data: sessions, meta: { total: sessions.length } });
  }),
);

dashboardRouter.post(
  "/sessions/:sessionId/revoke",
  asyncRoute(async (request, response) => {
    await transaction(async (client) => {
      const result = await client.query<{ refresh_family_id: string | null }>(
        `UPDATE user_sessions SET status = 'revoked', revoked_at = now()
         WHERE id = $1 AND environment_id = $2 RETURNING refresh_family_id`,
        [request.params.sessionId, request.environment!.id],
      );
      const family = result.rows[0]?.refresh_family_id;
      if (family) {
        await client.query(
          "UPDATE refresh_token_families SET status = 'revoked', revoked_reason = 'session_revoked' WHERE id = $1",
          [family],
        );
        await client.query("UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1", [
          family,
        ]);
      }
    });
    response.status(204).end();
  }),
);

dashboardRouter.get(
  "/scopes",
  asyncRoute(async (request, response) => {
    const scopes = await query(
      `SELECT s.*, (SELECT count(*)::integer FROM oauth_applications a
         WHERE a.environment_id = s.environment_id AND a.client_id_source <> 'dynamic'
           AND s.name = ANY(a.allowed_scopes)) AS application_count
       FROM resource_scopes s WHERE s.environment_id = $1 ORDER BY s.is_system DESC, s.name`,
      [request.environment!.id],
    );
    response.json({ data: scopes });
  }),
);

dashboardRouter.post(
  "/scopes",
  asyncRoute(async (request, response) => {
    if (!["owner", "admin", "developer"].includes(request.admin!.role)) {
      throw new ApiError(
        403,
        "insufficient_role",
        "Developer, admin, or owner access is required.",
      );
    }
    const input = z
      .object({
        name: scopeNameSchema,
        displayName: z.string().trim().min(2).max(100),
        description: z.string().trim().min(2).max(500),
        consentDescription: z.string().trim().min(2).max(200),
        sensitivity: z.enum(["standard", "sensitive", "restricted"]).default("standard"),
      })
      .parse(request.body);
    const environment = request.environment!;
    const [scope] = await query(
      `INSERT INTO resource_scopes
        (workspace_id, environment_id, name, display_name, description, consent_description, sensitivity)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        environment.workspaceId,
        environment.id,
        input.name,
        input.displayName,
        input.description,
        input.consentDescription,
        input.sensitivity,
      ],
    );
    response.status(201).json(scope);
  }),
);

dashboardRouter.patch(
  "/scopes/:scopeId",
  asyncRoute(async (request, response) => {
    const input = z
      .object({
        displayName: z.string().trim().min(2).max(100).optional(),
        description: z.string().trim().min(2).max(500).optional(),
        consentDescription: z.string().trim().min(2).max(200).optional(),
        sensitivity: z.enum(["standard", "sensitive", "restricted"]).optional(),
        version: z.number().int().positive(),
      })
      .parse(request.body);
    const [scope] = await query(
      `UPDATE resource_scopes SET display_name = COALESCE($3, display_name),
         description = COALESCE($4, description), consent_description = COALESCE($5, consent_description),
         sensitivity = COALESCE($6, sensitivity), version = version + 1, updated_at = now()
       WHERE id = $1 AND environment_id = $2 AND version = $7 AND ownership = 'dashboard' AND is_system = false
       RETURNING *`,
      [
        request.params.scopeId,
        request.environment!.id,
        input.displayName ?? null,
        input.description ?? null,
        input.consentDescription ?? null,
        input.sensitivity ?? null,
        input.version,
      ],
    );
    if (!scope)
      throw new ApiError(
        409,
        "scope_not_editable",
        "The scope changed, is system-defined, or is managed by a manifest.",
      );
    response.json(scope);
  }),
);

dashboardRouter.get(
  "/policies",
  asyncRoute(async (request, response) => {
    response.json({
      data: await query(
        "SELECT * FROM authorization_policies WHERE environment_id = $1 ORDER BY display_name",
        [request.environment!.id],
      ),
    });
  }),
);

const policyInputSchema = z.object({
  name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName: z.string().trim().min(2).max(100),
  description: z.string().max(500).default(""),
  enabled: z.boolean().default(true),
  applicationIds: z.array(z.string().uuid()).default([]),
  conditions: z.object({
    all: z
      .array(
        z.object({
          field: z.string().min(1),
          operator: z.enum(["equals", "not_equals", "contains", "in"]),
          value: z.union([z.string(), z.array(z.string()), z.boolean(), z.number()]),
        }),
      )
      .min(1),
  }),
  otherwise: z.object({
    deny: z.object({ code: z.string().min(1), message: z.string().min(1).max(300) }),
  }),
});

dashboardRouter.post(
  "/policies",
  asyncRoute(async (request, response) => {
    const input = policyInputSchema.parse(request.body);
    const environment = request.environment!;
    const [policy] = await query(
      `INSERT INTO authorization_policies
        (workspace_id, environment_id, name, display_name, description, enabled, conditions, decision, application_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        environment.workspaceId,
        environment.id,
        input.name,
        input.displayName,
        input.description,
        input.enabled,
        input.conditions,
        { allow: true, otherwise: input.otherwise },
        input.applicationIds,
      ],
    );
    response.status(201).json(policy);
  }),
);

dashboardRouter.get(
  "/policies/:policyId",
  asyncRoute(async (request, response) => {
    const [policy] = await query(
      "SELECT * FROM authorization_policies WHERE id = $1 AND environment_id = $2",
      [request.params.policyId, request.environment!.id],
    );
    if (!policy) throw new ApiError(404, "policy_not_found", "The policy was not found.");
    response.json(policy);
  }),
);

dashboardRouter.patch(
  "/policies/:policyId",
  asyncRoute(async (request, response) => {
    const input = policyInputSchema
      .omit({ name: true })
      .partial()
      .extend({ version: z.number().int().positive() })
      .parse(request.body);
    const [policy] = await query(
      `UPDATE authorization_policies SET display_name = COALESCE($3, display_name),
         description = COALESCE($4, description), enabled = COALESCE($5, enabled),
         conditions = COALESCE($6, conditions),
         decision = CASE WHEN $7::jsonb IS NULL THEN decision ELSE jsonb_build_object('allow', true, 'otherwise', $7::jsonb) END,
         application_ids = COALESCE($8, application_ids), version = version + 1, updated_at = now()
       WHERE id = $1 AND environment_id = $2 AND version = $9 AND ownership = 'dashboard' RETURNING *`,
      [
        request.params.policyId,
        request.environment!.id,
        input.displayName ?? null,
        input.description ?? null,
        input.enabled ?? null,
        input.conditions ?? null,
        input.otherwise ?? null,
        input.applicationIds ?? null,
        input.version,
      ],
    );
    if (!policy)
      throw new ApiError(
        409,
        "policy_not_editable",
        "The policy changed or is managed by a manifest.",
      );
    response.json(policy);
  }),
);

dashboardRouter.get(
  "/events",
  asyncRoute(async (request, response) => {
    const category = String(request.query.category ?? "");
    const events = await query(
      `SELECT * FROM audit_events WHERE workspace_id = $1
       AND (environment_id = $2 OR environment_id IS NULL) AND ($3 = '' OR category = $3)
       ORDER BY created_at DESC LIMIT 100`,
      [request.environment!.workspaceId, request.environment!.id, category],
    );
    response.json({ data: events, meta: { total: events.length } });
  }),
);

dashboardRouter.get(
  "/environments",
  asyncRoute(async (request, response) => {
    response.json({
      data: await query(
        "SELECT id, slug, name, kind, issuer, is_default FROM environments WHERE workspace_id = $1 ORDER BY is_default DESC, name",
        [request.environment!.workspaceId],
      ),
    });
  }),
);

dashboardRouter.get(
  "/search",
  asyncRoute(async (request, response) => {
    const q = String(request.query.q ?? "");
    const [applications, traces] = await Promise.all([
      query(
        `SELECT id, name, slug, 'application' AS type FROM oauth_applications
         WHERE environment_id = $1 AND client_id_source <> 'dynamic'
           AND (name ILIKE '%' || $2 || '%' OR slug ILIKE '%' || $2 || '%') LIMIT 6`,
        [request.environment!.id, q],
      ),
      query(
        `SELECT id, request_id AS name, event_type AS slug, 'trace' AS type FROM authorization_traces
         WHERE environment_id = $1 AND (request_id ILIKE '%' || $2 || '%' OR application_name ILIKE '%' || $2 || '%') LIMIT 6`,
        [request.environment!.id, q],
      ),
    ]);
    response.json({ data: [...applications, ...traces] });
  }),
);

dashboardRouter.post("/applications/slug", (request, response) => {
  const { name } = z.object({ name: z.string().default("") }).parse(request.body);
  response.json({ slug: createApplicationSlug(name) });
});
