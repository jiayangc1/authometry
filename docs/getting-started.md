# Getting started

Use Authometry Cloud and the CLI to provision OAuth for an application. The CLI creates the client and returns the selected environment's issuer, client ID, and one-time client secret; you do not need to run an authorization server locally.

## 1. Install the CLI

Install the current release with Homebrew:

```bash
brew install jiayangc1/tap/authometry
```

Or run it without a global install:

```bash
npx authometry@latest --help
```

Authometry Cloud at `https://authometry.ch3n.cc` and its `production` environment are the defaults.

## 2. Authorize the CLI

Create an API token under **Settings → API tokens**, then expose it only to the current shell or agent process:

```bash
export AUTHOMETRY_TOKEN=amt_your_token
```

The token needs `applications:read` and `applications:write` for client provisioning. Tokens created in Settings include those scopes. Use `AUTHOMETRY_ENVIRONMENT` or `--environment` only when targeting a non-default Cloud environment.

## 3. Determine the application's OAuth routes

Choose the application type that matches the runtime:

- `web` — a confidential server-side web application.
- `spa` — a public browser application using PKCE and no client secret.
- `native` — a public installed application using PKCE.
- `machine` — a confidential service using Client Credentials.
- `device` — an input-constrained client using Device Authorization.

For an interactive application, identify its exact callback and post-logout URLs. Local HTTP URLs are accepted only for `localhost`, `127.0.0.1`, and `::1`. Production URLs must use HTTPS.

## 4. Provision the application

Run one command from the application's repository:

```bash
npx authometry@latest apps create \
  --name "Customer Portal" \
  --type web \
  --redirect-uri http://localhost:3000/auth/callback \
  --post-logout-redirect-uri http://localhost:3000/ \
  --scope openid \
  --scope profile \
  --scope email \
  --output-env .env.local \
  --json
```

The command creates the OAuth client in Authometry Cloud and writes these values directly to the ignored environment file:

```dotenv
AUTHOMETRY_APPLICATION_ID="..."
AUTHOMETRY_ISSUER="https://authometry.ch3n.cc"
AUTHOMETRY_CLIENT_ID="..."
AUTHOMETRY_CLIENT_SECRET="..."
```

Public clients omit `AUTHOMETRY_CLIENT_SECRET`. The file is written with mode `0600`. The CLI preserves unrelated settings and refuses to replace existing Authometry values unless `--overwrite-env` is passed explicitly.

Add `--scope offline_access` only when the application securely stores and rotates refresh tokens. Repeat callback, logout, and scope flags when the application needs more than one value.

## 5. Implement the OIDC flow

Give an AI coding agent this prompt:

```text
Add Authometry OAuth to my app: https://authometry.ch3n.cc/SKILL.md
```

The skill tells the agent to inspect the app, run the CLI itself, select a maintained OIDC library, implement Authorization Code with S256 PKCE, protect sessions and callbacks, and run the repository's own checks.

For a manual implementation, load `${AUTHOMETRY_ISSUER}/.well-known/openid-configuration` and use the discovered endpoints. See [OAuth and OpenID Connect](oauth-and-oidc.md) for the complete protocol contract.

## Self-hosting

Self-hosting remains available for installations that need it. Pass `--server` or set `AUTHOMETRY_SERVER` to target that installation, and follow the [deployment guide](deployment.md). Cloud is the default onboarding path.

## Troubleshooting

### The CLI asks for a token

Set `AUTHOMETRY_TOKEN` in the process running the CLI. Do not put a management token in application source code or a committed environment file.

### The API token has insufficient scope

Create a new Settings token with `applications:read` and `applications:write`. Existing configuration-only tokens cannot provision OAuth clients.

### The environment file already has Authometry values

Inspect the existing client before replacing it. Pass `--overwrite-env` only when intentionally switching the application to the newly created client.

### A redirect URI is rejected

Use the complete externally visible callback URL. Scheme, host, port, path, query, trailing slash, and case must match exactly.
