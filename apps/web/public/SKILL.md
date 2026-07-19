---
name: add-authometry-oauth
description: Provision Authometry Cloud with the Authometry CLI and implement OAuth 2.0 or OpenID Connect in an existing application. Use when adding Authometry sign-in, creating an Authometry OAuth client, obtaining an issuer and client credentials, implementing Authorization Code with PKCE, protecting routes or APIs, refreshing sessions, logging users out, or adding client credentials and device authorization flows.
---

# Add Authometry OAuth

Complete the integration end to end. Inspect the application, use the Authometry CLI to create the Cloud OAuth client and write its credentials, implement the code, and run the repository's checks. Do not ask the user to manually create a client or copy an issuer, client ID, or client secret from the dashboard.

## 1. Inspect the application

Read the package manifest, routes, middleware, session handling, environment validation, deployment configuration, and existing authentication code before changing anything. Preserve unrelated authentication methods unless replacement is explicitly requested.

Determine:

- The application name and a stable lowercase slug.
- The client type: `web`, `spa`, `native`, `machine`, or `device`.
- Every local, preview, and production callback and post-logout URL available from the repository's current configuration.
- The required scopes. Start interactive clients with `openid profile email`. Add `offline_access` only when the app will securely store and rotate refresh tokens.
- The ignored environment file used by the framework. Add it to `.gitignore` before provisioning if needed.
- The environment prefix. Use `AUTHOMETRY` for server-side apps. Use a framework's public prefix, such as `VITE_AUTHOMETRY`, only for a secretless public client.

Use a confidential `web` client when a backend can protect a secret. Use `spa` or `native` for public clients and never give them a secret. Use `machine` only for service-to-service access without a user, and `device` only for input-constrained clients.

## 2. Authorize the CLI

Use the current CLI without adding it to the application's runtime dependencies:

```bash
npx authometry@latest --help
```

Authometry Cloud at `https://authometry.ch3n.cc` and the `production` environment are the defaults. Do not pass `--server` or set `AUTHOMETRY_SERVER` unless the user explicitly requests a self-hosted installation. Select a different Cloud environment with `--environment` or `AUTHOMETRY_ENVIRONMENT` only when required.

Use `AUTHOMETRY_TOKEN` from the agent's existing environment without printing it. The token needs `applications:read` and `applications:write`. If it is missing, stop only for the user to provide a scoped Authometry API token; never request their password or echo the token. The CLI must create all remaining Authometry values.

## 3. Provision Authometry Cloud

Run `apps create` yourself from the application repository. Adapt this command to the inspected app instead of copying the example literally:

```bash
npx authometry@latest apps create \
  --name "Customer Portal" \
  --slug customer-portal \
  --type web \
  --redirect-uri http://localhost:3000/auth/callback \
  --post-logout-redirect-uri http://localhost:3000/ \
  --scope openid \
  --scope profile \
  --scope email \
  --output-env .env.local \
  --env-prefix AUTHOMETRY \
  --json
```

Repeat URI and scope flags for additional values. The command creates the SaaS application and writes its application ID, issuer, client ID, and one-time client secret directly to the environment file with mode `0600`. Public clients omit the secret. When `--output-env` is used, JSON output does not contain the secret.

Do not run a successful create command twice. The CLI refuses to replace existing Authometry assignments. If they already exist, inspect the current integration and reuse it; never pass `--overwrite-env` unless the user explicitly asks to replace that client.

Never put `AUTHOMETRY_TOKEN` in the application's environment file. It is a management credential for the provisioning process, not an application runtime credential.

## 4. Implement interactive sign-in

Reuse a maintained OAuth/OIDC client already present in the app, or install a well-supported discovery-capable library for its framework and runtime. Load metadata from `${AUTHOMETRY_ISSUER}/.well-known/openid-configuration`; treat the configured issuer and discovered endpoints as authoritative.

Use Authorization Code with S256 PKCE for every interactive client, including confidential web applications:

1. Add an application login handler. Point the **Continue with Authometry** button to this handler, never to a fixed authorization URL.
2. Generate fresh high-entropy `state`, `nonce`, and PKCE verifier values for every attempt.
3. For a backend-assisted client, store them as a short-lived, single-use attempt in the production session store or an encrypted HTTP-only, `Secure`, `SameSite=Lax` cookie. For a pure SPA or native client, let the selected OIDC library keep only this transient request state in `sessionStorage` or platform-secure storage. Support concurrent attempts and consume the matching state atomically.
4. Redirect with `response_type=code`, the exact provisioned callback, `code_challenge_method=S256`, and the provisioned scopes.
5. Add a callback that rejects provider errors, validates state, and exchanges the single-use code with the original redirect URI and PKCE verifier.
6. Use the discovered token authentication method. Confidential clients normally use `client_secret_basic`; public clients send the client ID and no secret.
7. Let the OIDC library validate signature, exact issuer, audience, expiry, and nonce. Do not accept a merely decoded JWT.
8. Find or create the local identity with `(iss, sub)` as its stable key. Link by email only when it is verified and the app has an explicit safe linking policy.
9. Regenerate the local session ID for a backend-assisted client, then establish the application's own secure session. For a public client, use the OIDC library's authenticated state and do not invent a server session that the application does not have.
10. Accept a post-login return path only when it begins with one `/` and is not absolute, protocol-relative, backslash-based, encoded to escape the origin, or malformed.

## 5. Handle tokens, APIs, and logout

- Keep client secrets and tokens on the server for backend-assisted applications. Prefer a backend-for-frontend when the app already has a backend. A pure SPA must use a public client, rely on Authometry's credential-free OAuth CORS support, and keep tokens in memory or short-lived `sessionStorage`, never `localStorage`.
- Encrypt server-held refresh tokens at rest and replace them atomically after every refresh. On `invalid_grant`, clear the unusable token and require sign-in instead of retrying it.
- Validate API access-token signature, issuer, audience, expiry, and token context through discovery and cached JWKS. Get the expected resource and scopes from the API configuration; never guess an audience.
- For backend-assisted apps, expose local logout through a non-GET action protected by the app's CSRF controls. For public clients without cookie authentication, clear the OIDC library state without inventing CSRF requirements. Optionally revoke the refresh token, and use the discovered end-session endpoint with `id_token_hint` and the exact registered post-logout URI when provider logout is required.
- Never log management tokens, client secrets, authorization codes, access tokens, refresh tokens, ID tokens, PKCE verifiers, or complete cookies.

For a `machine` client, use Client Credentials and request only assigned API scopes; do not request `openid`. For a `device` client, use the discovered Device Authorization endpoint, show its user code and verification URI, honor the polling interval, and stop on approval, denial, or expiry. Never use implicit or resource-owner password grants.

## 6. Verify and report

Run the repository's native lint, typecheck, build, and test commands. Add focused tests for callback errors, state and nonce rejection, single-use attempts, session regeneration, protected routes, safe return paths, refresh rotation, and logout.

Verify without printing secrets:

- The CLI-created issuer's discovery document reports the exact same issuer.
- Login redirects use unique state, nonce, and S256 PKCE values.
- The exact registered callback completes sign-in and creates a local session.
- Modified, expired, replayed, or mismatched state and nonce values are rejected.
- Unauthenticated protected requests are denied or redirected.
- Refresh rotation and logout behave correctly when enabled.

Summarize the CLI command without its token or returned secrets, the created application ID, chosen client type and library, files changed, dashboard values that were provisioned automatically, and verification commands. Never include the client secret in the summary.

For protocol details, read `https://authometry.ch3n.cc/docs/oauth-and-oidc`.
