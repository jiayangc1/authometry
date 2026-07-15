import { Router } from "express";
import type { Response } from "express";
import { decodeJwt } from "jose";
import { query, transaction } from "../db.js";
import { hashToken, randomToken } from "../lib/crypto.js";
import { ApiError, asyncRoute } from "../lib/http.js";
import { issueTokenSet, verifyPkce } from "../lib/oauth.js";
import { verifyOAuthJwt } from "../lib/signing.js";
import { TraceRecorder } from "../lib/trace.js";
import { authenticateClient, oauthError } from "./common.js";
import type { IdentityUserRow, OAuthApplicationRow } from "./types.js";

interface AuthorizationCodeRow {
  id: string;
  application_id: string;
  user_id: string;
  redirect_uri: string;
  scope: string[];
  code_challenge: string | null;
  code_challenge_method: string | null;
  nonce: string | null;
  auth_time: Date;
  expires_at: Date;
  consumed_at: Date | null;
}

function noStore(response: Response): void {
  response.set("Cache-Control", "no-store");
  response.set("Pragma", "no-cache");
}

async function authorizationCodeGrant(
  application: OAuthApplicationRow,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const code = String(body.code ?? "");
  const redirectUri = String(body.redirect_uri ?? "");
  const verifier = String(body.code_verifier ?? "");
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
    await client.query("UPDATE authorization_codes SET consumed_at = now() WHERE id = $1", [
      authorizationCode.id,
    ]);
    const userResult = await client.query<IdentityUserRow>(
      "SELECT * FROM identity_users WHERE id = $1",
      [authorizationCode.user_id],
    );
    const user = userResult.rows[0];
    if (!user || user.status !== "active")
      throw new ApiError(400, "invalid_grant", "The user is not active.");

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
      ...(authorizationCode.nonce ? { nonce: authorizationCode.nonce } : {}),
      includeRefreshToken: authorizationCode.scope.includes("offline_access"),
    });
  });
}

async function refreshTokenGrant(
  application: OAuthApplicationRow,
  rawToken: string,
  requestedScope?: string,
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
      scopes: string[];
      family_expires_at: Date;
    }>(
      `SELECT t.id, t.family_id, t.expires_at, t.consumed_at, t.revoked_at,
              f.status, f.application_id, f.user_id, f.scopes, f.expires_at AS family_expires_at
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
    if (current.user_id) {
      user = (
        await client.query<IdentityUserRow>("SELECT * FROM identity_users WHERE id = $1", [
          current.user_id,
        ])
      ).rows[0];
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

export const tokenRouter = Router();

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
          );
          break;
        case "refresh_token":
          tokens = await refreshTokenGrant(
            application,
            String(request.body.refresh_token ?? ""),
            request.body.scope ? String(request.body.scope) : undefined,
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
          tokens = await issueTokenSet({
            application,
            issuer: application.issuer,
            scopes,
            includeRefreshToken: false,
          });
          break;
        }
        case "urn:ietf:params:oauth:grant-type:device_code":
          tokens = await deviceCodeGrant(application, String(request.body.device_code ?? ""));
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
        const { payload } = await verifyOAuthJwt(token, application.issuer, application.client_id);
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
      const { payload: verified } = await verifyOAuthJwt(
        token,
        application.issuer,
        application.client_id,
      );
      if (verified.jti) {
        const [revoked] = await query("SELECT jti FROM revoked_access_tokens WHERE jti = $1", [
          verified.jti,
        ]);
        if (revoked) throw new Error("revoked");
      }
      response.json({
        active: true,
        scope: verified.scope,
        client_id: verified.client_id,
        sub: verified.sub,
        token_type: "Bearer",
        exp: verified.exp,
        iat: verified.iat,
        iss: verified.iss,
        aud: payload.aud,
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
