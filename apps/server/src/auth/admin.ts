import { compare, hash } from "bcryptjs";
import { createHmac } from "node:crypto";
import { Router, type Request, type Response } from "express";
import type { PoolClient } from "pg";
import { z } from "zod";
import { slugSchema } from "@authometry/domain";
import { env } from "../env.js";
import { pool, query, transaction } from "../db.js";
import { createSigningKey } from "../lib/signing.js";
import { constantTimeEqual, hashToken, randomToken } from "../lib/crypto.js";
import { ApiError, asyncRoute } from "../lib/http.js";
import { sendEmail } from "../lib/email.js";
import {
  signAdminAccessToken,
  signAdminRefreshEnvelope,
  verifyAdminAccessToken,
  verifyAdminRefreshEnvelope,
} from "../lib/security.js";

const accessCookie = "authometry_admin_access";
const refreshCookie = "authometry_admin_refresh";
const csrfCookie = "authometry_csrf";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(12).max(128),
});

interface MemberRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  workspace_id: string;
  workspace_name: string;
  role: string;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

function createCsrfToken(): string {
  const nonce = randomToken(24);
  const signature = createHmac("sha256", env.CSRF_SECRET).update(nonce).digest("base64url");
  return `${nonce}.${signature}`;
}

function validCsrfToken(value: string): boolean {
  const [nonce, signature] = value.split(".");
  if (!nonce || !signature) return false;
  const expected = createHmac("sha256", env.CSRF_SECRET).update(nonce).digest("base64url");
  return constantTimeEqual(signature, expected);
}

async function createSession(
  response: Response,
  request: Request,
  user: { id: string; email: string; workspaceId: string; role: string },
  familyId: string = crypto.randomUUID(),
): Promise<void> {
  const rawRefreshToken = randomToken(48);
  const [session] = await query<{ id: string }>(
    `INSERT INTO admin_refresh_sessions
      (admin_user_id, workspace_id, token_hash, family_id, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, now() + interval '30 days') RETURNING id`,
    [
      user.id,
      user.workspaceId,
      hashToken(rawRefreshToken),
      familyId,
      request.get("user-agent") ?? null,
      request.ip,
    ],
  );
  if (!session) throw new ApiError(500, "session_error", "The session could not be created.");
  const [access, refresh] = await Promise.all([
    signAdminAccessToken({
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
      email: user.email,
    }),
    signAdminRefreshEnvelope(session.id, rawRefreshToken),
  ]);
  response.cookie(accessCookie, access, cookieOptions(10 * 60 * 1000));
  response.cookie(refreshCookie, refresh, cookieOptions(30 * 24 * 60 * 60 * 1000));
  response.cookie(csrfCookie, createCsrfToken(), csrfCookieOptions());
}

export async function requireAdmin(
  request: Request,
  _response: Response,
  next: (error?: unknown) => void,
) {
  try {
    const bearer = request.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (bearer?.startsWith("amt_")) {
      const [token] = await query<{
        admin_user_id: string;
        workspace_id: string;
        email: string;
        role: string;
        scopes: string[];
      }>(
        `SELECT p.admin_user_id, p.workspace_id, u.email, m.role, p.scopes
         FROM personal_access_tokens p
         JOIN admin_users u ON u.id = p.admin_user_id
         JOIN workspace_memberships m ON m.workspace_id = p.workspace_id AND m.admin_user_id = p.admin_user_id
         WHERE p.token_hash = $1 AND p.revoked_at IS NULL AND (p.expires_at IS NULL OR p.expires_at > now())`,
        [hashToken(bearer)],
      );
      if (!token)
        throw new ApiError(401, "invalid_token", "The access token is invalid or expired.");
      request.admin = {
        userId: token.admin_user_id,
        email: token.email,
        workspaceId: token.workspace_id,
        role: token.role,
        tokenScopes: token.scopes,
      };
      await query("UPDATE personal_access_tokens SET last_used_at = now() WHERE token_hash = $1", [
        hashToken(bearer),
      ]);
      next();
      return;
    }

    const access = request.cookies[accessCookie] as string | undefined;
    if (!access) throw new ApiError(401, "authentication_required", "Sign in to continue.");
    const claims = await verifyAdminAccessToken(access);
    if (!claims.sub) throw new ApiError(401, "invalid_session", "The session is invalid.");
    request.admin = {
      userId: claims.sub,
      email: claims.email,
      workspaceId: claims.workspaceId,
      role: claims.role,
    };
    next();
  } catch (error) {
    next(
      error instanceof ApiError
        ? error
        : new ApiError(401, "invalid_session", "The session is invalid or expired."),
    );
  }
}

export function requireCsrf(
  request: Request,
  _response: Response,
  next: (error?: unknown) => void,
): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
  if (request.get("authorization")?.startsWith("Bearer amt_")) return next();
  const cookie = request.cookies[csrfCookie] as string | undefined;
  const header = request.get("x-authometry-csrf");
  if (!cookie || !header || !constantTimeEqual(cookie, header) || !validCsrfToken(cookie)) {
    return next(new ApiError(403, "csrf_failed", "Refresh the page and try again."));
  }
  next();
}

export const adminAuthRouter = Router();

adminAuthRouter.get(
  "/bootstrap/status",
  asyncRoute(async (_request, response) => {
    const [result] = await query<{ count: string }>(
      "SELECT count(*)::text AS count FROM admin_users",
    );
    response.json({ bootstrapRequired: result?.count === "0" });
  }),
);

adminAuthRouter.post(
  "/bootstrap",
  asyncRoute(async (request, response) => {
    if (env.BOOTSTRAP_TOKEN_EXPIRES_AT && env.BOOTSTRAP_TOKEN_EXPIRES_AT <= new Date()) {
      throw new ApiError(410, "bootstrap_token_expired", "The bootstrap link has expired.");
    }
    if (!constantTimeEqual(String(request.get("x-bootstrap-token") ?? ""), env.BOOTSTRAP_TOKEN)) {
      throw new ApiError(
        403,
        "invalid_bootstrap_token",
        "The bootstrap link is invalid or expired.",
      );
    }
    const input = credentialsSchema
      .extend({
        name: z.string().trim().min(2).max(100),
        workspaceName: z.string().trim().min(2).max(100),
      })
      .parse(request.body);
    const passwordHash = await hash(input.password, 12);
    const created = await transaction(async (client) => {
      const existing = await client.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM admin_users",
      );
      if (existing.rows[0]?.count !== "0") {
        throw new ApiError(
          409,
          "already_bootstrapped",
          "This Authometry installation already has an owner.",
        );
      }
      const workspaceSlug = input.workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const user = await client.query<{ id: string }>(
        `INSERT INTO admin_users(email, name, password_hash, email_verified_at)
         VALUES ($1, $2, $3, now()) RETURNING id`,
        [input.email, input.name, passwordHash],
      );
      const workspace = await client.query<{ id: string }>(
        "INSERT INTO workspaces(slug, name) VALUES ($1, $2) RETURNING id",
        [workspaceSlug, input.workspaceName],
      );
      const userId = user.rows[0]?.id;
      const workspaceId = workspace.rows[0]?.id;
      if (!userId || !workspaceId) throw new Error("Bootstrap records were not created.");
      await client.query(
        "INSERT INTO workspace_memberships(workspace_id, admin_user_id, role) VALUES ($1, $2, 'owner')",
        [workspaceId, userId],
      );
      await client.query(
        "INSERT INTO workspace_settings(workspace_id, display_name) VALUES ($1, $2)",
        [workspaceId, input.workspaceName],
      );
      const environmentDefinitions = [
        ["development", "Development", "development", `${env.PUBLIC_ORIGIN}/development`, false],
        ["staging", "Staging", "staging", `${env.PUBLIC_ORIGIN}/staging`, false],
        ["production", "Production", "production", env.PUBLIC_ORIGIN, true],
      ] as const;
      for (const [slug, name, kind, issuer, isDefault] of environmentDefinitions) {
        const environment = await client.query<{ id: string }>(
          `INSERT INTO environments(workspace_id, slug, name, kind, issuer, is_default)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [workspaceId, slug, name, kind, issuer, isDefault],
        );
        const environmentId = environment.rows[0]?.id;
        if (!environmentId) throw new Error("Environment was not created.");
        await seedSystemScopes(client, workspaceId, environmentId);
        await createSigningKey(client, workspaceId, environmentId);
      }
      return { id: userId, email: input.email, workspaceId, role: "owner" };
    });
    await createSession(response, request, created);
    response
      .status(201)
      .json({ user: { id: created.id, email: created.email }, workspaceId: created.workspaceId });
  }),
);

adminAuthRouter.post(
  "/login",
  asyncRoute(async (request, response) => {
    const input = credentialsSchema.parse(request.body);
    const [member] = await query<MemberRow>(
      `SELECT u.id, u.email, u.name, u.password_hash, m.workspace_id, w.name AS workspace_name, m.role
       FROM admin_users u
       JOIN workspace_memberships m ON m.admin_user_id = u.id
       JOIN workspaces w ON w.id = m.workspace_id
       WHERE lower(u.email) = $1 AND u.disabled_at IS NULL
       ORDER BY w.created_at LIMIT 1`,
      [input.email],
    );
    if (!member || !(await compare(input.password, member.password_hash))) {
      throw new ApiError(401, "invalid_credentials", "The email or password is incorrect.");
    }
    await createSession(response, request, {
      id: member.id,
      email: member.email,
      workspaceId: member.workspace_id,
      role: member.role,
    });
    response.json({
      user: { id: member.id, email: member.email, name: member.name },
      workspace: { id: member.workspace_id, name: member.workspace_name },
      role: member.role,
    });
  }),
);

adminAuthRouter.post(
  "/forgot-password",
  asyncRoute(async (request, response) => {
    const input = z.object({ email: z.string().trim().toLowerCase().email() }).parse(request.body);
    const [user] = await query<{ id: string; workspace_id: string }>(
      `SELECT u.id, m.workspace_id FROM admin_users u
       JOIN workspace_memberships m ON m.admin_user_id = u.id
       WHERE lower(u.email) = $1 AND u.disabled_at IS NULL ORDER BY m.created_at LIMIT 1`,
      [input.email],
    );
    if (user) {
      const token = randomToken(40);
      await query(
        `INSERT INTO one_time_tokens(workspace_id, user_id, purpose, token_hash, expires_at)
         VALUES ($1,$2,'password_reset',$3,now() + interval '30 minutes')`,
        [user.workspace_id, user.id, hashToken(token)],
      );
      const resetUrl = `${env.PUBLIC_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`;
      await sendEmail({
        to: input.email,
        subject: "Reset your Authometry password",
        text: `Reset your Authometry password: ${resetUrl}\n\nThis link expires in 30 minutes and can be used once.`,
        html: `<p>Reset your Authometry password using the secure link below.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 30 minutes and can be used once.</p>`,
      });
    }
    response.status(202).json({ message: "If an account exists, a reset link has been sent." });
  }),
);

adminAuthRouter.post(
  "/reset-password",
  asyncRoute(async (request, response) => {
    const input = z
      .object({ token: z.string().min(32), password: z.string().min(12).max(128) })
      .parse(request.body);
    const passwordHash = await hash(input.password, 12);
    await transaction(async (client) => {
      const result = await client.query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM one_time_tokens WHERE token_hash = $1 AND purpose = 'password_reset'
           AND consumed_at IS NULL AND expires_at > now() FOR UPDATE`,
        [hashToken(input.token)],
      );
      const token = result.rows[0];
      if (!token)
        throw new ApiError(400, "invalid_reset_token", "The reset link is invalid or expired.");
      await client.query(
        "UPDATE admin_users SET password_hash = $2, updated_at = now() WHERE id = $1",
        [token.user_id, passwordHash],
      );
      await client.query("UPDATE one_time_tokens SET consumed_at = now() WHERE id = $1", [
        token.id,
      ]);
      await client.query(
        "UPDATE admin_refresh_sessions SET revoked_at = now() WHERE admin_user_id = $1",
        [token.user_id],
      );
    });
    response.status(204).end();
  }),
);

adminAuthRouter.get(
  "/invitation",
  asyncRoute(async (request, response) => {
    const token = z.string().min(32).parse(request.query.token);
    const [invitation] = await query<{
      email: string;
      name: string;
      workspace_name: string;
      role: string;
    }>(
      `SELECT u.email, u.name, w.name AS workspace_name, m.role FROM one_time_tokens t
       JOIN admin_users u ON u.id = t.user_id JOIN workspaces w ON w.id = t.workspace_id
       JOIN workspace_memberships m ON m.workspace_id = t.workspace_id AND m.admin_user_id = t.user_id
       WHERE t.token_hash = $1 AND t.purpose = 'account_link' AND t.consumed_at IS NULL AND t.expires_at > now()`,
      [hashToken(token)],
    );
    if (!invitation)
      throw new ApiError(404, "invitation_not_found", "The invitation is invalid or expired.");
    response.json(invitation);
  }),
);

adminAuthRouter.post(
  "/invitation",
  asyncRoute(async (request, response) => {
    const input = z
      .object({ token: z.string().min(32), password: z.string().min(12).max(128) })
      .parse(request.body);
    const passwordHash = await hash(input.password, 12);
    const accepted = await transaction(async (client) => {
      const result = await client.query<{
        id: string;
        user_id: string;
        workspace_id: string;
        email: string;
        role: string;
      }>(
        `SELECT t.id, t.user_id, t.workspace_id, u.email, m.role FROM one_time_tokens t
         JOIN admin_users u ON u.id = t.user_id
         JOIN workspace_memberships m ON m.workspace_id = t.workspace_id AND m.admin_user_id = t.user_id
         WHERE t.token_hash = $1 AND t.purpose = 'account_link' AND t.consumed_at IS NULL
           AND t.expires_at > now() FOR UPDATE`,
        [hashToken(input.token)],
      );
      const invitation = result.rows[0];
      if (!invitation)
        throw new ApiError(404, "invitation_not_found", "The invitation is invalid or expired.");
      await client.query(
        "UPDATE admin_users SET password_hash = $2, email_verified_at = now(), updated_at = now() WHERE id = $1",
        [invitation.user_id, passwordHash],
      );
      await client.query("UPDATE one_time_tokens SET consumed_at = now() WHERE id = $1", [
        invitation.id,
      ]);
      return {
        id: invitation.user_id,
        email: invitation.email,
        workspaceId: invitation.workspace_id,
        role: invitation.role,
      };
    });
    await createSession(response, request, accepted);
    response.status(204).end();
  }),
);

adminAuthRouter.post(
  "/refresh",
  requireCsrf,
  asyncRoute(async (request, response) => {
    const envelope = request.cookies[refreshCookie] as string | undefined;
    if (!envelope) throw new ApiError(401, "refresh_required", "Sign in to continue.");
    const { sessionId, token } = await verifyAdminRefreshEnvelope(envelope);
    let reuseDetected = false;
    const next = await transaction(async (client) => {
      const result = await client.query<{
        id: string;
        admin_user_id: string;
        workspace_id: string;
        token_hash: string;
        family_id: string;
        rotated_at: Date | null;
        revoked_at: Date | null;
        expires_at: Date;
        email: string;
        role: string;
      }>(
        `SELECT s.*, u.email, m.role FROM admin_refresh_sessions s
         JOIN admin_users u ON u.id = s.admin_user_id
         JOIN workspace_memberships m ON m.workspace_id = s.workspace_id AND m.admin_user_id = s.admin_user_id
         WHERE s.id = $1 FOR UPDATE`,
        [sessionId],
      );
      const current = result.rows[0];
      if (!current || current.revoked_at || current.expires_at < new Date()) {
        throw new ApiError(401, "invalid_refresh", "The refresh session is invalid or expired.");
      }
      if (current.rotated_at) {
        await client.query(
          "UPDATE admin_refresh_sessions SET revoked_at = now() WHERE family_id = $1",
          [current.family_id],
        );
        reuseDetected = true;
        return undefined;
      }
      if (!constantTimeEqual(current.token_hash, hashToken(token))) {
        throw new ApiError(401, "invalid_refresh", "The refresh session is invalid or expired.");
      }
      await client.query("UPDATE admin_refresh_sessions SET rotated_at = now() WHERE id = $1", [
        current.id,
      ]);
      return {
        id: current.admin_user_id,
        email: current.email,
        workspaceId: current.workspace_id,
        role: current.role,
        familyId: current.family_id,
      };
    });
    if (reuseDetected)
      throw new ApiError(
        401,
        "refresh_reuse",
        "This refresh token was already used. Sign in again.",
      );
    if (!next)
      throw new ApiError(401, "invalid_refresh", "The refresh session is invalid or expired.");
    await createSession(response, request, next, next.familyId);
    response.status(204).end();
  }),
);

adminAuthRouter.post(
  "/logout",
  requireCsrf,
  asyncRoute(async (request, response) => {
    const envelope = request.cookies[refreshCookie] as string | undefined;
    if (envelope) {
      try {
        const { sessionId } = await verifyAdminRefreshEnvelope(envelope);
        await query("UPDATE admin_refresh_sessions SET revoked_at = now() WHERE id = $1", [
          sessionId,
        ]);
      } catch {
        // Clearing an invalid cookie remains a successful logout.
      }
    }
    response.clearCookie(accessCookie, { path: "/" });
    response.clearCookie(refreshCookie, { path: "/" });
    response.clearCookie(csrfCookie, { path: "/" });
    response.status(204).end();
  }),
);

adminAuthRouter.get(
  "/me",
  requireAdmin,
  asyncRoute(async (request, response) => {
    const [user] = await query<{ id: string; name: string; email: string }>(
      "SELECT id, name, email FROM admin_users WHERE id = $1",
      [request.admin?.userId],
    );
    const workspaces = await query<{ id: string; name: string; slug: string; role: string }>(
      `SELECT w.id, w.name, w.slug, m.role FROM workspaces w
       JOIN workspace_memberships m ON m.workspace_id = w.id WHERE m.admin_user_id = $1 ORDER BY w.name`,
      [request.admin?.userId],
    );
    response.json({ user, workspaces, activeWorkspaceId: request.admin?.workspaceId });
  }),
);

adminAuthRouter.post(
  "/switch-workspace",
  requireAdmin,
  requireCsrf,
  asyncRoute(async (request, response) => {
    const input = z.object({ workspaceId: z.string().uuid() }).parse(request.body);
    const [membership] = await query<{ role: string }>(
      "SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND admin_user_id = $2",
      [input.workspaceId, request.admin!.userId],
    );
    if (!membership) throw new ApiError(404, "workspace_not_found", "The workspace was not found.");
    const envelope = request.cookies[refreshCookie] as string | undefined;
    if (envelope) {
      try {
        const { sessionId } = await verifyAdminRefreshEnvelope(envelope);
        await query("UPDATE admin_refresh_sessions SET revoked_at = now() WHERE id = $1", [
          sessionId,
        ]);
      } catch {
        // A stale refresh cookie does not prevent workspace switching with a valid access token.
      }
    }
    await createSession(response, request, {
      id: request.admin!.userId,
      email: request.admin!.email,
      workspaceId: input.workspaceId,
      role: membership.role,
    });
    response.status(204).end();
  }),
);

adminAuthRouter.post(
  "/workspaces",
  requireAdmin,
  requireCsrf,
  asyncRoute(async (request, response) => {
    const input = z
      .object({ name: z.string().trim().min(2).max(100), slug: slugSchema })
      .parse(request.body);
    const workspaceId = await transaction(async (client) => {
      const workspace = await client.query<{ id: string }>(
        "INSERT INTO workspaces(slug, name) VALUES ($1,$2) RETURNING id",
        [input.slug, input.name],
      );
      const id = workspace.rows[0]?.id;
      if (!id) throw new Error("Workspace was not created.");
      await client.query(
        "INSERT INTO workspace_memberships(workspace_id, admin_user_id, role) VALUES ($1,$2,'owner')",
        [id, request.admin!.userId],
      );
      await client.query(
        "INSERT INTO workspace_settings(workspace_id, display_name) VALUES ($1,$2)",
        [id, input.name],
      );
      const base = `${env.PUBLIC_ORIGIN}/w/${input.slug}`;
      const definitions = [
        ["development", "Development", "development", `${base}/development`, false],
        ["staging", "Staging", "staging", `${base}/staging`, false],
        ["production", "Production", "production", base, true],
      ] as const;
      for (const [slug, name, kind, issuer, isDefault] of definitions) {
        const environment = await client.query<{ id: string }>(
          `INSERT INTO environments(workspace_id, slug, name, kind, issuer, is_default)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [id, slug, name, kind, issuer, isDefault],
        );
        const environmentId = environment.rows[0]?.id;
        if (!environmentId) throw new Error("Environment was not created.");
        await seedSystemScopes(client, id, environmentId);
        await createSigningKey(client, id, environmentId);
      }
      return id;
    });
    response.status(201).json({ id: workspaceId });
  }),
);

async function seedSystemScopes(
  client: PoolClient,
  workspaceId: string,
  environmentId: string,
): Promise<void> {
  const scopes = [
    ["openid", "OpenID", "Authenticate users through OpenID Connect.", "Authenticate you"],
    ["profile", "Profile", "Read basic profile information.", "View your basic profile"],
    ["email", "Email", "Read the user's email address.", "View your email address"],
    ["phone", "Phone", "Read the user's phone number.", "View your phone number"],
    ["address", "Address", "Read the user's postal address.", "View your postal address"],
    [
      "offline_access",
      "Offline access",
      "Issue refresh tokens.",
      "Maintain access when you are away",
    ],
  ];
  for (const [name, displayName, description, consentDescription] of scopes) {
    await client.query(
      `INSERT INTO resource_scopes
        (workspace_id, environment_id, name, display_name, description, consent_description, sensitivity, is_system)
       VALUES ($1,$2,$3,$4,$5,$6,'standard',true)`,
      [workspaceId, environmentId, name, displayName, description, consentDescription],
    );
  }
}

export async function closeAuthPool(): Promise<void> {
  await pool.end();
}
