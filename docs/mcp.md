# MCP server

Authometry exposes a read-only Model Context Protocol server at `/mcp` over Streamable HTTP. It lets an MCP client inspect OAuth applications, resource scopes, environments, and redacted authorization traces without granting configuration mutation access.

## Authentication

Create an **MCP read-only** token under **Settings → API tokens**, copy its one-time `amt_...` value, and send it on every request:

```text
Authorization: Bearer amt_...
```

The token must have the `mcp:read` scope. MCP requests do not accept dashboard cookies, and the server never returns client secrets or unredacted authorization inputs.

Use the same public origin as the dashboard:

```text
https://auth.example.com/mcp
```

Configure your MCP client with that URL and an `Authorization` header sourced from a secret or environment variable. Do not commit the token to a client configuration file.

## Tools

| Tool                        | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `list_environments`         | List environments in the token's workspace.                     |
| `list_applications`         | Search OAuth applications and inspect non-secret configuration. |
| `list_scopes`               | List resource scopes, sensitivity, and application usage.       |
| `list_authorization_traces` | Search recent redacted OAuth/OIDC traces.                       |
| `get_authorization_trace`   | Read one redacted trace with its explanation and steps.         |

Tools that accept `environment` allow either a slug or UUID. If it is omitted, Authometry uses the workspace's default environment. Results are always constrained to the personal token's workspace.

## Transport behavior

The endpoint uses stateless Streamable HTTP and JSON responses. Clients must send `Content-Type: application/json` and advertise both `application/json` and `text/event-stream` in `Accept`, as required by the transport. `GET` and `DELETE` are not available because this read-only server does not provide server-initiated notifications or resumable sessions.
