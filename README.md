# Authometry

Authometry is an inspectable OAuth 2.0 and OpenID Connect authorization platform. It combines a Next.js administration and authorization interface, an Express protocol server, PostgreSQL persistence, Git-native configuration, and a Node.js CLI.

> Authometry includes conformance-oriented tests but does not claim official OpenID certification. Certification requires a separate successful submission to the OpenID Foundation.

## Start here

- [Getting started](docs/getting-started.md) — install, configure, bootstrap, and run Authometry locally.
- [Architecture](docs/architecture.md) — services, packages, request paths, tenancy, and persistence.
- [OAuth and OpenID Connect](docs/oauth-and-oidc.md) — issuer URLs, supported grants, endpoints, clients, and security behavior.
- [Configuration as code](docs/configuration.md) — CLI workflow, manifest reference, ownership, secrets, and CI usage.
- [Management API](docs/api.md) — authentication, environment selection, errors, and endpoint catalog.
- [MCP server](docs/mcp.md) — connect an AI client to read-only Authometry tools over Streamable HTTP.
- [Security](docs/security.md) — trust boundaries, token storage, encryption, CSRF, redaction, and key rotation.
- [Deployment and operations](docs/deployment.md) — containers, environment variables, health checks, migrations, backup, and recovery.
- [Contributing](CONTRIBUTING.md) — repository workflow and quality gates.
- [Conformance plan](conformance/README.md) — supported OpenID Foundation test profiles and exclusions.

## Capabilities

- Authorization Code flow with mandatory S256 PKCE support.
- Rotating refresh tokens with token-family reuse detection.
- Client Credentials and Device Authorization grants.
- OIDC discovery, JWKS, ID tokens, UserInfo, revocation, introspection, and RP-initiated logout.
- Exact redirect URI matching, consent records, policy evaluation, and custom claim mappings.
- Registered agent identities, pushed task authorization, actor-aware DPoP tokens, delegation grants, and reduced one-level token exchange.
- Per-request authorization traces with secret redaction and corrective explanations.
- Read-only MCP tools for applications, scopes, environments, and redacted authorization traces.
- Dashboard and Git-managed applications, scopes, policies, claims, and instance settings.
- Workspaces, environments, role-based administration, personal access tokens, audit events, webhooks, and signing-key rotation.

## Quick start

Requirements: Node.js 24+, pnpm 11+, Docker, and Docker Compose.

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000/bootstrap?token=<BOOTSTRAP_TOKEN>` and create the first owner. The dashboard is served at `http://localhost:3000`; in development the API listens on `http://localhost:4000` and the web application proxies same-origin API and protocol requests to it.

See [Getting started](docs/getting-started.md) for secret generation, first-client setup, and troubleshooting.

## CLI installation

Install the configuration CLI with Homebrew on macOS or Linux:

```bash
brew install jiayangc1/tap/authometry
```

Or run it without installing through npm:

```bash
npx authometry --help
```

See [Configuration as code](docs/configuration.md) for npm, pnpm, Yarn, and Bun options plus the complete command reference.

## Workspace

- `apps/web` — dashboard, bootstrap, login, consent, and device UI.
- `apps/server` — management API, OAuth/OIDC endpoints, migrations, security controls, and workers.
- `apps/cli` — the `authometry` configuration CLI.
- `packages/domain` — shared contracts and protocol models.
- `packages/config` — manifest parsing, validation, planning, secret references, and diffs.
- `packages/ui` — shared UI primitives and brand components.
- `packages/test-support` — deterministic fixtures and test setup.
- `scripts` — conformance and production verification programs.
- `tests` — end-to-end platform coverage.

## Common commands

```bash
pnpm dev             # run API and web development servers
pnpm db:migrate      # apply pending PostgreSQL migrations
pnpm format:check    # check Prettier formatting
pnpm lint            # run ESLint
pnpm typecheck       # type-check every workspace
pnpm test            # run unit and integration tests
pnpm build           # build every application and package
pnpm test:e2e        # run the Playwright platform suite
pnpm conformance -- https://authometry.ch3n.cc
```

## License

Authometry is licensed under the [GNU Affero General Public License v3.0 only](LICENSE).
