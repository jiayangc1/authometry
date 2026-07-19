---
name: add-authometry-oauth
description: Implement Authometry OAuth 2.0 and OpenID Connect in an existing application. Use when adding Authometry sign-in, configuring an Authometry issuer and client, implementing Authorization Code with PKCE, protecting routes or APIs, refreshing sessions, logging users out, or adding client credentials and device authorization flows.
---

# Add Authometry OAuth

Implement Authometry through its standards-compliant OAuth 2.0 and OpenID Connect endpoints. Adapt the integration to the application's existing framework, routing, session, and configuration conventions instead of replacing working infrastructure.

## Gather the integration values

Use environment variables for these values:

```dotenv
AUTHOMETRY_ISSUER=https://authometry.example.com
AUTHOMETRY_CLIENT_ID=
AUTHOMETRY_CLIENT_SECRET=
AUTHOMETRY_REDIRECT_URI=http://localhost:3000/auth/callback
AUTHOMETRY_POST_LOGOUT_REDIRECT_URI=http://localhost:3000/
```

Get the exact issuer from the Authometry environment. Get the client ID and, for a confidential client, the one-time client secret from its Authometry application. Never commit or expose a client secret.

If values are unavailable, finish the code with environment-variable placeholders and report the exact redirect URI, post-logout redirect URI, application type, grant types, and scopes that must be configured in Authometry.

## Inspect before changing code

1. Read the application's package manifest, routes, middleware, session handling, environment validation, and existing authentication code.
2. Reuse a maintained OAuth/OIDC client already present in the app. Otherwise choose a well-supported library for the app's framework and runtime.
3. Preserve unrelated authentication methods unless replacement is explicitly requested.
4. Determine the client type:
   - Use `web` for a server-rendered or backend-assisted app that can protect a secret.
   - Use `spa` or `native` for a public client. Never give these clients a secret.
   - Use `machine` only for service-to-service access without a user.
   - Use `device` only for input-constrained clients.

## Discover the provider

Load OpenID Provider metadata from:

```text
${AUTHOMETRY_ISSUER}/.well-known/openid-configuration
```

Treat the configured issuer and discovered endpoint URLs as authoritative. Do not construct authorization, token, UserInfo, logout, or JWKS URLs when the selected library can use discovery. Environment issuers may include a path prefix, so do not strip or rewrite the issuer.

## Implement interactive sign-in

Use Authorization Code with S256 PKCE for every interactive client, including confidential web applications.

1. Add a login handler in the application. Do not link a sign-in button directly to a fixed authorization URL.
2. Generate fresh, high-entropy `state`, `nonce`, and PKCE verifier values for every attempt.
3. Store those short-lived values in a secure server-side session or encrypted, HTTP-only, `Secure`, `SameSite=Lax` cookie.
4. Redirect with `response_type=code`, the exact registered `redirect_uri`, `code_challenge_method=S256`, and the required scopes. Start with `openid profile email`; request `offline_access` only when the app will safely store and rotate refresh tokens.
5. Add a callback handler that rejects provider errors, validates `state`, and exchanges the single-use code with the original redirect URI and PKCE verifier.
6. Authenticate confidential clients at the token endpoint with the application's configured method, preferably `client_secret_basic`. Send `client_id` with no secret for a public client.
7. Validate the ID token through the OIDC library: signature, exact `iss`, `aud`, `exp`, and the original `nonce`. Do not accept a merely decoded JWT.
8. Establish the application's own session using the stable `sub` claim as the external user ID. Fetch UserInfo when additional authorized claims are needed.
9. Validate any `returnTo` value as a same-origin relative path before redirecting after sign-in.

Use the label **Continue with Authometry** for the provider button. Point it at the application's login handler.

## Handle tokens and sessions

- Keep tokens and the client secret on the server for backend-assisted applications. Store application sessions in HTTP-only, `Secure`, `SameSite=Lax` cookies.
- Prefer a backend-for-frontend for browser applications. If the project must remain a pure SPA, use a public client with PKCE and avoid long-lived token storage such as `localStorage`.
- Replace a stored refresh token atomically after every successful refresh. Authometry rotates refresh tokens and revokes the family when a consumed token is reused.
- Validate access-token signature, issuer, audience, expiry, and expected token context in APIs. Use discovery and JWKS caching instead of a hard-coded signing key.
- Never log authorization codes, access tokens, refresh tokens, ID tokens, client secrets, PKCE verifiers, or complete session cookies.

## Implement logout

1. Clear the local application session.
2. Revoke the refresh token when the application requires immediate session termination.
3. Redirect through the discovered end-session endpoint with `id_token_hint` and the exact registered `post_logout_redirect_uri` when provider logout is required.

## Use non-interactive flows only when appropriate

- For service-to-service access, use Client Credentials with a confidential `machine` application. Request only assigned API scopes and do not request `openid`.
- For an input-constrained client, use the discovered Device Authorization endpoint, show the returned user code and verification URI, honor the polling interval, and stop on approval, denial, or expiry.
- Do not use the implicit grant or the resource-owner password grant. Authometry does not support them.

## Configure the Authometry application

In Authometry, create or update an application whose type matches the implementation. Register complete redirect and post-logout redirect URIs exactly, including scheme, host, port, path, trailing slash, and case. Enable only the grant types and scopes the app uses.

Use separate Authometry applications and credentials for local, preview, and production deployments when their redirect origins differ.

## Verify the result

Run the repository's native lint, typecheck, build, and test commands. Add focused tests for state and nonce rejection, callback errors, protected-route behavior, and logout without weakening existing coverage.

Then verify these protocol outcomes without printing secrets:

- Discovery returns an issuer exactly equal to `AUTHOMETRY_ISSUER`.
- The login redirect contains a unique state, nonce, and S256 PKCE challenge.
- The registered callback completes sign-in and creates a local session.
- A modified state or nonce is rejected.
- An unauthenticated protected request is denied or redirected.
- Refresh rotation replaces the previous refresh token when enabled.
- Logout clears the local session and returns only to an allowed URI.

Summarize the files changed, the chosen client type and library, the Authometry dashboard values still required, and the commands used to verify the integration.

For protocol details and supported flows, read `https://authometry.ch3n.cc/docs/oauth-and-oidc`.
