import { compare, hash } from "bcryptjs";
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { env } from "../env.js";
import { query, transaction } from "../db.js";
import {
  constantTimeEqual,
  decrypt,
  encrypt,
  hashToken,
  randomToken,
  sha256Base64Url,
} from "../lib/crypto.js";
import { verifyIdentityMfa } from "../lib/identity-mfa.js";
import { ApiError, asyncRoute } from "../lib/http.js";
import { generateRecoveryCodes, generateTotpSecret, totpSetupUri, verifyTotp } from "../lib/mfa.js";
import {
  exchangeSocialCode,
  socialAuthorizationUrl,
  socialProviderConfigured,
  type SocialProvider,
} from "../lib/social.js";

const sessionCookie = "authometry_user_session";
const csrfCookie = "authometry_portal_csrf";

interface PortalIdentityRow {
  id: string;
  workspace_id: string;
  environment_id: string;
  session_id: string;
  email: string;
  name: string;
  password_hash: string | null;
  status: "active" | "disabled";
  groups: string[];
  custom_claims: Record<string, unknown>;
  mfa_enabled: boolean;
  mfa_totp_secret_encrypted: string | null;
  workspace_name: string;
  workspace_slug: string;
  environment_name: string;
  session_lifetime_seconds: number;
}

declare global {
  namespace Express {
    interface Request {
      portal?: PortalIdentityRow;
    }
  }
}

function cookieOptions(maxAge: number, httpOnly = true) {
  return {
    httpOnly,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

function safePortalReturn(value: unknown, fallback = "/portal"): string {
  if (typeof value !== "string" || !value.startsWith("/portal") || value.startsWith("//")) {
    return fallback;
  }
  try {
    const target = new URL(value, env.PUBLIC_ORIGIN);
    return target.origin === new URL(env.PUBLIC_ORIGIN).origin
      ? `${target.pathname}${target.search}${target.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

function validateLaunchUri(value: string): string {
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    throw new ApiError(422, "invalid_launch_uri", "Enter a valid application launch URL.");
  }
  const local = ["localhost", "127.0.0.1", "::1"].includes(target.hostname);
  if (
    target.username ||
    target.password ||
    (target.protocol !== "https:" && !(local && target.protocol === "http:"))
  ) {
    throw new ApiError(
      422,
      "invalid_launch_uri",
      "Launch URLs must use HTTPS and cannot contain embedded credentials.",
    );
  }
  return target.toString();
}

async function portalIdentity(
  rawToken: string | undefined,
): Promise<PortalIdentityRow | undefined> {
  if (!rawToken) return undefined;
  const [identity] = await query<PortalIdentityRow>(
    `SELECT u.id, u.workspace_id, s.environment_id, s.id AS session_id, u.email, u.name,
            u.password_hash, u.status, u.groups, u.custom_claims, u.mfa_enabled,
            u.mfa_totp_secret_encrypted, w.name AS workspace_name, w.slug AS workspace_slug,
            e.name AS environment_name, ws.session_lifetime_seconds
     FROM user_sessions s
     JOIN identity_users u ON u.id = s.user_id
     JOIN workspaces w ON w.id = u.workspace_id
     JOIN workspace_settings ws ON ws.workspace_id = w.id
     JOIN environments e ON e.id = s.environment_id
     WHERE s.session_token_hash = $1 AND s.status = 'active' AND s.expires_at > now()
       AND u.status = 'active'`,
    [hashToken(rawToken)],
  );
  return identity;
}

export async function requirePortal(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const identity = await portalIdentity(request.cookies[sessionCookie] as string | undefined);
    if (!identity)
      throw new ApiError(
        401,
        "portal_authentication_required",
        "Sign in to your portal to continue.",
      );
    request.portal = identity;
    void query("UPDATE user_sessions SET last_active_at = now() WHERE id = $1", [
      identity.session_id,
    ]);
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePortalCsrf(request: Request, _response: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
  const cookie = request.cookies[csrfCookie] as string | undefined;
  const header = request.get("x-authometry-portal-csrf");
  if (!cookie || !header || !constantTimeEqual(cookie, header)) {
    return next(new ApiError(403, "csrf_failed", "Refresh the portal and try again."));
  }
  next();
}

async function createPortalSession(
  request: Request,
  response: Response,
  input: { userId: string; workspaceId: string; environmentId: string; lifetimeSeconds: number },
): Promise<void> {
  const rawToken = randomToken(40);
  await query(
    `INSERT INTO user_sessions
      (workspace_id, environment_id, user_id, application_id, session_token_hash, status,
       scopes, ip_address, user_agent, expires_at)
     VALUES ($1,$2,$3,NULL,$4,'active','{}',$5,$6,now() + ($7 * interval '1 second'))`,
    [
      input.workspaceId,
      input.environmentId,
      input.userId,
      hashToken(rawToken),
      request.ip,
      request.get("user-agent") ?? null,
      input.lifetimeSeconds,
    ],
  );
  const csrf = randomToken(24);
  response.cookie(sessionCookie, rawToken, cookieOptions(input.lifetimeSeconds * 1000));
  response.cookie(csrfCookie, csrf, cookieOptions(input.lifetimeSeconds * 1000, false));
}

async function loginContext(workspaceSlug: string, email?: string) {
  const [context] = await query<{
    workspace_id: string;
    workspace_name: string;
    workspace_slug: string;
    environment_id: string;
    session_lifetime_seconds: number;
    user_id: string | null;
    user_email: string | null;
    user_name: string | null;
    password_hash: string | null;
    status: "active" | "disabled" | null;
    mfa_enabled: boolean | null;
    mfa_totp_secret_encrypted: string | null;
  }>(
    `SELECT w.id AS workspace_id, w.name AS workspace_name, w.slug AS workspace_slug,
            e.id AS environment_id, ws.session_lifetime_seconds, u.id AS user_id,
            u.email AS user_email, u.name AS user_name, u.password_hash, u.status,
            u.mfa_enabled, u.mfa_totp_secret_encrypted
     FROM workspaces w
     JOIN workspace_settings ws ON ws.workspace_id = w.id
     JOIN environments e ON e.workspace_id = w.id AND e.is_default = true AND e.status = 'active'
     LEFT JOIN identity_users u ON u.workspace_id = w.id AND lower(u.email) = lower($2)
     WHERE w.slug = $1`,
    [workspaceSlug, email ?? ""],
  );
  return context;
}

export const portalRouter = Router();

portalRouter.get("/auth/providers", (_request, response) => {
  response.json({
    google: socialProviderConfigured("google"),
    github: socialProviderConfigured("github"),
  });
});

portalRouter.post(
  "/auth/login",
  asyncRoute(async (request, response) => {
    const input = z
      .object({
        workspace: z.string().trim().toLowerCase().min(3).max(64),
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(1).max(128),
        mfaCode: z.string().trim().min(6).max(24).optional(),
      })
      .parse(request.body);
    const context = await loginContext(input.workspace, input.email);
    if (
      !context?.user_id ||
      context.status !== "active" ||
      !context.password_hash ||
      !(await compare(input.password, context.password_hash))
    ) {
      throw new ApiError(
        401,
        "invalid_credentials",
        "The workspace, email, or password is incorrect.",
      );
    }
    if (context.mfa_enabled) {
      if (!input.mfaCode) {
        throw new ApiError(
          401,
          "mfa_required",
          "Enter a code from your authenticator app or a recovery code.",
        );
      }
      if (
        !(await verifyIdentityMfa(
          context.user_id,
          context.mfa_totp_secret_encrypted,
          input.mfaCode,
        ))
      ) {
        throw new ApiError(
          401,
          "invalid_mfa_code",
          "The authentication code is invalid or has already been used.",
        );
      }
    }
    await createPortalSession(request, response, {
      userId: context.user_id,
      workspaceId: context.workspace_id,
      environmentId: context.environment_id,
      lifetimeSeconds: context.session_lifetime_seconds,
    });
    await query("UPDATE identity_users SET last_authenticated_at = now() WHERE id = $1", [
      context.user_id,
    ]);
    response.json({
      user: { id: context.user_id, email: context.user_email, name: context.user_name },
      workspace: { name: context.workspace_name, slug: context.workspace_slug },
      next: "/portal",
    });
  }),
);

portalRouter.get(
  "/auth/social/:provider",
  asyncRoute(async (request, response) => {
    const provider = z.enum(["google", "github"]).parse(request.params.provider);
    const intent = z.enum(["login", "link"]).default("login").parse(request.query.intent);
    let workspaceId: string;
    let userId: string | undefined;
    if (intent === "link") {
      const identity = await portalIdentity(request.cookies[sessionCookie] as string | undefined);
      if (!identity)
        throw new ApiError(
          401,
          "portal_authentication_required",
          "Sign in before linking an account.",
        );
      workspaceId = identity.workspace_id;
      userId = identity.id;
    } else {
      const workspace = z.string().trim().toLowerCase().min(3).parse(request.query.workspace);
      const context = await loginContext(workspace);
      if (!context) throw new ApiError(404, "workspace_not_found", "The workspace was not found.");
      workspaceId = context.workspace_id;
    }
    const state = randomToken(32);
    const nonce = randomToken(24);
    const verifier = randomToken(48);
    const redirectUri = `${env.PUBLIC_ORIGIN}/api/v1/portal/auth/social/${provider}/callback`;
    const returnTo = safePortalReturn(request.query.return_to);
    await query(
      `INSERT INTO portal_social_login_states
        (workspace_id, user_id, provider, intent, state_hash, nonce_encrypted,
         code_verifier_encrypted, redirect_uri, return_to, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now() + interval '10 minutes')`,
      [
        workspaceId,
        userId ?? null,
        provider,
        intent,
        hashToken(state),
        encrypt(nonce),
        encrypt(verifier),
        redirectUri,
        returnTo,
      ],
    );
    response.redirect(
      socialAuthorizationUrl(
        provider,
        redirectUri,
        state,
        sha256Base64Url(verifier),
        nonce,
      ).toString(),
    );
  }),
);

portalRouter.get(
  "/auth/social/:provider/callback",
  asyncRoute(async (request, response) => {
    const provider = z.enum(["google", "github"]).parse(request.params.provider);
    const input = z
      .object({ code: z.string().min(1), state: z.string().min(1) })
      .parse(request.query);
    const state = await transaction(async (client) => {
      const result = await client.query<{
        id: string;
        workspace_id: string;
        user_id: string | null;
        intent: "login" | "link";
        nonce_encrypted: string;
        code_verifier_encrypted: string;
        redirect_uri: string;
        return_to: string;
      }>(
        `SELECT id, workspace_id, user_id, intent, nonce_encrypted, code_verifier_encrypted,
                redirect_uri, return_to
         FROM portal_social_login_states
         WHERE state_hash = $1 AND provider = $2 AND consumed_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [hashToken(input.state), provider],
      );
      const stored = result.rows[0];
      if (!stored)
        throw new ApiError(
          401,
          "invalid_social_state",
          "The social login link is invalid or expired.",
        );
      await client.query(
        "UPDATE portal_social_login_states SET consumed_at = now() WHERE id = $1",
        [stored.id],
      );
      return stored;
    });
    const profile = await exchangeSocialCode(
      provider,
      input.code,
      state.redirect_uri,
      decrypt(state.code_verifier_encrypted),
      decrypt(state.nonce_encrypted),
    );
    if (!profile.emailVerified) {
      throw new ApiError(
        401,
        "unverified_social_email",
        "The provider email address is not verified.",
      );
    }
    if (state.intent === "link") {
      if (!state.user_id)
        throw new ApiError(401, "invalid_social_state", "The social account link has no user.");
      await transaction(async (client) => {
        const conflict = await client.query<{ user_id: string }>(
          `SELECT user_id FROM social_identities
           WHERE workspace_id = $1 AND provider = $2 AND provider_subject = $3`,
          [state.workspace_id, provider, profile.subject],
        );
        if (conflict.rows[0] && conflict.rows[0].user_id !== state.user_id) {
          throw new ApiError(
            409,
            "social_identity_in_use",
            `This ${provider} account is linked to another user.`,
          );
        }
        await client.query(
          `INSERT INTO social_identities
            (workspace_id, user_id, provider, provider_subject, provider_email)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (workspace_id, provider, provider_subject)
           DO UPDATE SET provider_email = EXCLUDED.provider_email`,
          [state.workspace_id, state.user_id, provider, profile.subject, profile.email],
        );
      });
      response.redirect(state.return_to);
      return;
    }
    const [identity] = await query<{
      user_id: string;
      workspace_id: string;
      environment_id: string;
      session_lifetime_seconds: number;
      status: string;
    }>(
      `SELECT u.id AS user_id, u.workspace_id, e.id AS environment_id,
              ws.session_lifetime_seconds, u.status
       FROM social_identities s
       JOIN identity_users u ON u.id = s.user_id
       JOIN workspace_settings ws ON ws.workspace_id = u.workspace_id
       JOIN environments e ON e.workspace_id = u.workspace_id AND e.is_default = true AND e.status = 'active'
       WHERE s.workspace_id = $1 AND s.provider = $2 AND s.provider_subject = $3`,
      [state.workspace_id, provider, profile.subject],
    );
    if (!identity || identity.status !== "active") {
      throw new ApiError(
        401,
        "social_account_not_linked",
        "Link this social account from the portal before using it to sign in.",
      );
    }
    await createPortalSession(request, response, {
      userId: identity.user_id,
      workspaceId: identity.workspace_id,
      environmentId: identity.environment_id,
      lifetimeSeconds: identity.session_lifetime_seconds,
    });
    await query("UPDATE identity_users SET last_authenticated_at = now() WHERE id = $1", [
      identity.user_id,
    ]);
    response.redirect(state.return_to);
  }),
);

portalRouter.use(requirePortal, requirePortalCsrf);

portalRouter.post(
  "/auth/logout",
  asyncRoute(async (request, response) => {
    await query("UPDATE user_sessions SET status = 'revoked', revoked_at = now() WHERE id = $1", [
      request.portal!.session_id,
    ]);
    response.clearCookie(sessionCookie, { path: "/" });
    response.clearCookie(csrfCookie, { path: "/" });
    response.status(204).end();
  }),
);

portalRouter.get(
  "/me",
  asyncRoute(async (request, response) => {
    const portal = request.portal!;
    const [connections, sessions] = await Promise.all([
      query<{ provider: SocialProvider; provider_email: string | null; created_at: Date }>(
        `SELECT provider, provider_email, created_at FROM social_identities
         WHERE workspace_id = $1 AND user_id = $2 ORDER BY provider`,
        [portal.workspace_id, portal.id],
      ),
      query<{
        id: string;
        application_name: string | null;
        last_active_at: Date;
        created_at: Date;
      }>(
        `SELECT s.id, a.name AS application_name, s.last_active_at, s.created_at
         FROM user_sessions s LEFT JOIN oauth_applications a ON a.id = s.application_id
         WHERE s.user_id = $1 AND s.status = 'active' AND s.expires_at > now()
         ORDER BY s.last_active_at DESC LIMIT 12`,
        [portal.id],
      ),
    ]);
    response.json({
      user: {
        id: portal.id,
        email: portal.email,
        name: portal.name,
        groups: portal.groups,
        passwordEnabled: Boolean(portal.password_hash),
        mfaEnabled: portal.mfa_enabled,
      },
      workspace: {
        id: portal.workspace_id,
        name: portal.workspace_name,
        slug: portal.workspace_slug,
      },
      environment: { id: portal.environment_id, name: portal.environment_name },
      socialConnections: connections,
      sessions: sessions.map((session) => ({
        ...session,
        current: session.id === portal.session_id,
      })),
    });
  }),
);

portalRouter.patch(
  "/profile",
  asyncRoute(async (request, response) => {
    const input = z.object({ name: z.string().trim().min(2).max(100) }).parse(request.body);
    const [user] = await query<{ id: string; name: string; email: string }>(
      "UPDATE identity_users SET name = $2, updated_at = now() WHERE id = $1 RETURNING id, name, email",
      [request.portal!.id, input.name],
    );
    response.json({ user });
  }),
);

portalRouter.put(
  "/password",
  asyncRoute(async (request, response) => {
    const input = z
      .object({
        currentPassword: z.string().max(128).optional(),
        newPassword: z.string().min(12).max(128),
      })
      .parse(request.body);
    const portal = request.portal!;
    if (portal.password_hash) {
      if (!input.currentPassword || !(await compare(input.currentPassword, portal.password_hash))) {
        throw new ApiError(401, "invalid_current_password", "The current password is incorrect.");
      }
      if (await compare(input.newPassword, portal.password_hash)) {
        throw new ApiError(
          422,
          "password_unchanged",
          "Choose a password you have not already used here.",
        );
      }
    }
    await transaction(async (client) => {
      await client.query(
        "UPDATE identity_users SET password_hash = $2, updated_at = now() WHERE id = $1",
        [portal.id, await hash(input.newPassword, 12)],
      );
      await client.query(
        `UPDATE user_sessions SET status = 'revoked', revoked_at = now()
         WHERE user_id = $1 AND id <> $2 AND status = 'active'`,
        [portal.id, portal.session_id],
      );
    });
    response.status(204).end();
  }),
);

portalRouter.post(
  "/mfa/setup",
  asyncRoute(async (request, response) => {
    if (request.portal!.mfa_enabled) {
      throw new ApiError(
        409,
        "mfa_already_enabled",
        "Multi-factor authentication is already enabled.",
      );
    }
    const secret = generateTotpSecret();
    const setupToken = encrypt(
      JSON.stringify({
        userId: request.portal!.id,
        secret,
        expiresAt: Date.now() + 10 * 60 * 1000,
      }),
    );
    response.json({
      secret,
      setupToken,
      uri: totpSetupUri(secret, request.portal!.email, request.portal!.workspace_name),
    });
  }),
);

portalRouter.post(
  "/mfa/enable",
  asyncRoute(async (request, response) => {
    const input = z
      .object({ setupToken: z.string().min(20), code: z.string().trim().length(6) })
      .parse(request.body);
    let setup: { userId: string; secret: string; expiresAt: number };
    try {
      setup = JSON.parse(decrypt(input.setupToken)) as typeof setup;
    } catch {
      throw new ApiError(400, "invalid_mfa_setup", "The MFA setup expired. Start again.");
    }
    if (
      setup.userId !== request.portal!.id ||
      setup.expiresAt < Date.now() ||
      !verifyTotp(setup.secret, input.code)
    ) {
      throw new ApiError(
        400,
        "invalid_mfa_code",
        "The authenticator code is invalid or the setup expired.",
      );
    }
    const recoveryCodes = generateRecoveryCodes();
    await transaction(async (client) => {
      await client.query(
        `UPDATE identity_users SET mfa_enabled = true, mfa_totp_secret_encrypted = $2,
           updated_at = now() WHERE id = $1`,
        [request.portal!.id, encrypt(setup.secret)],
      );
      await client.query("DELETE FROM identity_mfa_recovery_codes WHERE user_id = $1", [
        request.portal!.id,
      ]);
      for (const code of recoveryCodes) {
        await client.query(
          "INSERT INTO identity_mfa_recovery_codes(user_id, code_hash) VALUES ($1,$2)",
          [request.portal!.id, hashToken(code)],
        );
      }
    });
    response.json({ recoveryCodes });
  }),
);

portalRouter.delete(
  "/mfa",
  asyncRoute(async (request, response) => {
    const input = z
      .object({ password: z.string().max(128).optional(), code: z.string().trim().min(6).max(24) })
      .parse(request.body);
    const portal = request.portal!;
    if (!portal.mfa_enabled || !portal.mfa_totp_secret_encrypted) {
      throw new ApiError(409, "mfa_not_enabled", "Multi-factor authentication is not enabled.");
    }
    if (
      portal.password_hash &&
      (!input.password || !(await compare(input.password, portal.password_hash)))
    ) {
      throw new ApiError(401, "invalid_current_password", "The current password is incorrect.");
    }
    if (!(await verifyIdentityMfa(portal.id, portal.mfa_totp_secret_encrypted, input.code))) {
      throw new ApiError(401, "invalid_mfa_code", "The authentication code is invalid.");
    }
    await transaction(async (client) => {
      await client.query(
        `UPDATE identity_users SET mfa_enabled = false, mfa_totp_secret_encrypted = NULL,
           updated_at = now() WHERE id = $1`,
        [portal.id],
      );
      await client.query("DELETE FROM identity_mfa_recovery_codes WHERE user_id = $1", [portal.id]);
    });
    response.status(204).end();
  }),
);

portalRouter.delete(
  "/social/:provider",
  asyncRoute(async (request, response) => {
    const provider = z.enum(["google", "github"]).parse(request.params.provider);
    const portal = request.portal!;
    const [count] = await query<{ count: string }>(
      "SELECT count(*)::text AS count FROM social_identities WHERE workspace_id = $1 AND user_id = $2",
      [portal.workspace_id, portal.id],
    );
    if (!portal.password_hash && Number(count?.count ?? 0) <= 1) {
      throw new ApiError(
        409,
        "last_sign_in_method",
        "Set a password before disconnecting your only sign-in method.",
      );
    }
    await query(
      "DELETE FROM social_identities WHERE workspace_id = $1 AND user_id = $2 AND provider = $3",
      [portal.workspace_id, portal.id, provider],
    );
    response.status(204).end();
  }),
);

portalRouter.get(
  "/applications",
  asyncRoute(async (request, response) => {
    const portal = request.portal!;
    const applications = await query<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      launch_uri: string;
      last_launched_at: Date | null;
      provisioning_enabled: boolean;
    }>(
      `SELECT a.id, a.name, a.slug, a.description, a.launch_uri, ua.last_launched_at,
              EXISTS (
                SELECT 1 FROM webhooks w
                WHERE w.environment_id = a.environment_id AND w.purpose = 'provisioning'
                  AND w.status = 'enabled'
              ) AS provisioning_enabled
       FROM user_application_assignments ua
       JOIN oauth_applications a ON a.id = ua.application_id
       WHERE ua.user_id = $1 AND ua.environment_id = $2 AND a.portal_enabled = true
         AND a.status = 'active' AND a.launch_uri IS NOT NULL
       ORDER BY ua.last_launched_at DESC NULLS LAST, a.name`,
      [portal.id, portal.environment_id],
    );
    response.json({ data: applications });
  }),
);

portalRouter.post(
  "/applications/:applicationId/launch",
  asyncRoute(async (request, response) => {
    const portal = request.portal!;
    const [application] = await query<{ id: string; name: string; launch_uri: string }>(
      `SELECT a.id, a.name, a.launch_uri
       FROM user_application_assignments ua
       JOIN oauth_applications a ON a.id = ua.application_id
       WHERE ua.user_id = $1 AND ua.environment_id = $2 AND ua.application_id = $3
         AND a.portal_enabled = true AND a.status = 'active' AND a.launch_uri IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM webhooks w WHERE w.environment_id = a.environment_id
             AND w.purpose = 'provisioning' AND w.status = 'enabled'
         )`,
      [portal.id, portal.environment_id, request.params.applicationId],
    );
    if (!application) {
      throw new ApiError(
        403,
        "application_access_denied",
        "This application is not assigned or ready for portal launch.",
      );
    }
    const launchUri = validateLaunchUri(application.launch_uri);
    await transaction(async (client) => {
      await client.query(
        `UPDATE user_application_assignments SET last_launched_at = now()
         WHERE user_id = $1 AND environment_id = $2 AND application_id = $3`,
        [portal.id, portal.environment_id, application.id],
      );
      await client.query(
        `INSERT INTO audit_events
          (workspace_id, environment_id, category, severity, event_type, summary, actor_type,
           actor_id, actor_name, source_ip, user_agent, resource_type, resource_id)
         VALUES ($1,$2,'authorization','info','portal.application_launched',$3,'user',$4,$5,$6,$7,
                 'application',$8)`,
        [
          portal.workspace_id,
          portal.environment_id,
          `${portal.email} launched ${application.name}`,
          portal.id,
          portal.email,
          request.ip,
          request.get("user-agent") ?? null,
          application.id,
        ],
      );
    });
    response.json({ url: launchUri });
  }),
);
