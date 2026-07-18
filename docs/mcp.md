# MCP server

Authometry exposes a read-only Model Context Protocol server at `/mcp` over Streamable HTTP. MCP clients authorize through Authometry's OAuth Authorization Code flow with S256 PKCE and an explicit admin consent screen.

## Connect an MCP client

Point the client at the MCP URL on the environment's issuer:

```text
https://auth.example.com/mcp
```

The client first receives a `401` challenge containing the protected-resource metadata URL and the required `mcp:read` scope. It then discovers Authometry's authorization and token endpoints from OAuth or OpenID Provider metadata.

Authometry supports anonymous Dynamic Client Registration for public MCP clients. Registrations require exact HTTPS or loopback HTTP redirect URIs, Authorization Code, S256 PKCE, and no client secret. A pre-registered public application can also connect when it has the same redirect URI, grants, and scopes.

The client opens Authometry in the user's browser. After an Authometry administrator signs in, the consent page shows:

- The MCP client's registered name and whether it was dynamically registered.
- The canonical Authometry MCP resource receiving the token.
- `mcp:read` for applications, scopes, environments, and redacted traces.
- `offline_access` when the client requests a refresh token.

Approving returns a short-lived authorization code to the exact registered redirect URI. The client exchanges it with the original PKCE verifier and the same `resource` value:

```text
POST https://auth.example.com/oauth/token
grant_type=authorization_code
client_id=amt_mcp_client_...
code=...
code_verifier=...
redirect_uri=http://127.0.0.1:PORT/callback
resource=https://auth.example.com/mcp
```

The resulting access token is signed by Authometry, identifies the approving admin, includes `mcp:read`, and uses the MCP URL as its audience. `/mcp` rejects expired, revoked, wrong-issuer, wrong-audience, non-admin, and insufficient-scope tokens. Send the access token as `Authorization: Bearer ...` on every MCP request.

When `offline_access` is approved, refresh requests must repeat the same `resource` value so renewed access tokens stay bound to the MCP server.

## Tools

| Tool                        | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `list_environments`         | List environments in the token's workspace.                     |
| `list_applications`         | Search OAuth applications and inspect non-secret configuration. |
| `list_scopes`               | List resource scopes, sensitivity, and application usage.       |
| `list_authorization_traces` | Search recent redacted OAuth/OIDC traces.                       |
| `get_authorization_trace`   | Read one redacted trace with its explanation and steps.         |

Tools that accept `environment` allow either a slug or UUID. If it is omitted, Authometry uses the workspace's default environment. Results are always constrained to the approving administrator's workspace.

## Transport behavior

The endpoint uses stateless Streamable HTTP and JSON responses. Clients must send `Content-Type: application/json` and advertise both `application/json` and `text/event-stream` in `Accept`, as required by the transport. `GET` and `DELETE` are not available because this read-only server does not provide server-initiated notifications or resumable sessions.

For a workspace-scoped issuer such as `https://auth.example.com/w/acme`, use `https://auth.example.com/w/acme/mcp`. Resource metadata and token audience validation follow that complete URL.
