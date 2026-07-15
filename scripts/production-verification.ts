import { createHash } from "node:crypto";
import process from "node:process";
import { chromium, type APIResponse } from "@playwright/test";

interface Credentials {
  email: string;
  password: string;
}

let verificationStage = "startup";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function responseJson<T>(label: string, response: APIResponse): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: { code?: string; message?: string } | string;
    error_description?: string;
  };
  assert(
    response.ok(),
    `${label} returned HTTP ${response.status()}: ${JSON.stringify(body.error ?? body.error_description ?? "unknown error")}`,
  );
  return body;
}

async function readCredentials(): Promise<Credentials> {
  if (process.env.AUTHOMETRY_OWNER_EMAIL && process.env.AUTHOMETRY_OWNER_PASSWORD) {
    return {
      email: process.env.AUTHOMETRY_OWNER_EMAIL,
      password: process.env.AUTHOMETRY_OWNER_PASSWORD,
    };
  }
  assert(
    process.stdin.isTTY,
    "Provide owner credentials through the environment or an interactive pipe.",
  );
  process.stdin.setRawMode?.(true);
  process.stdin.setEncoding("utf8");
  process.stdout.write("CREDENTIALS_READY\n");
  const input = await new Promise<string>((resolve) => {
    let value = "";
    process.stdin.on("data", (chunk: string) => {
      value += chunk;
      if (value.includes("\n")) resolve(value.trim());
    });
  });
  process.stdin.setRawMode?.(false);
  process.stdin.pause();
  return JSON.parse(input) as Credentials;
}

async function main() {
  const baseUrl = (process.argv[2] ?? "").replace(/\/$/, "");
  const persistenceOnly = process.argv.includes("--persistence-only");
  assert(baseUrl.startsWith("https://"), "Pass the production HTTPS origin as the first argument.");
  const owner = await readCredentials();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();
  const suffix = Date.now().toString(36);
  const callback = "http://127.0.0.1:19876/callback";
  const identity = {
    email: `protocol-${suffix}@authometry.test`,
    password: `Amt-protocol-${suffix}-A7!`,
  };
  const summary = {
    dashboard: false,
    persistedRecords: false,
    authorizationCode: false,
    refreshRotation: false,
    refreshReuseDetected: false,
    userinfo: false,
    introspectionAndRevocation: false,
    clientCredentials: false,
    deviceFlow: false,
    deniedTraceRedacted: false,
    providersDisabled: false,
    logout: false,
  };

  try {
    verificationStage = "dashboard login";
    await page.goto("/login");
    await page.getByLabel("Email address").fill(owner.email);
    await page.getByLabel("Password").fill(owner.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/overview");
    await page.getByRole("heading", { name: "Overview" }).waitFor();
    summary.dashboard = true;

    const cookies = await context.cookies();
    const csrf = cookies.find(({ name }) => name === "authometry_csrf")?.value;
    assert(csrf, "The admin CSRF cookie was not issued.");
    const adminHeaders = {
      "x-authometry-csrf": decodeURIComponent(csrf),
      "x-authometry-environment": "production",
    };
    verificationStage = "persisted records";
    const [applications, users, persistedTraces] = await Promise.all([
      responseJson<{ data: unknown[] }>(
        "Persisted applications",
        await context.request.get("/api/v1/applications", { headers: adminHeaders }),
      ),
      responseJson<{ data: unknown[] }>(
        "Persisted users",
        await context.request.get("/api/v1/users", { headers: adminHeaders }),
      ),
      responseJson<{ data: unknown[] }>(
        "Persisted traces",
        await context.request.get("/api/v1/traces", { headers: adminHeaders }),
      ),
    ]);
    assert(
      applications.data.length > 0 && users.data.length > 0 && persistedTraces.data.length > 0,
      "Expected production records were not present after restart.",
    );
    summary.persistedRecords = true;
    if (persistenceOnly) {
      process.stdout.write(`${JSON.stringify(summary)}\n`);
      return;
    }
    verificationStage = "provider configuration";
    const providers = await responseJson<{ google: boolean; github: boolean }>(
      "Provider status",
      await context.request.get("/api/v1/authorize/providers"),
    );
    assert(!providers.google && !providers.github, "Unconfigured social providers are enabled.");
    summary.providersDisabled = true;

    verificationStage = "authorization code flow";
    const webApplication = await responseJson<{
      id: string;
      clientId: string;
      clientSecret: string;
    }>(
      "Web application creation",
      await context.request.post("/api/v1/applications", {
        headers: adminHeaders,
        data: {
          name: `Production verification ${suffix}`,
          slug: `production-verification-${suffix}`,
          type: "web",
          redirectUris: [callback],
          postLogoutRedirectUris: [callback],
        },
      }),
    );
    const detail = await responseJson<{ version: number }>(
      "Application detail",
      await context.request.get(`/api/v1/applications/${webApplication.id}`, {
        headers: adminHeaders,
      }),
    );
    await responseJson(
      "Application scope assignment",
      await context.request.patch(`/api/v1/applications/${webApplication.id}`, {
        headers: adminHeaders,
        data: {
          allowedScopes: ["openid", "profile", "email", "offline_access"],
          version: detail.version,
        },
      }),
    );
    await responseJson(
      "Protocol user creation",
      await context.request.post("/api/v1/users", {
        headers: adminHeaders,
        data: {
          name: "Production Protocol User",
          email: identity.email,
          password: identity.password,
          groups: ["production-verification"],
        },
      }),
    );

    await page.route(`${callback}**`, (route) =>
      route.fulfill({ status: 200, contentType: "text/plain", body: "OAuth callback received." }),
    );
    const verifier = "7bczwqj36kPx2UuAqR5UR5JlyoQHsp6qC8F7veXrQvQ";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const authorizeUrl = new URL("/oauth/authorize", baseUrl);
    authorizeUrl.search = new URLSearchParams({
      client_id: webApplication.clientId,
      redirect_uri: callback,
      response_type: "code",
      scope: "openid profile email offline_access",
      state: `state-${suffix}`,
      nonce: `nonce-${suffix}`,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();
    const authorizationResponse = await page.goto(authorizeUrl.toString());
    assert(authorizationResponse?.ok(), "Authorization endpoint did not render the login screen.");
    await page.getByLabel("Email address").fill(identity.email);
    await page.getByLabel("Password").fill(identity.password);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Allow access" }).click();
    await page.waitForURL(`${callback}**`);
    const code = new URL(page.url()).searchParams.get("code");
    assert(code, "Authorization response did not contain a code.");
    const authorization = Buffer.from(
      `${webApplication.clientId}:${webApplication.clientSecret}`,
    ).toString("base64");
    const tokenSet = await responseJson<{
      access_token: string;
      id_token: string;
      refresh_token: string;
    }>(
      "Authorization code exchange",
      await context.request.post("/oauth/token", {
        headers: { authorization: `Basic ${authorization}` },
        form: {
          grant_type: "authorization_code",
          code,
          redirect_uri: callback,
          code_verifier: verifier,
        },
      }),
    );
    const claims = JSON.parse(
      Buffer.from(tokenSet.id_token.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as { iss?: string; aud?: string; nonce?: string };
    assert(
      claims.iss === baseUrl &&
        claims.aud === webApplication.clientId &&
        claims.nonce === `nonce-${suffix}`,
      "The ID token issuer, audience, or nonce is invalid.",
    );
    summary.authorizationCode = true;

    const userinfo = await responseJson<{ email: string }>(
      "UserInfo",
      await context.request.get("/oauth/userinfo", {
        headers: { authorization: `Bearer ${tokenSet.access_token}` },
      }),
    );
    assert(userinfo.email === identity.email, "UserInfo returned the wrong subject.");
    summary.userinfo = true;

    verificationStage = "refresh rotation and revocation";
    const rotated = await responseJson<{ refresh_token: string }>(
      "Refresh rotation",
      await context.request.post("/oauth/token", {
        headers: { authorization: `Basic ${authorization}` },
        form: { grant_type: "refresh_token", refresh_token: tokenSet.refresh_token },
      }),
    );
    assert(rotated.refresh_token !== tokenSet.refresh_token, "The refresh token was not rotated.");
    summary.refreshRotation = true;
    const reuse = await context.request.post("/oauth/token", {
      headers: { authorization: `Basic ${authorization}` },
      form: { grant_type: "refresh_token", refresh_token: tokenSet.refresh_token },
    });
    const reuseBody = (await reuse.json()) as { error?: string };
    assert(
      reuse.status() === 400 && reuseBody.error === "invalid_grant",
      "Refresh reuse was accepted.",
    );
    summary.refreshReuseDetected = true;

    const active = await responseJson<{ active: boolean }>(
      "Access token introspection",
      await context.request.post("/oauth/introspect", {
        headers: { authorization: `Basic ${authorization}` },
        form: { token: tokenSet.access_token },
      }),
    );
    assert(active.active, "A valid access token was reported inactive.");
    await responseJson(
      "Access token revocation",
      await context.request.post("/oauth/revoke", {
        headers: { authorization: `Basic ${authorization}` },
        form: { token: tokenSet.access_token },
      }),
    );
    const inactive = await responseJson<{ active: boolean }>(
      "Revoked token introspection",
      await context.request.post("/oauth/introspect", {
        headers: { authorization: `Basic ${authorization}` },
        form: { token: tokenSet.access_token },
      }),
    );
    assert(!inactive.active, "A revoked access token remained active.");
    summary.introspectionAndRevocation = true;

    verificationStage = "client credentials flow";
    const machine = await responseJson<{ clientId: string; clientSecret: string }>(
      "Machine application creation",
      await context.request.post("/api/v1/applications", {
        headers: adminHeaders,
        data: {
          name: `Production machine ${suffix}`,
          slug: `production-machine-${suffix}`,
          type: "machine",
          redirectUris: [],
          postLogoutRedirectUris: [],
        },
      }),
    );
    const machineAuthorization = Buffer.from(
      `${machine.clientId}:${machine.clientSecret}`,
    ).toString("base64");
    const machineTokens = await responseJson<{ access_token: string }>(
      "Client credentials grant",
      await context.request.post("/oauth/token", {
        headers: { authorization: `Basic ${machineAuthorization}` },
        form: { grant_type: "client_credentials" },
      }),
    );
    assert(machineTokens.access_token, "Client credentials did not issue an access token.");
    summary.clientCredentials = true;

    verificationStage = "device authorization flow";
    const device = await responseJson<{ id: string; clientId: string }>(
      "Device application creation",
      await context.request.post("/api/v1/applications", {
        headers: adminHeaders,
        data: {
          name: `Production device ${suffix}`,
          slug: `production-device-${suffix}`,
          type: "device",
          redirectUris: [],
          postLogoutRedirectUris: [],
        },
      }),
    );
    const deviceAuthorization = await responseJson<{
      device_code: string;
      user_code: string;
      verification_uri_complete: string;
    }>(
      "Device authorization",
      await context.request.post("/oauth/device/authorization", {
        form: { client_id: device.clientId, scope: "openid profile" },
      }),
    );
    const pending = await context.request.post("/oauth/token", {
      form: {
        client_id: device.clientId,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceAuthorization.device_code,
      },
    });
    assert(
      pending.status() === 400 &&
        ((await pending.json()) as { error?: string }).error === "authorization_pending",
      "The device grant did not report authorization_pending.",
    );
    await page.goto(deviceAuthorization.verification_uri_complete);
    await page.getByLabel("Email address").fill(identity.email);
    await page.getByLabel("Password").fill(identity.password);
    await page.getByRole("button", { name: "Connect device" }).click();
    await page.getByRole("heading", { name: "Device connected" }).waitFor();
    await new Promise((resolve) => setTimeout(resolve, 5_200));
    const deviceTokens = await responseJson<{ access_token: string }>(
      "Device code grant",
      await context.request.post("/oauth/token", {
        form: {
          client_id: device.clientId,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceAuthorization.device_code,
        },
      }),
    );
    assert(deviceTokens.access_token, "The approved device grant did not issue a token.");
    summary.deviceFlow = true;

    verificationStage = "trace redaction";
    const deniedUrl = new URL("/oauth/authorize", baseUrl);
    deniedUrl.search = new URLSearchParams({
      client_id: webApplication.clientId,
      redirect_uri: "https://unregistered.invalid/callback",
      response_type: "code",
      scope: "openid",
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();
    const denied = await context.request.get(deniedUrl.toString());
    assert(denied.status() === 400, "An unregistered redirect URI was accepted.");
    const traces = await responseJson<{
      data: Array<{ id: string; oauth_error: string | null }>;
    }>(
      "Denied trace list",
      await context.request.get(
        `/api/v1/traces?status=denied&application=${encodeURIComponent(webApplication.clientId)}`,
        { headers: adminHeaders },
      ),
    );
    const deniedTrace = traces.data.find(
      ({ oauth_error }) => oauth_error === "redirect_uri_mismatch",
    );
    assert(deniedTrace, "The rejected authorization request did not produce a denied trace.");
    const trace = await responseJson<Record<string, unknown>>(
      "Denied trace detail",
      await context.request.get(`/api/v1/traces/${deniedTrace.id}`, { headers: adminHeaders }),
    );
    const serializedTrace = JSON.stringify(trace);
    for (const secret of [
      webApplication.clientSecret,
      machine.clientSecret,
      identity.password,
      tokenSet.access_token,
      tokenSet.refresh_token,
      deviceAuthorization.device_code,
    ]) {
      assert(!serializedTrace.includes(secret), "A credential or token appeared in a trace.");
    }
    summary.deniedTraceRedacted = true;

    verificationStage = "RP-initiated logout";
    const logout = await context.request.get(
      `/oauth/logout?id_token_hint=${encodeURIComponent(tokenSet.id_token)}&post_logout_redirect_uri=${encodeURIComponent(callback)}`,
      { maxRedirects: 0 },
    );
    assert(logout.status() === 302, "Logout did not return a redirect.");
    assert(
      logout.headers().location === callback,
      "Logout did not use the registered redirect URI.",
    );
    summary.logout = true;

    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } finally {
    await browser.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({ ok: false, stage: verificationStage, error: error instanceof Error ? error.name : "UnknownError" })}\n`,
  );
  process.exitCode = 1;
});
