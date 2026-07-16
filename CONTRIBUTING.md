# Contributing to Authometry

Authometry is security-sensitive infrastructure. Keep changes narrow, make protocol behavior explicit, and verify the complete workspace before requesting review.

## Development setup

Requirements: Node.js 24+, pnpm 11+, and PostgreSQL 18+.

```bash
cp .env.example .env
docker compose up -d postgres
corepack enable
pnpm install
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`. A new database must be bootstrapped at `/bootstrap?token=<BOOTSTRAP_TOKEN>` before dashboard and protocol routes have an environment.

## Repository map

- `apps/web` contains the Next.js dashboard and authorization UI.
- `apps/server` contains Express routes, OAuth behavior, migrations, and workers.
- `apps/cli` contains the manifest CLI.
- `packages/domain` contains shared models and schemas.
- `packages/config` contains manifest validation and planning.
- `packages/ui` contains shared UI primitives.
- `packages/test-support` contains deterministic fixtures.
- `tests` contains platform end-to-end coverage.

Read [Architecture](docs/architecture.md) before changing boundaries and [Security](docs/security.md) before changing authentication, tokens, redirects, encryption, outbound requests, or trace data.

## Working agreement

1. Start from a focused issue or describe the behavior and security impact in the pull request.
2. Preserve existing public behavior unless the change intentionally updates it.
3. Keep database changes additive. Never rewrite a migration already applied by another environment.
4. Validate external input at the route boundary and keep database queries parameterized.
5. Never log, trace, snapshot, or commit raw credentials or personal data.
6. Update repository and in-app documentation when a route, flow, manifest, environment variable, or operational procedure changes.
7. Use semantic commit messages such as `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, or `chore:`.

## Quality gates

Run the gates relevant to the change, then run the full non-browser suite before review:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The repository currently uses its configured Vitest workspace for unit and integration coverage. Add tests beside the implementation and prefer deterministic service-level tests for protocol logic.

End-to-end and production verification mutate a database and require additional setup. Run them only when the change needs full-flow verification and the target environment is disposable or explicitly approved:

```bash
pnpm test:e2e
pnpm conformance -- https://auth.example.com
```

Do not describe the conformance smoke as OpenID certification. Formal certification requires a successful OpenID Foundation conformance-suite submission.

## Database changes

Add the next numbered SQL file under `apps/server/migrations`. Migrations run transactionally under a PostgreSQL advisory lock before the API listens.

- Use constraints and foreign keys to preserve invariants.
- Consider existing data when adding non-null columns.
- Add indexes for new lookup and retention paths.
- Keep downgrade and recovery implications in the pull request description.
- Verify startup from both a new database and a database at the previous schema when practical.

## Protocol changes

OAuth and OIDC changes need negative cases, not only a successful flow. Check client authentication, route/issuer binding, exact redirect matching, PKCE, code replay, scope expansion, expiry, revocation, and redacted trace output as applicable.

Keep discovery metadata aligned with implemented behavior. Do not advertise a grant, response type, signing algorithm, authentication method, or prompt until the complete path is supported and verified.

## API and UI changes

Management API errors use the shared `{ error: { code, message, requestId, details? } }` envelope. Choose stable error codes and actionable messages without leaking internal data.

Dashboard mutations must remain same-origin, authenticated, CSRF-protected, environment-scoped, and audited. Preserve keyboard access, focus visibility, semantic labels, responsive layouts, loading states, and empty/error guidance.

## Documentation changes

Repository guides live under `docs`; concise operator entry points live in `README.md`; end-user documentation lives in `apps/web/src/config/documentation.ts`. Keep examples copyable, use placeholder origins and credentials, and verify every statement against the current code.

When adding a documentation page, add it to the appropriate in-app group and link the corresponding trace explanation when an error should take the operator there.

## Pull requests

Include:

- The problem and intended behavior.
- Security and compatibility impact.
- Migration or deployment requirements.
- Tests and commands run.
- Screenshots only when a visual change needs review.
- Documentation updated.

Keep unrelated cleanup out of the branch so reviewers can reason about the authorization behavior being changed.
