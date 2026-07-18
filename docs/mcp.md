# MCP server

Authometry exposes a Model Context Protocol server at `/mcp` over Streamable HTTP. MCP clients authorize through Authometry's OAuth Authorization Code flow with S256 PKCE and an explicit admin consent screen. Read access and management access use separate OAuth scopes.

## Connect an MCP client

Point the client at the MCP URL on the environment's issuer:

```text
https://authometry.ch3n.cc/mcp
```

The client first receives a `401` challenge containing the protected-resource metadata URL and the requested `mcp:read mcp:write` scopes. It then discovers Authometry's authorization and token endpoints from OAuth or OpenID Provider metadata.

Authometry supports anonymous Dynamic Client Registration for public MCP clients. Registrations require exact HTTPS or loopback HTTP redirect URIs, Authorization Code, S256 PKCE, and no client secret. A pre-registered public application can also connect when it has the same redirect URI, grants, and scopes.

The client opens Authometry in the user's browser. After an Authometry administrator signs in, the consent page shows:

- The MCP client's registered name and whether it was dynamically registered.
- The canonical Authometry MCP resource receiving the token.
- `mcp:read` for applications, scopes, environments, and redacted traces.
- `mcp:write` for dashboard management actions such as creating services, editing applications, applying configuration, rotating keys, or revoking access.
- `offline_access` when the client requests a refresh token.

Approving returns a short-lived authorization code to the exact registered redirect URI. The client exchanges it with the original PKCE verifier and the same `resource` value:

```text
POST https://authometry.ch3n.cc/oauth/token
grant_type=authorization_code
client_id=amt_mcp_client_...
code=...
code_verifier=...
redirect_uri=http://127.0.0.1:PORT/callback
resource=https://authometry.ch3n.cc/mcp
```

The resulting access token is signed by Authometry, identifies the approving admin, contains the approved MCP scopes, and uses the MCP URL as its audience. `/mcp` rejects expired, revoked, wrong-issuer, wrong-audience, non-admin, and insufficient-scope tokens. Send the access token as `Authorization: Bearer ...` on every MCP request.

Connections that were approved before `mcp:write` was introduced remain read-only. Reconnect and approve the new scope before asking the agent to change anything.

When `offline_access` is approved, refresh requests must repeat the same `resource` value so renewed access tokens stay bound to the MCP server.

## Tools

| Tool                         | Purpose                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| `list_environments`          | List environments in the token's workspace.                     |
| `list_applications`          | Search OAuth applications and inspect non-secret configuration. |
| `list_scopes`                | List resource scopes, sensitivity, and application usage.       |
| `list_authorization_traces`  | Search recent redacted OAuth/OIDC traces.                       |
| `get_authorization_trace`    | Read one redacted trace with its explanation and steps.         |
| `list_management_operations` | List every dashboard API operation exposed through MCP.         |
| `management_api_read`        | Call any supported dashboard GET operation.                     |
| `management_api_write`       | Create, edit, revoke, rotate, apply, verify, or delete.         |

Tools that accept `environment` allow either a slug or UUID. If it is omitted, Authometry uses the workspace's default environment. Results are always constrained to the approving administrator's workspace.

`management_api_write` requires `mcp:write`. It accepts a concrete management `path`, a `POST`, `PATCH`, or `DELETE` method, and the same JSON body used by the website. Call `list_management_operations` first to discover the supported method and path templates. For example, an agent can create a machine service with `POST /applications`, read it with `GET /applications/:applicationId`, and edit it with `PATCH /applications/:applicationId` using its current optimistic `version`.

Management requests run through the same API handlers as the website. Role checks, workspace and environment boundaries, validation, manifest ownership, optimistic version checks, audit logging, and explicit confirmation fields for destructive actions still apply. Credential, webhook, and personal-token secrets are returned only once, just as they are in the dashboard.

## Transport behavior

The endpoint uses stateless Streamable HTTP and JSON responses. Clients must send `Content-Type: application/json` and advertise both `application/json` and `text/event-stream` in `Accept`, as required by the transport. HTTP `GET` and `DELETE` are not available on the MCP transport because the server does not provide server-initiated notifications or resumable sessions; management methods are arguments to the tools sent over MCP `POST`.

For a workspace-scoped issuer such as `https://authometry.ch3n.cc/w/acme`, use `https://authometry.ch3n.cc/w/acme/mcp`. Resource metadata and token audience validation follow that complete URL.
