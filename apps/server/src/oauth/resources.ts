import { compare } from "bcryptjs";
import { Router, type Request } from "express";
import { z } from "zod";
import { env } from "../env.js";
import { query, transaction } from "../db.js";
import { ApiError, asyncRoute } from "../lib/http.js";
import { mappedClaims } from "../lib/claims.js";
import { listPublicKeys, verifyOAuthJwt } from "../lib/signing.js";
import { assertApplicationRoute, findApplicationByClientId } from "./common.js";
import type { IdentityUserRow } from "./types.js";

export interface IssuerEnvironment {
  id: string;
  workspace_id: string;
  issuer: string;
}

export async function defaultEnvironment(request?: Request): Promise<IssuerEnvironment> {
  const workspaceSlug = request?.params.workspaceSlug ?? "";
  const environmentSlug = request?.params.environmentSlug ?? "";
  const [environment] = await query<IssuerEnvironment>(
    `SELECT e.id, e.workspace_id, e.issuer FROM environments e JOIN workspaces w ON w.id = e.workspace_id
     WHERE ($1 = '' OR w.slug = $1) AND ($2 = '' AND e.is_default = true OR $2 <> '' AND e.slug = $2)
     ORDER BY w.created_at, e.is_default DESC LIMIT 1`,
    [workspaceSlug, environmentSlug],
  );
  if (!environment)
    throw new ApiError(503, "not_configured", "Authometry has not been bootstrapped.");
  return environment;
}

export function mcpResourceForIssuer(issuer: string): string {
  const resource = new URL(issuer);
  resource.pathname = `${resource.pathname.replace(/\/$/, "")}/mcp`;
  resource.search = "";
  resource.hash = "";
  return resource.toString().replace(/\/$/, "");
}

export function mcpResourceMetadataUrl(resource: string): string {
  const parsed = new URL(resource);
  return `${parsed.origin}/.well-known/oauth-protected-resource${parsed.pathname}`;
}

export function resourceIndicatorsMatch(candidate: string, expected: string): boolean {
  try {
    return new URL(candidate).href === new URL(expected).href;
  } catch {
    return false;
  }
}

function authorizationServerMetadata(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    pushed_authorization_request_endpoint: `${issuer}/oauth/par`,
    userinfo_endpoint: `${issuer}/oauth/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    introspection_endpoint: `${issuer}/oauth/introspect`,
    device_authorization_endpoint: `${issuer}/oauth/device/authorization`,
    end_session_endpoint: `${issuer}/oauth/logout`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: [
      "authorization_code",
      "refresh_token",
      "client_credentials",
      "urn:ietf:params:oauth:grant-type:device_code",
      "urn:ietf:params:oauth:grant-type:token-exchange",
    ],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "private_key_jwt",
      "none",
    ],
    scopes_supported: [
      "openid",
      "profile",
      "email",
      "phone",
      "address",
      "offline_access",
      "mcp:read",
      "mcp:write",
    ],
    claims_supported: [
      "sub",
      "iss",
      "aud",
      "exp",
      "iat",
      "auth_time",
      "nonce",
      "name",
      "email",
      "email_verified",
      "groups",
    ],
    code_challenge_methods_supported: ["S256"],
    prompt_values_supported: ["none", "login", "consent", "select_account"],
    authorization_details_types_supported: ["agent_action"],
    dpop_signing_alg_values_supported: ["ES256", "RS256"],
    require_pushed_authorization_requests: false,
    resource_indicators_supported: true,
  };
}

export const discoveryRouter = Router({ mergeParams: true });

discoveryRouter.get(
  ["/openid-configuration", "/oauth-authorization-server"],
  asyncRoute(async (request, response) => {
    const { issuer } = await defaultEnvironment(request);
    response.json(authorizationServerMetadata(issuer));
  }),
);

export const authorizationServerWellKnownRouter = Router({ mergeParams: true });

authorizationServerWellKnownRouter.get(
  ["/", "/:environmentSlug", "/w/:workspaceSlug", "/w/:workspaceSlug/:environmentSlug"],
  asyncRoute(async (request, response) => {
    const { issuer } = await defaultEnvironment(request);
    response.json(authorizationServerMetadata(issuer));
  }),
);

export const protectedResourceRouter = Router({ mergeParams: true });

protectedResourceRouter.get(
  [
    "/",
    "/mcp",
    "/:environmentSlug/mcp",
    "/w/:workspaceSlug/mcp",
    "/w/:workspaceSlug/:environmentSlug/mcp",
  ],
  asyncRoute(async (request, response) => {
    const environment = await defaultEnvironment(request);
    const resource = mcpResourceForIssuer(environment.issuer);
    response.json({
      resource,
      resource_name: "Authometry MCP server",
      authorization_servers: [environment.issuer],
      scopes_supported: ["mcp:read", "mcp:write"],
      bearer_methods_supported: ["header"],
      resource_documentation: `${env.PUBLIC_ORIGIN}/docs/mcp`,
    });
  }),
);

discoveryRouter.get(
  "/jwks.json",
  asyncRoute(async (request, response) => {
    const environment = await defaultEnvironment(request);
    response.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    response.json({ keys: await listPublicKeys(environment.id) });
  }),
);

export const resourceRouter = Router();

resourceRouter.get(
  "/userinfo",
  asyncRoute(async (request, response) => {
    const token = request.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new ApiError(401, "invalid_token", "A bearer access token is required.");
    const { payload } = await verifyOAuthJwt(token);
    if (payload.token_use !== "access" || !payload.sub) {
      throw new ApiError(401, "invalid_token", "The access token is invalid.");
    }
    if (payload.jti) {
      const [revoked] = await query("SELECT jti FROM revoked_access_tokens WHERE jti = $1", [
        payload.jti,
      ]);
      if (revoked) throw new ApiError(401, "invalid_token", "The access token has been revoked.");
    }
    const clientId = typeof payload.client_id === "string" ? payload.client_id : "";
    const application = clientId ? await findApplicationByClientId(clientId) : undefined;
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (
      !application ||
      payload.iss !== application.issuer ||
      !audience.includes(application.client_id)
    ) {
      throw new ApiError(
        401,
        "invalid_token",
        "The access token has an invalid issuer or audience.",
      );
    }
    assertApplicationRoute(application, request);
    const [user] = await query<IdentityUserRow>(
      "SELECT * FROM identity_users WHERE id = $1 AND workspace_id = $2",
      [payload.sub, application.workspace_id],
    );
    if (!user || user.status !== "active")
      throw new ApiError(401, "invalid_token", "The user is not active.");
    const scopes = typeof payload.scope === "string" ? payload.scope.split(" ") : [];
    const claims = await mappedClaims(
      application.environment_id,
      {
        id: user.id,
        email: user.email,
        name: user.name,
        groups: user.groups,
        customClaims: user.custom_claims,
        emailVerified: Boolean(user.email_verified_at),
      },
      "userinfo",
    );
    response.json({
      sub: user.id,
      ...claims,
      ...(scopes.includes("profile") ? { name: user.name } : {}),
      ...(scopes.includes("email")
        ? { email: user.email, email_verified: Boolean(user.email_verified_at) }
        : {}),
      ...(scopes.includes("profile") ? { groups: user.groups } : {}),
    });
  }),
);

resourceRouter.get(
  "/device",
  asyncRoute(async (request, response) => {
    const code = request.query.user_code
      ? `?user_code=${encodeURIComponent(String(request.query.user_code))}`
      : "";
    response.redirect(`${env.PUBLIC_ORIGIN}/authorize/device${code}`);
  }),
);

resourceRouter.get(
  "/logout",
  asyncRoute(async (request, response) => {
    const idToken = String(request.query.id_token_hint ?? "");
    const requestedRedirect = String(request.query.post_logout_redirect_uri ?? "");
    let redirect = env.PUBLIC_ORIGIN;
    if (idToken && requestedRedirect) {
      try {
        const { payload } = await verifyOAuthJwt(idToken);
        const clientId = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
        const application = clientId ? await findApplicationByClientId(clientId) : undefined;
        if (application) assertApplicationRoute(application, request);
        if (application?.post_logout_redirect_uris.includes(requestedRedirect))
          redirect = requestedRedirect;
      } catch {
        // Invalid hints never expand the allowed redirect target.
      }
    }
    response.clearCookie("authometry_user_session", { path: "/" });
    response.redirect(redirect);
  }),
);

export const deviceApiRouter = Router();

deviceApiRouter.get(
  "/device/:userCode",
  asyncRoute(async (request, response) => {
    const [device] = await query<{
      user_code: string;
      status: string;
      expires_at: Date;
      application_name: string;
      scopes: string[];
    }>(
      `SELECT d.user_code, d.status, d.expires_at, a.name AS application_name, d.scopes
       FROM device_authorizations d JOIN oauth_applications a ON a.id = d.application_id
       WHERE replace(d.user_code, '-', '') = replace(upper($1), '-', '')`,
      [String(request.params.userCode)],
    );
    if (!device || device.expires_at < new Date()) {
      throw new ApiError(404, "device_code_not_found", "This device code is invalid or expired.");
    }
    response.json(device);
  }),
);

deviceApiRouter.post(
  "/device",
  asyncRoute(async (request, response) => {
    const input = z
      .object({
        userCode: z.string().min(4),
        email: z.string().email(),
        password: z.string().min(1),
        approved: z.boolean(),
      })
      .parse(request.body);
    const result = await transaction(async (client) => {
      const deviceResult = await client.query<{
        id: string;
        workspace_id: string;
        status: string;
        expires_at: Date;
      }>(
        `SELECT * FROM device_authorizations
         WHERE replace(user_code, '-', '') = replace(upper($1), '-', '') FOR UPDATE`,
        [input.userCode],
      );
      const device = deviceResult.rows[0];
      if (!device || device.status !== "pending" || device.expires_at < new Date()) {
        throw new ApiError(404, "device_code_not_found", "This device code is invalid or expired.");
      }
      const userResult = await client.query<IdentityUserRow>(
        "SELECT * FROM identity_users WHERE workspace_id = $1 AND lower(email) = lower($2) AND status = 'active'",
        [device.workspace_id, input.email],
      );
      const user = userResult.rows[0];
      if (!user?.password_hash || !(await compare(input.password, user.password_hash))) {
        throw new ApiError(401, "invalid_credentials", "The email or password is incorrect.");
      }
      await client.query(
        "UPDATE device_authorizations SET status = $1, user_id = $2 WHERE id = $3",
        [input.approved ? "approved" : "denied", user.id, device.id],
      );
      return { status: input.approved ? "approved" : "denied" };
    });
    response.json(result);
  }),
);
