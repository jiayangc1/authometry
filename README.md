# Authometry

Authometry is an inspectable OAuth 2.0 and OpenID Connect authorization platform. It combines a Next.js administration and authorization interface, an Express protocol server, PostgreSQL persistence, Git-native configuration, and a Node.js CLI.

> Authometry includes conformance-oriented tests but does not claim official OpenID certification. Certification requires a separate successful submission to the OpenID Foundation.

## Workspace

- `apps/web` — Next.js App Router dashboard, bootstrap, login, consent, and device UI.
- `apps/server` — Express management API, OAuth/OIDC endpoints, migrations, security controls, and traces.
- `apps/cli` — `authometry` configuration CLI.
- `packages/domain` — shared Zod contracts and protocol models.
- `packages/config` — manifest parsing, validation, planning, secret references, and diffs.
- `packages/ui` — Authometry's instrument-like UI primitives and authorization aperture mark.
- `packages/test-support` — deterministic test setup and fixtures.

## Local development

Requirements: Node.js 24+, pnpm 11+, and PostgreSQL 18+.

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm db:migrate
pnpm dev
```

The web application runs on `http://localhost:3000`; the private API runs on `http://localhost:4000`. Open `/bootstrap?token=<BOOTSTRAP_TOKEN>` to create the first owner. The bootstrap token is accepted only before an owner exists and, when configured, before `BOOTSTRAP_TOKEN_EXPIRES_AT`.

## Quality gates

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Playwright tests require a disposable PostgreSQL database and are intended for CI and release verification. Production container targets are `web` and `server` in the root `Dockerfile`.

## Protocol surface

- `/.well-known/openid-configuration`
- `/.well-known/jwks.json`
- `/oauth/authorize`
- `/oauth/token`
- `/oauth/userinfo`
- `/oauth/device/authorization`
- `/oauth/device`
- `/oauth/revoke`
- `/oauth/introspect`
- `/oauth/logout`

Authorization Code with S256 PKCE, rotating refresh tokens with family reuse detection, client credentials, and Device Authorization Grant are supported. Implicit and password grants are rejected. Access and ID tokens are RS256 JWTs; refresh, code, session, verification, reset, CLI, and secret values are opaque and stored only as hashes.

## Git-native configuration

Manifests use `authometry.dev/v1alpha1` and support `AuthometryInstance`, `Application`, `Scope`, `Policy`, and `ClaimMapping`. Dashboard-owned resources remain editable and exportable; manifest-owned fields are read-only and carry provenance.

```bash
authometry init
authometry validate
authometry plan --server https://authometry.ch3n.cc --token "$AUTHOMETRY_TOKEN"
authometry apply --server https://authometry.ch3n.cc --token "$AUTHOMETRY_TOKEN"
authometry status --server https://authometry.ch3n.cc --token "$AUTHOMETRY_TOKEN"
```

`apply` validates and resolves secret references locally, then performs the complete plan in one database transaction under an advisory lock. Raw secrets are omitted from configuration snapshots and deployment provenance.

## Production configuration

Required runtime-only variables:

- `DATABASE_URL`
- `PUBLIC_ORIGIN`
- `COOKIE_SECRET`, `CSRF_SECRET`
- `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`
- `INSTALLATION_ENCRYPTION_KEY`, `TOKEN_HMAC_KEY`
- `BOOTSTRAP_TOKEN`, `BOOTSTRAP_TOKEN_EXPIRES_AT`

The web service also needs the non-secret `INTERNAL_API_ORIGIN` during its image build so Next.js can compile private proxy rewrites. Google, GitHub, and SMTP remain disabled until all associated runtime values are supplied.

Migrations run transactionally under PostgreSQL advisory lock before the API begins listening. Private signing JWKs and webhook secrets use AES-256-GCM under the installation encryption key. Keep that key in the platform secret store and include it in disaster-recovery procedures.

## Backup and restore

Production uses a daily complete PostgreSQL backup at `03:00 UTC` with the latest 14 successful copies retained.

Restore procedure:

1. Disable the API and web services or put the environment into maintenance mode.
2. Create a safety backup of the current database.
3. Restore the selected Coolify PostgreSQL backup into the `authometry` database.
4. Confirm that the installation encryption key matches the restored signing-key ciphertext.
5. Start the API and verify `/health/ready`; the migration lock safely applies only migrations newer than the backup.
6. Start the web service, verify discovery/JWKS, complete a PKCE flow, and inspect the resulting trace.

Never restore production data into a shared development database. Tokens and sessions from a restored snapshot should be revoked when compromise is suspected.

## License

AGPL-3.0-only.
