# Security

Authometry handles credentials and authorization decisions. This guide describes implemented controls and the deployment responsibilities required to preserve them.

## Security model

The public web origin is the only intended internet-facing service. It proxies protocol and management paths to the private Express API. PostgreSQL, the API container address, platform secret storage, SMTP credentials, and backup storage are trusted infrastructure.

Authometry assumes:

- TLS terminates at a trusted reverse proxy and the original host/protocol are forwarded correctly.
- `PUBLIC_ORIGIN` and every environment issuer are controlled by the operator.
- PostgreSQL and backups are access-controlled and encrypted at rest by the platform.
- Installation secrets are unique, random, unavailable to application users, and recoverable for disaster restoration.
- OAuth clients validate tokens and OIDC parameters rather than trusting decoded claims.

## Secret inventory

| Material                                  | Stored form                                       |
| ----------------------------------------- | ------------------------------------------------- |
| Identity and administrator passwords      | bcrypt hash, cost 12.                             |
| Authorization codes                       | HMAC-SHA-256 digest.                              |
| Refresh and device codes                  | HMAC-SHA-256 digest.                              |
| Administrative session nonce              | HMAC-SHA-256 digest inside the database record.   |
| Personal access tokens and one-time links | HMAC-SHA-256 digest.                              |
| Client credentials                        | HMAC-SHA-256 digest.                              |
| OAuth private signing JWKs                | AES-256-GCM ciphertext.                           |
| Webhook secrets                           | AES-256-GCM ciphertext.                           |
| OAuth access and ID tokens                | RS256 JWTs; public verification keys are in JWKS. |

Raw opaque credentials are returned only when created or delivered. Configuration snapshots and deployment provenance omit client-secret values.

`TOKEN_HMAC_KEY` protects opaque-token hashes from offline precomputation. `INSTALLATION_ENCRYPTION_KEY` is transformed into a 256-bit encryption key and protects decryptable secrets. Losing that installation key makes restored signing keys and webhook secrets unusable; exposing it requires rotation of all encrypted material.

## Administrative authentication

Administrator access tokens are HS256 JWTs with a ten-minute lifetime, the public origin as issuer, and `authometry-admin` as audience. Refresh envelopes have a 30-day lifetime and reference a rotating database session. Access and refresh cookies are HTTP-only, `SameSite=Lax`, path-wide, and secure in production.

Successful refresh consumes the current session token and rotates it. Reuse detection revokes the session family. Logout revokes the database session and clears cookies.

State-changing cookie requests use a signed double-submit CSRF value: the readable `authometry_csrf` cookie must exactly match `x-authometry-csrf` and pass its HMAC signature. Personal access tokens use the Authorization header and do not rely on ambient browser cookies.

Credential-bearing login, bootstrap, recovery, invitation, and device authorization requests are rate-limited to 30 requests per 15 minutes outside tests. Routine session, refresh, logout, provider discovery, authorization status, consent, and workspace requests do not share that credential-attempt budget. The token endpoint is limited to 120 requests per minute.

## OAuth protections

- Redirect and post-logout URIs use complete registered-value matching.
- Only the Authorization Code response type is advertised.
- PKCE supports S256 only; public clients and configured confidential clients must provide it.
- Authorization codes are short-lived, single-use, bound to client, redirect URI, user, scopes, and challenge.
- Refresh tokens rotate; reuse revokes the whole token family.
- JWTs contain issuer, audience, subject, issued-at, expiry, and unique JWT ID claims.
- UserInfo verifies signature, token use, revocation, issuer, audience, route, and active user state.
- Revocation is non-enumerating; unknown tokens still receive success.
- Introspection authenticates the client and returns inactive for invalid or foreign tokens.
- Logout redirects only to an exact registered URI associated with a valid ID-token hint.
- Reserved protocol claims cannot be replaced by custom mappings.

Clients remain responsible for generating unpredictable `state`, `nonce`, and PKCE verifiers; correlating `state`; validating the ID-token signature, issuer, audience, expiry, and nonce; and storing credentials safely.

## Signing keys

Each environment has one active RS256 signing key. The private JWK is encrypted in PostgreSQL and decrypted only for signing. JWKS exposes public JWKs in active or retiring state with `kid`, `alg`, and `use=sig`, never private parameters.

Rotation creates a new active key and marks the previous key as retiring. Retiring keys remain available until their retirement time so issued JWTs can be verified. The hourly retention worker marks elapsed retiring keys retired.

Back up `INSTALLATION_ENCRYPTION_KEY` separately from PostgreSQL. Before changing it, implement a controlled decrypt-and-reencrypt migration for every encrypted value; simply replacing the variable will break signing and webhook delivery.

## Request hardening

- Helmet removes common unsafe defaults; `x-powered-by` is disabled.
- Production enables HSTS through Helmet and disables cross-origin API access.
- JSON bodies are limited to 1 MiB and URL-encoded bodies to 256 KiB.
- Express trusts one proxy hop; deploy with exactly the intended proxy topology so IP-based records are meaningful.
- Requests receive an `x-request-id` for logs and support correlation.
- Input schemas reject malformed values before data-layer operations.
- PostgreSQL queries use parameters and mutations that span resources use transactions.
- Configuration apply uses an advisory lock to serialize deployment changes.
- Optimistic versions prevent stale application, scope, and policy updates.

## SSRF protection

Webhook destinations must use HTTPS and may not contain URL credentials, use localhost or `.local`, or use a non-public literal IP. Immediately before delivery, Authometry resolves every address and rejects private or reserved ranges. Requests have a ten-second timeout.

DNS can change between resolution and connection in the underlying HTTP stack. For high-assurance deployments, add network egress policy that permits only required public destinations and blocks link-local, private, metadata, and control-plane ranges.

## Trace and audit data

Authorization and token traces replace fields whose names resemble authorization, cookie, password, secret, token, code, or assertion with `[redacted]` before persistence. Traces record validation steps, outcomes, timing, and corrective explanations. Audit events record successful management mutations with normalized paths and request IDs.

Redaction is a defense in depth control, not permission to put secrets into arbitrary fields. Avoid secrets in query parameter names, application names, custom claims, policy messages, and user-visible descriptions. Restrict trace and audit access to trusted roles and set retention periods appropriate to the data.

## Webhook verification

Authometry signs `<timestamp>.<raw-body>` with HMAC-SHA-256 and sends `x-authometry-signature: v1=<hex>`. Consumers should:

1. Read the unmodified request bytes.
2. Reject timestamps outside a short tolerance.
3. Recompute the signature using the stored webhook secret.
4. Compare signatures in constant time.
5. Deduplicate `x-authometry-delivery` before applying side effects.

Rotate a webhook by creating a new subscription/secret, updating the consumer, then retiring the old endpoint.

## Production checklist

- Use HTTPS for the public origin and all issuer, callback, and webhook URLs.
- Generate independent high-entropy installation secrets and store them in a secret manager.
- Set an imminent bootstrap expiry and remove or rotate the bootstrap token after first use.
- Keep PostgreSQL and the API service private.
- Configure platform-level rate limiting, request-size limits, and egress restrictions in addition to application controls.
- Limit administrator membership and personal-token scopes; expire and revoke unused tokens.
- Rotate client credentials and signing keys on a documented schedule.
- Back up PostgreSQL and the matching encryption key; test restores.
- Monitor readiness, authentication failures, denied traces, audit events, webhook failures, and worker errors.
- Run dependency, container, and secret scans in CI.
- Complete the repository conformance smoke and an approved end-to-end protocol verification before release.

## Reporting a vulnerability

Do not open a public issue containing exploit details, tokens, personal data, or deployment credentials. Contact the repository owner through a private security channel and include affected version, impact, reproduction steps, and any suggested mitigation. Revoke exposed material immediately rather than waiting for a code fix.
