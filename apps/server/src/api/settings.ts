import { resolveTxt } from "node:dns/promises";
import { hash } from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { env } from "../env.js";
import { query, transaction } from "../db.js";
import { encrypt, hashToken, randomId, randomToken } from "../lib/crypto.js";
import { emailEnabled, sendEmail } from "../lib/email.js";
import { ApiError, asyncRoute } from "../lib/http.js";
import { createSigningKey } from "../lib/signing.js";
import { validateOutboundUrl } from "../lib/security.js";
import {
  createProvisioningEventBody,
  type IdentityUserLifecycleRow,
  userLifecycleEvents,
} from "../lib/user-lifecycle.js";
import { auditMutation, requireEnvironment } from "./context.js";

export const settingsRouter = Router();
settingsRouter.use(requireEnvironment);
settingsRouter.use(auditMutation);

function requireRole(role: string | undefined, roles: string[]): void {
  if (!role || !roles.includes(role)) {
    throw new ApiError(
      403,
      "insufficient_role",
      "Your workspace role does not allow this operation.",
    );
  }
}

settingsRouter.get(
  "/settings/general",
  asyncRoute(async (request, response) => {
    const [settings] = await query(
      `SELECT w.id, w.slug, w.name, s.session_lifetime_seconds, s.trace_retention_days,
              s.audit_retention_days, e.id AS environment_id, e.name AS environment_name,
              e.slug AS environment_slug, e.kind, e.issuer
       FROM workspaces w JOIN environments e ON e.workspace_id = w.id
       LEFT JOIN workspace_settings s ON s.workspace_id = w.id
       WHERE w.id = $1 AND e.id = $2`,
      [request.environment!.workspaceId, request.environment!.id],
    );
    response.json(settings);
  }),
);

settingsRouter.patch(
  "/settings/general",
  asyncRoute(async (request, response) => {
    requireRole(request.admin?.role, ["owner", "admin"]);
    const input = z
      .object({
        workspaceName: z.string().trim().min(2).max(100).optional(),
        environmentName: z.string().trim().min(2).max(100).optional(),
        sessionLifetimeSeconds: z.number().int().min(300).max(31_536_000).optional(),
        traceRetentionDays: z.number().int().min(1).max(365).optional(),
        auditRetentionDays: z.number().int().min(30).max(2555).optional(),
      })
      .parse(request.body);
    const environment = request.environment!;
    await transaction(async (client) => {
      if (input.workspaceName) {
        await client.query("UPDATE workspaces SET name = $2, updated_at = now() WHERE id = $1", [
          environment.workspaceId,
          input.workspaceName,
        ]);
      }
      if (input.environmentName) {
        await client.query("UPDATE environments SET name = $2, updated_at = now() WHERE id = $1", [
          environment.id,
          input.environmentName,
        ]);
      }
      await client.query(
        `INSERT INTO workspace_settings(workspace_id, display_name)
         SELECT id, name FROM workspaces WHERE id = $1 ON CONFLICT (workspace_id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           session_lifetime_seconds = COALESCE($2, workspace_settings.session_lifetime_seconds),
           trace_retention_days = COALESCE($3, workspace_settings.trace_retention_days),
           audit_retention_days = COALESCE($4, workspace_settings.audit_retention_days), updated_at = now()`,
        [
          environment.workspaceId,
          input.sessionLifetimeSeconds ?? null,
          input.traceRetentionDays ?? null,
          input.auditRetentionDays ?? null,
        ],
      );
    });
    response.status(204).end();
  }),
);

settingsRouter.get(
  "/settings/providers",
  asyncRoute(async (_request, response) => {
    response.json({
      local: { enabled: true },
      google: {
        enabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        callbackUrl: `${env.PUBLIC_ORIGIN}/api/v1/authorize/social/google/callback`,
      },
      github: {
        enabled: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
        callbackUrl: `${env.PUBLIC_ORIGIN}/api/v1/authorize/social/github/callback`,
      },
      smtp: {
        enabled: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD),
        sender: env.SMTP_FROM,
      },
    });
  }),
);

settingsRouter.get(
  "/settings/domains",
  asyncRoute(async (request, response) => {
    const domains = await query(
      `SELECT id, hostname, status, is_primary, verified_at, created_at FROM domains
       WHERE environment_id = $1 ORDER BY is_primary DESC, created_at`,
      [request.environment!.id],
    );
    response.json({ data: domains });
  }),
);

settingsRouter.post(
  "/settings/domains",
  asyncRoute(async (request, response) => {
    requireRole(request.admin?.role, ["owner", "admin"]);
    const input = z
      .object({
        hostname: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/),
      })
      .parse(request.body);
    const verificationToken = randomId("amt_domain", 24);
    const [domain] = await query<{ id: string }>(
      `INSERT INTO domains(workspace_id, environment_id, hostname, status, verification_token_hash)
       VALUES ($1,$2,$3,'pending',$4) RETURNING id`,
      [
        request.environment!.workspaceId,
        request.environment!.id,
        input.hostname,
        hashToken(verificationToken),
      ],
    );
    response.status(201).json({
      id: domain?.id,
      hostname: input.hostname,
      verification: {
        type: "TXT",
        name: `_authometry.${input.hostname}`,
        value: verificationToken,
      },
    });
  }),
);

settingsRouter.post(
  "/settings/domains/:domainId/verify",
  asyncRoute(async (request, response) => {
    requireRole(request.admin?.role, ["owner", "admin"]);
    const [domain] = await query<{ id: string; hostname: string; verification_token_hash: string }>(
      "SELECT id, hostname, verification_token_hash FROM domains WHERE id = $1 AND environment_id = $2",
      [request.params.domainId, request.environment!.id],
    );
    if (!domain) throw new ApiError(404, "domain_not_found", "The domain was not found.");
    let records: string[][];
    try {
      records = await resolveTxt(`_authometry.${domain.hostname}`);
    } catch {
      throw new ApiError(
        409,
        "dns_record_not_found",
        "The verification TXT record is not visible yet.",
      );
    }
    if (!records.some((record) => hashToken(record.join("")) === domain.verification_token_hash)) {
      throw new ApiError(409, "dns_record_mismatch", "The verification TXT record does not match.");
    }
    await query("UPDATE domains SET status = 'verified', verified_at = now() WHERE id = $1", [
      domain.id,
    ]);
    response.json({ status: "verified" });
  }),
);

settingsRouter.get(
  "/settings/signing-keys",
  asyncRoute(async (request, response) => {
    response.json({
      data: await query(
        `SELECT id, kid, algorithm, status, activates_at, retires_at, created_at FROM signing_keys
         WHERE environment_id = $1 ORDER BY created_at DESC`,
        [request.environment!.id],
      ),
    });
  }),
);

settingsRouter.post(
  "/settings/signing-keys/rotate",
  asyncRoute(async (request, response) => {
    requireRole(request.admin?.role, ["owner", "admin"]);
    const environment = request.environment!;
    await transaction(async (client) => {
      await client.query(
        "UPDATE signing_keys SET status = 'retiring', retires_at = now() + interval '7 days' WHERE environment_id = $1 AND status = 'active'",
        [environment.id],
      );
      await createSigningKey(client, environment.workspaceId, environment.id);
      await client.query(
        "UPDATE signing_keys SET status = 'retired' WHERE environment_id = $1 AND status = 'retiring' AND retires_at <= now()",
        [environment.id],
      );
    });
    response.status(201).json({ rotated: true });
  }),
);

settingsRouter.get(
  "/settings/webhooks",
  asyncRoute(async (request, response) => {
    response.json({
      data: await query(
        `SELECT id, name, url, secret_prefix, subscribed_events, status, created_at, updated_at
         FROM webhooks WHERE environment_id = $1 AND purpose = 'events'
         ORDER BY created_at DESC`,
        [request.environment!.id],
      ),
    });
  }),
);

settingsRouter.post(
  "/settings/webhooks",
  asyncRoute(async (request, response) => {
    requireRole(request.admin?.role, ["owner", "admin", "developer"]);
    const input = z
      .object({
        name: z.string().trim().min(2).max(100),
        url: z.string().url(),
        subscribedEvents: z.array(z.string().min(1)).min(1).max(30),
      })
      .parse(request.body);
    let url: URL;
    try {
      url = validateOutboundUrl(input.url);
    } catch (error) {
      throw new ApiError(
        422,
        "unsafe_webhook_url",
        error instanceof Error ? error.message : "The webhook URL is not allowed.",
      );
    }
    const secret = randomId("amt_webhook", 32);
    const [webhook] = await query<{ id: string }>(
      `INSERT INTO webhooks
        (workspace_id, environment_id, name, url, secret_hash, encrypted_secret, secret_prefix,
         subscribed_events, status, purpose)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'enabled','events') RETURNING id`,
      [
        request.environment!.workspaceId,
        request.environment!.id,
        input.name,
        url.toString(),
        hashToken(secret),
        encrypt(secret),
        secret.slice(0, 18),
        input.subscribedEvents,
      ],
    );
    response.status(201).json({ id: webhook?.id, secret });
  }),
);

settingsRouter.get(
  "/settings/provisioning",
  asyncRoute(async (request, response) => {
    response.json({
      data: await query(
        `SELECT id, name, url, secret_prefix, status, created_at, updated_at,
                (SELECT count(*)::integer FROM webhook_deliveries d
                 WHERE d.webhook_id = w.id AND d.status = 'failed') AS failed_deliveries,
                (SELECT max(created_at) FROM webhook_deliveries d
                 WHERE d.webhook_id = w.id AND d.status = 'succeeded') AS last_delivered_at
         FROM webhooks w
         WHERE environment_id = $1 AND purpose = 'provisioning'
         ORDER BY created_at DESC`,
        [request.environment!.id],
      ),
    });
  }),
);

settingsRouter.post(
  "/settings/provisioning",
  asyncRoute(async (request, response) => {
    requireRole(request.admin?.role, ["owner", "admin", "developer"]);
    const input = z
      .object({
        name: z.string().trim().min(2).max(100),
        url: z.string().url(),
        syncExistingUsers: z.boolean().default(true),
      })
      .parse(request.body);
    let url: URL;
    try {
      url = validateOutboundUrl(input.url);
    } catch (error) {
      throw new ApiError(
        422,
        "unsafe_provisioning_url",
        error instanceof Error ? error.message : "The provisioning URL is not allowed.",
      );
    }
    const environment = request.environment!;
    const secret = randomId("amt_provision", 32);
    const result = await transaction(async (client) => {
      const created = await client.query<{ id: string }>(
        `INSERT INTO webhooks
          (workspace_id, environment_id, name, url, secret_hash, encrypted_secret, secret_prefix,
           subscribed_events, status, purpose)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'enabled','provisioning') RETURNING id`,
        [
          environment.workspaceId,
          environment.id,
          input.name,
          url.toString(),
          hashToken(secret),
          encrypt(secret),
          secret.slice(0, 18),
          [...userLifecycleEvents],
        ],
      );
      const connectionId = created.rows[0]?.id;
      if (!connectionId) throw new Error("Provisioning connection was not created.");
      let queued = 0;
      if (input.syncExistingUsers) {
        const users = await client.query<IdentityUserLifecycleRow>(
          `SELECT id, email, name, groups, status, email_verified_at
           FROM identity_users WHERE workspace_id = $1 ORDER BY created_at`,
          [environment.workspaceId],
        );
        for (const user of users.rows) {
          await client.query(
            `INSERT INTO webhook_deliveries
              (webhook_id, event_type, status, redacted_request_body)
             VALUES ($1, 'user.created', 'pending', $2)`,
            [connectionId, createProvisioningEventBody("user.created", user)],
          );
        }
        queued = users.rowCount ?? users.rows.length;
      }
      return { id: connectionId, queued };
    });
    response.status(201).json({ ...result, secret });
  }),
);

settingsRouter.post(
  "/settings/provisioning/:connectionId/sync",
  asyncRoute(async (request, response) => {
    requireRole(request.admin?.role, ["owner", "admin", "developer"]);
    const environment = request.environment!;
    const queued = await transaction(async (client) => {
      const connection = await client.query<{ id: string }>(
        `SELECT id FROM webhooks
         WHERE id = $1 AND environment_id = $2 AND purpose = 'provisioning' FOR UPDATE`,
        [request.params.connectionId, environment.id],
      );
      if (!connection.rows[0]) {
        throw new ApiError(
          404,
          "provisioning_connection_not_found",
          "The provisioning connection was not found.",
        );
      }
      const users = await client.query<IdentityUserLifecycleRow>(
        `SELECT id, email, name, groups, status, email_verified_at
         FROM identity_users WHERE workspace_id = $1 ORDER BY created_at`,
        [environment.workspaceId],
      );
      for (const user of users.rows) {
        await client.query(
          `INSERT INTO webhook_deliveries
            (webhook_id, event_type, status, redacted_request_body)
           VALUES ($1, 'user.created', 'pending', $2)`,
          [connection.rows[0].id, createProvisioningEventBody("user.created", user)],
        );
      }
      return users.rowCount ?? users.rows.length;
    });
    response.status(202).json({ queued });
  }),
);

settingsRouter.delete(
  "/settings/provisioning/:connectionId",
  asyncRoute(async (request, response) => {
    requireRole(request.admin?.role, ["owner", "admin", "developer"]);
    const result = await query(
      `DELETE FROM webhooks
       WHERE id = $1 AND environment_id = $2 AND purpose = 'provisioning'
       RETURNING id`,
      [request.params.connectionId, request.environment!.id],
    );
    if (!result[0]) {
      throw new ApiError(
        404,
        "provisioning_connection_not_found",
        "The provisioning connection was not found.",
      );
    }
    response.status(204).end();
  }),
);

settingsRouter.get(
  "/settings/members",
  asyncRoute(async (request, response) => {
    response.json({
      data: await query(
        `SELECT u.id, u.email, u.name, m.role, m.created_at, u.disabled_at
         FROM workspace_memberships m JOIN admin_users u ON u.id = m.admin_user_id
         WHERE m.workspace_id = $1 ORDER BY u.name`,
        [request.environment!.workspaceId],
      ),
    });
  }),
);

settingsRouter.post(
  "/settings/members",
  asyncRoute(async (request, response) => {
    requireRole(request.admin?.role, ["owner", "admin"]);
    const input = z
      .object({
        email: z.string().trim().toLowerCase().email(),
        name: z.string().trim().min(2).max(100),
        role: z.enum(["admin", "developer", "auditor", "viewer"]),
      })
      .parse(request.body);
    const [existing] = await query<{ id: string }>(
      "SELECT id FROM admin_users WHERE lower(email) = $1",
      [input.email],
    );
    if (!existing && !emailEnabled()) {
      throw new ApiError(
        409,
        "email_disabled",
        "Configure Resend or SMTP before inviting a new workspace member.",
      );
    }
    const invitation = randomToken(40);
    const result = await transaction(async (client) => {
      let userId = existing?.id;
      if (!userId) {
        const user = await client.query<{ id: string }>(
          "INSERT INTO admin_users(email, name, password_hash) VALUES ($1,$2,$3) RETURNING id",
          [input.email, input.name, await hash(randomToken(32), 12)],
        );
        userId = user.rows[0]?.id;
      }
      if (!userId) throw new Error("The invited member was not created.");
      await client.query(
        `INSERT INTO workspace_memberships(workspace_id, admin_user_id, role) VALUES ($1,$2,$3)
         ON CONFLICT (workspace_id, admin_user_id) DO UPDATE SET role = EXCLUDED.role`,
        [request.environment!.workspaceId, userId, input.role],
      );
      if (!existing) {
        await client.query(
          `INSERT INTO one_time_tokens(workspace_id, user_id, purpose, token_hash, expires_at)
           VALUES ($1,$2,'account_link',$3,now() + interval '24 hours')`,
          [request.environment!.workspaceId, userId, hashToken(invitation)],
        );
      }
      return { id: userId, invited: !existing };
    });
    if (result.invited) {
      const acceptUrl = `${env.PUBLIC_ORIGIN}/accept-invite?token=${encodeURIComponent(invitation)}`;
      await sendEmail({
        to: input.email,
        subject: "You were invited to Authometry",
        text: `Accept your Authometry workspace invitation: ${acceptUrl}\n\nThis link expires in 24 hours.`,
        html: `<p>You were invited to an Authometry workspace.</p><p><a href="${acceptUrl}">Accept invitation</a></p><p>This link expires in 24 hours.</p>`,
      });
    }
    response.status(201).json(result);
  }),
);

settingsRouter.patch(
  "/settings/members/:memberId",
  asyncRoute(async (request, response) => {
    requireRole(request.admin?.role, ["owner"]);
    const input = z
      .object({ role: z.enum(["owner", "admin", "developer", "auditor", "viewer"]) })
      .parse(request.body);
    if (request.params.memberId === request.admin!.userId && input.role !== "owner") {
      throw new ApiError(
        409,
        "cannot_demote_self",
        "Transfer ownership before changing your own owner role.",
      );
    }
    const [membership] = await query(
      `UPDATE workspace_memberships SET role = $3
       WHERE workspace_id = $1 AND admin_user_id = $2 RETURNING role`,
      [request.environment!.workspaceId, request.params.memberId, input.role],
    );
    if (!membership)
      throw new ApiError(404, "member_not_found", "The workspace member was not found.");
    response.json(membership);
  }),
);

settingsRouter.get(
  "/settings/tokens",
  asyncRoute(async (request, response) => {
    response.json({
      data: await query(
        `SELECT id, name, prefix, scopes, last_used_at, expires_at, created_at FROM personal_access_tokens
         WHERE workspace_id = $1 AND admin_user_id = $2 AND revoked_at IS NULL ORDER BY created_at DESC`,
        [request.environment!.workspaceId, request.admin!.userId],
      ),
    });
  }),
);

settingsRouter.post(
  "/settings/tokens",
  asyncRoute(async (request, response) => {
    const input = z
      .object({
        name: z.string().trim().min(2).max(100),
        scopes: z.array(z.string().min(1)).min(1).max(30),
        expiresInDays: z.number().int().min(1).max(365).nullable().default(90),
      })
      .parse(request.body);
    const token = randomId("amt", 36);
    const [record] = await query<{ id: string }>(
      `INSERT INTO personal_access_tokens
        (workspace_id, admin_user_id, name, prefix, token_hash, scopes, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $7::integer IS NULL THEN NULL ELSE now() + ($7 * interval '1 day') END)
       RETURNING id`,
      [
        request.environment!.workspaceId,
        request.admin!.userId,
        input.name,
        token.slice(0, 16),
        hashToken(token),
        input.scopes,
        input.expiresInDays,
      ],
    );
    response.status(201).json({ id: record?.id, token });
  }),
);

settingsRouter.post(
  "/settings/tokens/:tokenId/revoke",
  asyncRoute(async (request, response) => {
    await query(
      `UPDATE personal_access_tokens SET revoked_at = now()
       WHERE id = $1 AND workspace_id = $2 AND admin_user_id = $3`,
      [request.params.tokenId, request.environment!.workspaceId, request.admin!.userId],
    );
    response.status(204).end();
  }),
);

settingsRouter.get(
  "/settings/danger",
  asyncRoute(async (request, response) => {
    const [result] = await query(
      `SELECT w.name AS workspace_name, e.status AS environment_status
       FROM workspaces w JOIN environments e ON e.workspace_id = w.id WHERE w.id = $1 AND e.id = $2`,
      [request.environment!.workspaceId, request.environment!.id],
    );
    response.json(result);
  }),
);

settingsRouter.post(
  "/settings/danger/status",
  asyncRoute(async (request, response) => {
    requireRole(request.admin?.role, ["owner"]);
    const input = z.object({ status: z.enum(["active", "disabled"]) }).parse(request.body);
    await query("UPDATE environments SET status = $2, updated_at = now() WHERE id = $1", [
      request.environment!.id,
      input.status,
    ]);
    response.json({ status: input.status });
  }),
);

settingsRouter.delete(
  "/settings/danger/workspace",
  asyncRoute(async (request, response) => {
    requireRole(request.admin?.role, ["owner"]);
    const input = z.object({ confirmation: z.string() }).parse(request.body);
    const [workspace] = await query<{ name: string }>("SELECT name FROM workspaces WHERE id = $1", [
      request.environment!.workspaceId,
    ]);
    if (!workspace || input.confirmation !== workspace.name) {
      throw new ApiError(
        409,
        "confirmation_mismatch",
        "Type the workspace name exactly to confirm deletion.",
      );
    }
    await query("DELETE FROM workspaces WHERE id = $1", [request.environment!.workspaceId]);
    response.status(204).end();
  }),
);
