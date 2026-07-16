# Getting started

This guide creates a local Authometry installation, bootstraps its first owner, and prepares it to issue tokens.

## Prerequisites

- Node.js 24 or newer.
- pnpm 11.8 or a compatible pnpm 11 release. Corepack can install the version pinned in `package.json`.
- PostgreSQL 18 or Docker and Docker Compose.

## 1. Configure the environment

Copy the example file and keep the resulting `.env` file out of source control.

```bash
cp .env.example .env
```

The development defaults describe two processes: the public web origin at `http://localhost:3000` and the API at `http://localhost:4000`. Replace every `replace-with-...` value before using the installation outside an isolated local machine.

Generate random values with Node.js:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Use independent values for `COOKIE_SECRET`, `CSRF_SECRET`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `TOKEN_HMAC_KEY`, and `BOOTSTRAP_TOKEN`. Generate the installation encryption key as base64:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

`BOOTSTRAP_TOKEN_EXPIRES_AT` must be a future ISO 8601 timestamp in production. Bootstrap also becomes unavailable as soon as an owner exists.

## 2. Start PostgreSQL

The repository Compose file starts only PostgreSQL, exposes it on port 5432, and persists data in the `authometry-postgres` volume.

```bash
docker compose up -d postgres
docker compose ps
```

If PostgreSQL is already running locally, set `DATABASE_URL` to that database instead.

## 3. Install, migrate, and run

```bash
corepack enable
pnpm install
pnpm db:migrate
pnpm dev
```

`pnpm dev` starts the Express API on port 4000 and the Next.js application on port 3000. The web process rewrites `/api`, `/oauth`, `/.well-known`, and `/health` requests to `INTERNAL_API_ORIGIN`, so browser-facing calls remain same-origin.

Confirm both services:

```bash
curl http://localhost:3000/health/live
curl http://localhost:3000/.well-known/openid-configuration
```

The liveness response does not touch PostgreSQL. Use `/health/ready` when readiness must include a database query.

## 4. Bootstrap the installation

Open:

```text
http://localhost:3000/bootstrap?token=YOUR_BOOTSTRAP_TOKEN
```

Create the first owner and workspace. Bootstrap creates the owner account, a default production environment, built-in OIDC scopes, and the environment's initial signing key. The owner password must contain at least 12 characters.

After bootstrap, sign in at `/login`. Administrative sessions use short-lived access and rotating refresh cookies; state-changing dashboard requests also require the CSRF token issued by the server.

## 5. Register a client

In **Applications**, create a client and choose the type that matches its runtime:

- `web` — a confidential server-side web application.
- `spa` — a public browser application; use PKCE and no client secret.
- `native` — a public installed application; use PKCE.
- `machine` — a confidential service using Client Credentials.
- `device` — a client using Device Authorization.

Register every callback exactly as the client sends it. Authometry compares the complete URI, including scheme, host, port, path, and query. Save a generated client secret immediately; raw secrets are returned only when created.

For a web client, begin authorization at `/oauth/authorize`, exchange the returned code at `/oauth/token`, and use the access token at `/oauth/userinfo`. See [OAuth and OpenID Connect](oauth-and-oidc.md) for complete examples.

## Optional integrations

Google and GitHub login are disabled until both the client ID and client secret for that provider are set. SMTP mail is disabled until `SMTP_HOST` is configured; invitations and password-reset flows that require delivery will report that mail is unavailable.

Restart the API after changing environment variables.

## Troubleshooting

### The bootstrap page says bootstrap is unavailable

Bootstrap is one-time only. Check `/api/v1/auth/bootstrap/status`. If an owner already exists, sign in or use the password-reset workflow. Do not delete production identity records to repeat bootstrap.

### The API reports an invalid environment

Dashboard requests select an environment using `x-authometry-environment`; the CLI defaults to the `production` slug. Pass `--environment <slug-or-id>` or set `AUTHOMETRY_ENVIRONMENT` when your environment has another name.

### A redirect URI is rejected

Compare the requested `redirect_uri` byte-for-byte with the application's registered URI. Localhost and `127.0.0.1`, omitted and explicit ports, trailing slashes, and different query strings are distinct.

### The web application cannot reach the API

For local development, keep `INTERNAL_API_ORIGIN=http://localhost:4000`. In containers it must be an address resolvable from the web container, not the browser's public address.

### PostgreSQL is not ready

Check `docker compose ps`, then inspect the database URL and credentials. Migrations are safe to rerun; the migrator records applied files and uses a PostgreSQL advisory lock.
