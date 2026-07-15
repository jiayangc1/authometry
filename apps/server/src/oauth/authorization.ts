import { compare } from "bcryptjs";
import { Router, type Request, type Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { env } from "../env.js";
import { query, transaction } from "../db.js";
import { decrypt, encrypt, hashToken, randomToken, sha256Base64Url } from "../lib/crypto.js";
import { ApiError, asyncRoute } from "../lib/http.js";
import { evaluateAll } from "../lib/policy.js";
import { TraceRecorder } from "../lib/trace.js";
import { assertApplicationRoute, findApplicationByClientId } from "./common.js";
import type {
  AuthorizationParameters,
  IdentityUserRow,
  OAuthApplicationRow,
  PendingAuthorizationRow,
} from "./types.js";

const userSessionCookie = "authometry_user_session";

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
});

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
    application.require_consent &&
    !requestedScopes.every((scope) => consent?.scopes.includes(scope))
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

async function authorizationRedirect(
  pending: PendingAuthorizationRow,
  application: OAuthApplicationRow,
  user: IdentityUserRow,
): Promise<string> {
  const parameters = pending.parameters;
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
    await client.query(
      `INSERT INTO authorization_codes
        (workspace_id, environment_id, application_id, user_id, code_hash, redirect_uri, scope,
         code_challenge, code_challenge_method, nonce, auth_time, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now() + ($12 * interval '1 second'))`,
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
        application.authorization_code_lifetime_seconds,
      ],
    );
    await client.query(
      "UPDATE pending_authorization_requests SET status = 'completed', user_id = $1, completed_at = now() WHERE id = $2",
      [user.id, pending.id],
    );
    await client.query(
      `UPDATE authorization_traces SET status = 'success', event_type = 'authorization_code_issued',
         user_id = $1, user_snapshot = $2,
         steps = steps || $3::jsonb, completed_at = now(), duration_ms = extract(milliseconds from now() - started_at)::integer
       WHERE request_id = $4`,
      [
        user.id,
        { id: user.id, email: user.email, name: user.name },
        JSON.stringify([
          {
            id: `${pending.request_id}_step_authenticated`,
            index: 4,
            name: "User authenticated",
            status: "passed",
            summary: user.email,
            description: "The user completed authentication.",
            startedOffsetMs: 0,
            decision: { outcome: "allowed", reason: "The user session is valid." },
          },
          {
            id: `${pending.request_id}_step_code`,
            index: 5,
            name: "Authorization code issued",
            status: "passed",
            summary: "One-time code created",
            description: "A short-lived, single-use authorization code was issued.",
            startedOffsetMs: 0,
          },
          {
            id: `${pending.request_id}_step_redirect`,
            index: 6,
            name: "Redirect completed",
            status: "passed",
            summary: "302 Found",
            description: "The user agent was redirected to the registered redirect URI.",
            startedOffsetMs: 0,
          },
        ]),
        pending.request_id,
      ],
    );
  });
  const redirect = new URL(parameters.redirect_uri);
  redirect.searchParams.set("code", code);
  if (parameters.state) redirect.searchParams.set("state", parameters.state);
  return redirect.toString();
}

export const authorizationRouter = Router();

authorizationRouter.get(
  "/authorize",
  asyncRoute(async (request, response) => {
    const parsed = authorizationSchema.safeParse(request.query);
    if (!parsed.success)
      throw new ApiError(400, "invalid_request", "The authorization request is malformed.");
    const parameters = parsed.data as AuthorizationParameters;
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
        !application.require_consent ||
        (parameters.prompt !== "consent" && consentCoversRequest)
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
      application: { id: application.id, name: application.name, type: application.type },
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
      })
      .parse(request.body);
    const { pending, application } = await loadPending(input.requestId);
    const [user] = await query<IdentityUserRow>(
      "SELECT * FROM identity_users WHERE workspace_id = $1 AND lower(email) = lower($2) AND status = 'active'",
      [application.workspace_id, input.email],
    );
    if (!user?.password_hash || !(await compare(input.password, user.password_hash))) {
      throw new ApiError(401, "invalid_credentials", "The email or password is incorrect.");
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
    const clientId = provider === "google" ? env.GOOGLE_CLIENT_ID : env.GITHUB_CLIENT_ID;
    const clientSecret =
      provider === "google" ? env.GOOGLE_CLIENT_SECRET : env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret)
      throw new ApiError(404, "provider_disabled", `${provider} authentication is not configured.`);
    const state = randomToken(32);
    const nonce = randomToken(24);
    const verifier = randomToken(48);
    const redirectUri = `${env.PUBLIC_ORIGIN}/api/v1/authorize/social/${provider}/callback`;
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
    const target =
      provider === "google"
        ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
        : new URL("https://github.com/login/oauth/authorize");
    target.searchParams.set("client_id", clientId);
    target.searchParams.set("redirect_uri", redirectUri);
    target.searchParams.set("response_type", "code");
    target.searchParams.set(
      "scope",
      provider === "google" ? "openid email profile" : "read:user user:email",
    );
    target.searchParams.set("state", state);
    target.searchParams.set("code_challenge", sha256Base64Url(verifier));
    target.searchParams.set("code_challenge_method", "S256");
    if (provider === "google") target.searchParams.set("nonce", nonce);
    response.redirect(target.toString());
  }),
);

interface SocialProfile {
  subject: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

async function exchangeSocialCode(
  provider: "google" | "github",
  code: string,
  redirectUri: string,
  verifier: string,
  nonce: string,
): Promise<SocialProfile> {
  const clientId = provider === "google" ? env.GOOGLE_CLIENT_ID! : env.GITHUB_CLIENT_ID!;
  const clientSecret =
    provider === "google" ? env.GOOGLE_CLIENT_SECRET! : env.GITHUB_CLIENT_SECRET!;
  const tokenUrl =
    provider === "google"
      ? "https://oauth2.googleapis.com/token"
      : "https://github.com/login/oauth/access_token";
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    grant_type: "authorization_code",
  });
  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const token = (await tokenResponse.json()) as {
    access_token?: string;
    id_token?: string;
    error?: string;
  };
  if (!tokenResponse.ok || !token.access_token)
    throw new ApiError(
      401,
      "social_exchange_failed",
      "The social provider did not accept the callback.",
    );
  if (provider === "google") {
    if (!token.id_token)
      throw new ApiError(401, "invalid_id_token", "Google did not return an ID token.");
    const result = await jwtVerify(
      token.id_token,
      createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
      {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: clientId,
      },
    );
    if (
      result.payload.nonce !== nonce ||
      !result.payload.sub ||
      typeof result.payload.email !== "string"
    ) {
      throw new ApiError(401, "invalid_id_token", "Google identity validation failed.");
    }
    return {
      subject: result.payload.sub,
      email: result.payload.email.toLowerCase(),
      name: typeof result.payload.name === "string" ? result.payload.name : result.payload.email,
      emailVerified: result.payload.email_verified === true,
    };
  }
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token.access_token}`,
    "user-agent": "Authometry",
  };
  const [profileResponse, emailsResponse] = await Promise.all([
    fetch("https://api.github.com/user", { headers }),
    fetch("https://api.github.com/user/emails", { headers }),
  ]);
  const profile = (await profileResponse.json()) as { id?: number; name?: string; login?: string };
  const emails = (await emailsResponse.json()) as Array<{
    email: string;
    primary: boolean;
    verified: boolean;
  }>;
  const email =
    emails.find((candidate) => candidate.primary && candidate.verified) ??
    emails.find((candidate) => candidate.verified);
  if (!profileResponse.ok || !emailsResponse.ok || !profile.id || !email) {
    throw new ApiError(
      401,
      "unverified_social_email",
      "GitHub must provide a verified email address.",
    );
  }
  return {
    subject: String(profile.id),
    email: email.email.toLowerCase(),
    name: profile.name ?? profile.login ?? email.email,
    emailVerified: true,
  };
}

authorizeApiRouter.get(
  "/social/:provider/callback",
  asyncRoute(async (request, response) => {
    const provider = z.enum(["google", "github"]).parse(request.params.provider);
    const input = z
      .object({ code: z.string().min(1), state: z.string().min(1) })
      .parse(request.query);
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
    const user = await transaction(async (client) => {
      const linked = await client.query<IdentityUserRow>(
        `SELECT u.* FROM social_identities s JOIN identity_users u ON u.id = s.user_id
         WHERE s.workspace_id = $1 AND s.provider = $2 AND s.provider_subject = $3`,
        [application.workspace_id, provider, profile.subject],
      );
      if (linked.rows[0]) return linked.rows[0];
      const existing = await client.query<IdentityUserRow>(
        "SELECT * FROM identity_users WHERE workspace_id = $1 AND lower(email) = $2",
        [application.workspace_id, profile.email],
      );
      if (existing.rows[0]) {
        throw new ApiError(
          409,
          "account_link_required",
          "Sign in with your existing account before linking this provider.",
        );
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
      return identity;
    });
    await continueAfterAuthentication(request, response, pending, application, user);
  }),
);

authorizeApiRouter.post(
  "/consent",
  asyncRoute(async (request, response) => {
    const input = z
      .object({ requestId: z.string().min(1), approved: z.boolean() })
      .parse(request.body);
    const { pending, application } = await loadPending(input.requestId);
    if (!pending.user_id)
      throw new ApiError(401, "login_required", "Sign in before reviewing consent.");
    const [user] = await query<IdentityUserRow>("SELECT * FROM identity_users WHERE id = $1", [
      pending.user_id,
    ]);
    if (!user)
      throw new ApiError(401, "login_required", "The user session is no longer available.");
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
