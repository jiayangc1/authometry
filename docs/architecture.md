# Architecture

Authometry separates the public web surface from the protocol and data service while keeping browser traffic same-origin.

## Runtime topology

```text
Browser, OAuth client, or MCP client
        |
        v
Web origin (Next.js, port 3000)
        |  rewrites /api, /oauth, /.well-known, /health
        v
Express API (port 4000)
        |
        +-- PostgreSQL
        +-- SMTP server (optional)
        +-- webhook destinations
```

The web service renders the administration, bootstrap, login, consent, and device pages. Its rewrite layer forwards protocol and API requests to the private Express service. Production should expose the web service and keep the API address private.

## Applications and packages

### `apps/web`

A Next.js App Router application. Protected dashboard paths are guarded by the presence of an administrative access or refresh cookie; the API remains authoritative and validates every session. Server rewrites preserve a single public issuer and avoid cross-origin browser credentials in production.

### `apps/server`

An Express service containing:

- OAuth/OIDC discovery, authorization, token, UserInfo, device, revocation, introspection, and logout routes.
- A stateless Streamable HTTP MCP endpoint authenticated by scoped personal access tokens.
- Administrative authentication and management APIs.
- Manifest export, transactional apply, drift status, and deployment history.
- PostgreSQL migrations and periodic webhook and retention workers.
- Token signing, hashing, encryption, policy evaluation, claims, email, and trace recording.

The service runs migrations before listening. Webhook delivery is attempted at startup and every 30 seconds. Retention runs at startup and hourly.

### `apps/cli`

A Commander-based Node.js CLI for local manifest validation and remote plan, diff, apply, status, and export operations. It resolves secret references locally and sends values only during apply.

### Shared packages

- `@authometry/domain` owns shared Zod schemas, TypeScript models, and trace types.
- `@authometry/config` owns manifest schemas, directory loading, secret references, serialization, relationship validation, and planning.
- `@authometry/ui` owns reusable React UI primitives.
- `@authometry/test-support` owns deterministic test fixtures and environment setup.

## Tenancy and issuer routing

Data belongs to a workspace and, for protocol resources, an environment. Administrative requests select an environment by `x-authometry-environment` or the `environment` query parameter; the value may be an environment UUID or slug and must belong to the authenticated workspace.

Protocol endpoints are mounted at four shapes:

- `/oauth/...` and `/.well-known/...` for the default environment.
- `/:environmentSlug/oauth/...` for an environment on the public host.
- `/w/:workspaceSlug/oauth/...` for a workspace's default environment.
- `/w/:workspaceSlug/:environmentSlug/oauth/...` for an explicit workspace and environment.

The environment's stored issuer must equal the public URL used by clients. Discovery derives endpoint URLs from that issuer.

## Request paths

### Administrative request

1. The browser sends signed access and refresh cookies, or the CLI sends an `amt_...` bearer token.
2. The server authenticates the user or personal access token and loads workspace membership.
3. Mutating browser requests pass double-submit CSRF validation. Bearer-token requests do not use cookie CSRF.
4. Environment middleware resolves the requested environment within the workspace.
5. The route validates input with Zod, performs its PostgreSQL operation, and records an audit event for mutations.
6. Errors use a stable JSON envelope and include the request ID.

### Authorization Code request

1. `/oauth/authorize` resolves the issuer environment and validates client, response type, exact redirect URI, scopes, PKCE, prompt, and OIDC parameters.
2. Authometry creates a pending authorization request and a redacted trace.
3. The authorization UI authenticates the identity user and evaluates applicable policies.
4. Consent is requested when required and not already granted.
5. A single-use authorization code is returned to the exact registered redirect URI.
6. `/oauth/token` authenticates the client, consumes the code, verifies the PKCE verifier, and issues signed access and ID tokens plus an opaque rotating refresh token when requested.

## Persistence model

PostgreSQL is the source of truth. Major record groups include:

- Workspaces, administrators, memberships, admin refresh sessions, and personal access tokens.
- Environments, instance settings, domains, signing keys, and provider configuration state.
- Identity users, social identities, one-time links, sessions, and consent grants.
- Applications, credentials, scopes, policies, and claim mappings.
- Authorization codes, refresh families and tokens, device authorizations, and access-token revocations.
- Authorization traces, audit events, webhooks and deliveries, configuration snapshots, and deployments.

Foreign keys generally cascade within a workspace or environment. Optimistically updated resources carry a version number to reject stale writes.

## Configuration ownership

Applications, scopes, policies, and claims have either `dashboard` or `manifest` ownership. Applying a manifest makes its managed representation authoritative and records the source path and deployment provenance. Manifest-owned fields are read-only in the dashboard. Export converts dashboard-managed resources to YAML so they can enter the Git workflow.

## Security boundaries

Raw authorization codes, refresh tokens, session tokens, personal access tokens, client credentials, one-time links, and webhook secrets are not stored directly. Private signing keys and webhook secrets are encrypted with the installation key. Trace input is redacted before persistence. See [Security](security.md) for the complete model.
