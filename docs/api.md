# Management API

The management API powers the dashboard and configuration CLI. It is versioned under `/api/v1` and is distinct from the standards-based `/oauth` endpoints.

This document catalogs the implemented surface. Route input and output may grow before a stable public SDK release; integrations should ignore unknown response fields and handle structured errors.

## Base URL

Use the same public origin as the dashboard:

```text
https://authometry.ch3n.cc/api/v1
```

The web service proxies this path to the private API. Do not point browser integrations at the private container address.

## Authentication

### Dashboard sessions

Interactive login issues three cookies:

- `authometry_admin_access` — signed, HTTP-only access JWT with a ten-minute lifetime.
- `authometry_admin_refresh` — signed, HTTP-only rotating session envelope with a 30-day lifetime.
- `authometry_csrf` — readable signed CSRF token.

For state-changing requests, copy the decoded CSRF cookie value to `x-authometry-csrf`. Access and refresh cookies are sent automatically by a same-origin browser.

### Personal access tokens

Create a token under **Settings → API tokens** and send it as a bearer value:

```bash
curl \
  -H "authorization: Bearer $AUTHOMETRY_TOKEN" \
  -H "x-authometry-environment: production" \
  https://authometry.ch3n.cc/api/v1/config/status
```

Personal tokens begin with `amt_`, are shown once, stored only as hashes, and may have an expiry. Configuration endpoints enforce `config:read` on GET/HEAD and `config:write` on mutations. Application endpoints enforce `applications:read` on GET/HEAD and `applications:write` on mutations. Personal tokens do not require cookie CSRF. The MCP endpoint uses its separate OAuth admin-consent flow rather than personal tokens.

## Environment selection

Authenticated management routes resolve an environment within the token's current workspace. Select it with:

```text
x-authometry-environment: production
```

The value may be an environment slug or UUID. If omitted, the workspace's default environment is used. The `environment` query parameter is a lower-precedence alternative.

## Request IDs and errors

Send an optional `x-request-id`; otherwise Authometry creates one. The same ID is returned in the response header and error body.

```json
{
  "error": {
    "code": "environment_not_found",
    "message": "The selected environment was not found.",
    "requestId": "req_a1b2c3d4e5f6g7h8"
  }
}
```

Validation failures use HTTP 422 and include Zod field details. Authentication, authorization, conflict, not-found, rate-limit, and internal failures use appropriate 4xx or 5xx statuses. Client code should branch on `error.code` and record `requestId` for investigation.

## Authentication and workspace endpoints

These routes are mounted under `/api/v1/auth`. Login and recovery routes are rate-limited.

| Method | Path                          | Purpose                                                                                                |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| GET    | `/auth/bootstrap/status`      | Report whether first-owner bootstrap is available.                                                     |
| POST   | `/auth/bootstrap`             | Create the first owner, workspace, default environment, scopes, and key. Requires `x-bootstrap-token`. |
| GET    | `/auth/providers`             | Report which social providers are available for dashboard sign-in.                                     |
| GET    | `/auth/social/:provider`      | Begin a PKCE-protected Google or GitHub dashboard sign-in.                                             |
| GET    | `/auth/connections`           | List social providers linked to the current dashboard account.                                         |
| POST   | `/auth/connections/:provider` | Begin linking a provider to the current dashboard account.                                             |
| DELETE | `/auth/connections/:provider` | Disconnect a provider from the current dashboard account.                                              |
| POST   | `/auth/login`                 | Authenticate an owner or member and issue session cookies.                                             |
| POST   | `/auth/forgot-password`       | Create and, when SMTP is enabled, deliver a reset link.                                                |
| POST   | `/auth/reset-password`        | Consume a reset token and set a new password.                                                          |
| GET    | `/auth/invitation?token=...`  | Inspect an account invitation.                                                                         |
| POST   | `/auth/invitation`            | Accept an invitation and establish the account password.                                               |
| POST   | `/auth/refresh`               | Rotate the administrative refresh session and cookies.                                                 |
| POST   | `/auth/logout`                | Revoke the administrative session and clear cookies.                                                   |
| GET    | `/auth/me`                    | Return current user, workspace, role, and available workspaces.                                        |
| POST   | `/auth/switch-workspace`      | Change the workspace encoded in the administrative session.                                            |
| POST   | `/auth/workspaces`            | Create another workspace and its default environment.                                                  |

Passwords are normalized emails plus a 12–128 character password. Social dashboard sign-in requires
an existing, enabled administrator whose email exactly matches the provider's verified email; it
never creates a privileged account. The first successful match records the provider identity so
future provider and password sign-ins resolve to the same administrator. An authenticated
administrator can also explicitly connect a provider under **Settings → My account**. Bootstrap is
accepted only before an owner exists and before the configured token expiry.

## Dashboard resources

All paths below are relative to `/api/v1` and require authentication, CSRF for cookie mutations, and a resolved environment.

| Method | Path                                                            | Purpose                                                                |
| ------ | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| GET    | `/overview`                                                     | Counts, recent activity, and request metrics.                          |
| GET    | `/applications`                                                 | List applications in the selected environment.                         |
| POST   | `/applications`                                                 | Create an application and return its Cloud credentials once.           |
| POST   | `/applications/slug`                                            | Produce a normalized slug preview from a name.                         |
| GET    | `/applications/:applicationId`                                  | Read application configuration and credentials.                        |
| PATCH  | `/applications/:applicationId`                                  | Update dashboard-owned application fields using optimistic versioning. |
| POST   | `/applications/:applicationId/credentials`                      | Create a client credential and return the raw secret once.             |
| POST   | `/applications/:applicationId/credentials/:credentialId/revoke` | Revoke a client credential.                                            |
| GET    | `/agents`                                                       | List registered agent identities and active-grant counts.              |
| POST   | `/agents`                                                       | Register an agent, OAuth client, public JWK, and authority ceilings.   |
| GET    | `/agents/:agentId`                                              | Read an agent registration.                                            |
| POST   | `/agents/:agentId/disable`                                      | Kill-switch an agent and recursively revoke its grant descendants.     |
| POST   | `/agents/:agentId/enable`                                       | Re-enable a disabled agent for new requests.                           |
| POST   | `/agents/:agentId/rotate-key`                                   | Replace an agent's public authentication JWK.                          |
| GET    | `/agent-grants`                                                 | List task grants with subjects, actors, resources, and limits.         |
| POST   | `/agent-grants/:grantId/revoke`                                 | Recursively revoke a grant and all delegated descendants.              |
| POST   | `/agent-grants/:grantId/usage`                                  | Atomically consume usage across the complete grant ancestry.           |
| GET    | `/traces`                                                       | List redacted authorization and token traces.                          |
| GET    | `/traces/:traceId`                                              | Read trace steps, decisions, timing, and explanation.                  |
| GET    | `/users`                                                        | List identity users.                                                   |
| POST   | `/users`                                                        | Create a password identity user.                                       |
| GET    | `/users/:userId`                                                | Read a user and related sessions/events.                               |
| DELETE | `/users/:userId`                                                | Permanently delete a user and notify provisioning connections.         |
| GET    | `/sessions`                                                     | List identity sessions.                                                |
| POST   | `/sessions/:sessionId/revoke`                                   | Revoke a session and its refresh family.                               |
| GET    | `/scopes`                                                       | List built-in and custom scopes.                                       |
| POST   | `/scopes`                                                       | Create a custom scope.                                                 |
| PATCH  | `/scopes/:scopeId`                                              | Update a dashboard-owned scope using optimistic versioning.            |
| GET    | `/policies`                                                     | List policies and assigned applications.                               |
| POST   | `/policies`                                                     | Create an authorization policy.                                        |
| GET    | `/policies/:policyId`                                           | Read a policy.                                                         |
| PATCH  | `/policies/:policyId`                                           | Update a dashboard-owned policy using optimistic versioning.           |
| GET    | `/events`                                                       | List audit events.                                                     |
| GET    | `/environments`                                                 | List workspace environments.                                           |
| GET    | `/search?q=...`                                                 | Search applications, users, traces, and settings destinations.         |

Application, scope, and policy mutations validate resource ownership. Manifest-owned fields must be changed through configuration as code. Versioned PATCH requests that use a stale `version` return a conflict rather than overwriting another update.

## Configuration endpoints

| Method | Path                  | Required token scope | Purpose                                                               |
| ------ | --------------------- | -------------------- | --------------------------------------------------------------------- |
| GET    | `/config/export`      | `config:read`        | Return normalized manifests; `?format=yaml` returns export documents. |
| POST   | `/config/apply`       | `config:write`       | Validate and atomically apply manifests and resolved secrets.         |
| GET    | `/config/status`      | `config:read`        | Compare current resources with the last applied snapshot.             |
| GET    | `/config/deployments` | `config:read`        | List the latest 100 configuration deployments.                        |

Use the official workspace CLI instead of constructing apply payloads by hand. It performs local relationship validation, secret resolution, comparison normalization, and confirmation.

## Settings endpoints

| Method     | Path                                 | Purpose                                                                  |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------ |
| GET, PATCH | `/settings/general`                  | Read or update workspace display and retention settings.                 |
| GET        | `/settings/providers`                | Report whether Google, GitHub, and SMTP are configured.                  |
| GET, POST  | `/settings/domains`                  | List or add custom domains.                                              |
| POST       | `/settings/domains/:domainId/verify` | Check the domain's DNS verification record.                              |
| GET        | `/settings/signing-keys`             | List active, retiring, and retired keys.                                 |
| POST       | `/settings/signing-keys/rotate`      | Rotate the selected environment's signing key.                           |
| GET, POST  | `/settings/webhooks`                 | List or create signed webhook subscriptions.                             |
| GET, POST  | `/settings/provisioning`             | List or create signed account provisioning connections.                  |
| POST       | `/settings/provisioning/:id/sync`    | Queue all existing users for one provisioning connection.                |
| DELETE     | `/settings/provisioning/:id`         | Stop future lifecycle delivery to a connected service.                   |
| GET, POST  | `/settings/members`                  | List members or invite/update a member.                                  |
| PATCH      | `/settings/members/:memberId`        | Change a membership role; owner-only.                                    |
| GET, POST  | `/settings/tokens`                   | List personal tokens or create one and return it once.                   |
| POST       | `/settings/tokens/:tokenId/revoke`   | Revoke one of the current user's tokens.                                 |
| GET        | `/settings/danger`                   | Read destructive-operation context.                                      |
| POST       | `/settings/danger/status`            | Enable or disable installation-wide authorization traffic; owner-only.   |
| DELETE     | `/settings/danger/workspace`         | Permanently delete the current workspace after confirmation; owner-only. |

General settings, domains, key rotation, and invitations require owner or administrator roles. Webhook creation also allows developers. Membership role changes and danger operations require the owner.

## Account provisioning

Provisioning connections are configured separately from general-purpose webhooks. Creating a connection fixes its subscription to `user.created` and `user.deleted`, returns a signing secret once, and can queue existing users immediately with `syncExistingUsers` (enabled by default). A later `POST` to the connection's `/sync` endpoint queues another upsert-style `user.created` delivery for every current user.

Lifecycle deliveries use the standard signed webhook headers and this body shape:

```json
{
  "id": "EVENT_UUID",
  "type": "user.created",
  "summary": "person@example.com created",
  "severity": "info",
  "resourceType": "user",
  "resourceId": "USER_UUID",
  "environment": {
    "id": "ENVIRONMENT_UUID",
    "slug": "production",
    "issuer": "https://auth.example.com"
  },
  "data": {
    "user": {
      "id": "USER_UUID",
      "email": "person@example.com",
      "name": "Example Person",
      "groups": ["members"],
      "status": "active",
      "emailVerified": true
    }
  },
  "createdAt": "2026-07-19T10:30:00.000Z"
}
```

Receivers should key managed identities by `environment.issuer` plus `data.user.id`, treat `user.created` as an idempotent upsert, and deprovision that identity on `user.deleted`. Authometry never includes a password, password hash, token, or other login credential. Delivery is asynchronous: deletion in Authometry is not rolled back if a connected service is temporarily unavailable, so receivers must accept retries and operators should monitor failed deliveries.

## Webhooks

Webhook bodies describe audit events and include `id`, `type`, `summary`, `severity`, resource identifiers, the selected environment, and `createdAt`. User lifecycle bodies also include the credential-free `data.user` object documented above. Deliveries include:

```text
x-authometry-delivery: DELIVERY_ID
x-authometry-event: EVENT_TYPE
x-authometry-timestamp: UNIX_SECONDS
x-authometry-signature: v1=HEX_HMAC_SHA256
```

Verify the signature over `<timestamp>.<raw-request-body>` with the webhook secret, compare it in constant time, reject stale timestamps, and deduplicate delivery IDs. Destinations must use HTTPS, cannot contain credentials, and must resolve only to public unicast addresses.

Failed deliveries use exponential retry delays and are attempted up to the worker's bounded retry limit. Response bodies retained for diagnostics are capped at 4096 characters.
