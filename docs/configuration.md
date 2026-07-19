# Configuration as code

Authometry manifests make authorization-server configuration reviewable in Git. The CLI validates locally, compares desired resources with an environment, applies the complete plan transactionally, and records deployment provenance without persisting raw secret values in snapshots.

## CLI setup

Install with Homebrew on macOS or Linux:

```bash
brew install jiayangc1/tap/authometry
```

Alternatively, run the CLI directly through npm or install it globally:

```bash
npx authometry --help
npm install --global authometry
```

The same package is available through other JavaScript package managers:

```bash
pnpm dlx authometry --help
yarn dlx authometry --help
bunx authometry --help
```

Contributors can build the workspace CLI with `pnpm --filter @authometry/cli build`.
Authometry Cloud is the default server. Provide a personal access token and optionally select a non-default environment:

```bash
export AUTHOMETRY_TOKEN=amt_your_token
export AUTHOMETRY_ENVIRONMENT=production
```

The token needs `config:read` for plan, diff, status, and export; `config:write` for apply; `applications:read` to inspect OAuth clients; and `applications:write` to provision them. Settings creates tokens with these scopes by default.

Every command also accepts `--server`, `--token`, and `--environment`. The server defaults to `https://authometry.ch3n.cc`; override it only for self-hosted installations. The environment may be a UUID or slug and defaults to `production`.

## Agent-ready application provisioning

Create a SaaS OAuth client and write its one-time credentials directly into the application's ignored environment file:

```bash
authometry apps create \
  --name "Customer Portal" \
  --type web \
  --redirect-uri https://app.example.com/auth/callback \
  --post-logout-redirect-uri https://app.example.com/ \
  --scope openid \
  --scope profile \
  --scope email \
  --scope offline_access \
  --output-env .env.local \
  --json
```

The command returns the selected environment's issuer with the generated client ID. Confidential `web` and `machine` applications also receive a one-time client secret. With `--output-env`, the secret is written with mode `0600` and omitted from JSON output. Existing Authometry assignments are preserved unless `--overwrite-env` is explicit.

## Workflow

```bash
authometry init --directory authometry
authometry validate --directory authometry
authometry plan --directory authometry
authometry diff --directory authometry
authometry apply --directory authometry
authometry status
authometry export --directory authometry-export
```

- `init` creates an instance and starter application without overwriting existing files.
- `validate` parses every `.yaml` and `.yml` file recursively and checks cross-resource references without contacting a server.
- `plan` reports create, update, delete, and unchanged operations.
- `diff` also prints complete before/after YAML for updated resources.
- `apply` resolves secret references locally, asks for confirmation, and performs the plan in one transaction under an advisory lock.
- `status` compares current state with the latest applied snapshot.
- `export` writes dashboard resources as YAML with exclusive file creation.

Resources present remotely but absent from the desired directory are planned for deletion. Review every plan, especially in automation.

## Document structure

Every file contains one resource:

```yaml
apiVersion: authometry.dev/v1alpha1
kind: Application
metadata:
  name: customer-portal
spec: {}
```

`metadata.name` is a lowercase slug. Supported kinds are `AuthometryInstance`, `Application`, `Scope`, `Policy`, and `ClaimMapping`.

## AuthometryInstance

One instance document controls environment-wide protocol defaults:

```yaml
apiVersion: authometry.dev/v1alpha1
kind: AuthometryInstance
metadata:
  name: primary
spec:
  issuer: https://authometry.ch3n.cc
  defaultTokenLifetimes:
    accessToken: 15m
    refreshToken: 30d
  supportedSigningAlgorithms: [RS256]
  requireConsent: true
  sessionLifetime: 7d
```

`issuer` must be HTTPS. `sessionLifetime` accepts minutes, hours, or days. The current runtime signs with RS256 even though the schema reserves ES256 for future compatibility; configure RS256 for deployed environments.

## Application

```yaml
apiVersion: authometry.dev/v1alpha1
kind: Application
metadata:
  name: customer-portal
spec:
  displayName: Customer portal
  description: Customer account access
  type: web
  redirectUris:
    - https://portal.example.com/auth/callback
  postLogoutRedirectUris:
    - https://portal.example.com/
  grantTypes: [authorization_code, refresh_token]
  responseTypes: [code]
  scopes: [openid, profile, email, offline_access]
  security:
    requirePkce: true
    requireConsent: true
    rotateRefreshTokens: true
  tokens:
    accessTokenLifetime: 15m
    refreshTokenLifetime: 30d
    authorizationCodeLifetime: 60s
  tokenEndpointAuthMethod: client_secret_basic
  credentials:
    clientSecret:
      valueFrom:
        environment:
          name: CUSTOMER_PORTAL_CLIENT_SECRET
```

| Field                          | Rules                                                            |
| ------------------------------ | ---------------------------------------------------------------- |
| `type`                         | `web`, `spa`, `native`, `machine`, or `device`.                  |
| `clientId`                     | Optional stable client ID; otherwise the server supplies one.    |
| `redirectUris`                 | Up to 25 exact absolute callback URIs.                           |
| `postLogoutRedirectUris`       | Up to 25 exact logout callback URIs.                             |
| `grantTypes`                   | One or more supported grant identifiers.                         |
| `responseTypes`                | Defaults to `[code]`; deployed v1 supports only `code`.          |
| `scopes`                       | Built-in or declared `Scope` values.                             |
| `security.rotateRefreshTokens` | Must be `true`.                                                  |
| token lifetimes                | Integer plus `s`, `m`, `h`, or `d`; code lifetime excludes days. |
| `tokenEndpointAuthMethod`      | `none`, `client_secret_basic`, or `client_secret_post`.          |

### Secret references

Read a value from the apply process environment:

```yaml
credentials:
  clientSecret:
    valueFrom:
      environment:
        name: CUSTOMER_PORTAL_CLIENT_SECRET
```

Or read it from a file:

```yaml
credentials:
  clientSecret:
    valueFrom:
      file:
        path: .secrets/customer-portal
```

File paths resolve in the CLI process. Keep secret files outside version control. The raw value is sent over HTTPS only during apply, hashed by the server, and omitted when comparing or exporting manifests.

## Scope

```yaml
apiVersion: authometry.dev/v1alpha1
kind: Scope
metadata:
  name: invoices-read
spec:
  value: invoices:read
  displayName: Read invoices
  description: Read invoice records through the API.
  consentDescription: View your invoices
  sensitivity: sensitive
```

Sensitivity is `standard`, `sensitive`, or `restricted`. Applications can reference built-in scopes (`openid`, `profile`, `email`, `phone`, `address`, and `offline_access`) without declaring them.

## Policy

```yaml
apiVersion: authometry.dev/v1alpha1
kind: Policy
metadata:
  name: employees-only
spec:
  displayName: Employees only
  description: Allow members of the employees group.
  enabled: true
  applications: [customer-portal]
  match:
    all:
      - field: user.groups
        operator: contains
        value: employees
  decision:
    allow: true
  otherwise:
    deny:
      code: access_denied
      message: An employee account is required.
```

`applications` references Application metadata names. Conditions support `equals`, `not_equals`, `contains`, and `in`; values may be strings, string arrays, booleans, or numbers. At least one condition is required.

## ClaimMapping

```yaml
apiVersion: authometry.dev/v1alpha1
kind: ClaimMapping
metadata:
  name: organization-id
spec:
  source:
    field: user.custom_claims.organization.id
  target:
    claim: organization_id
  includeIn: [access_token, id_token, userinfo]
```

Standard sources include `user.id`, `user.email`, `user.name`, `user.groups`, and `user.email_verified`. Nested custom claims use the `user.custom_claims.` prefix. Protocol claims such as `iss`, `sub`, `aud`, `exp`, `nonce`, `scope`, and `client_id` are reserved and cannot be overwritten.

## Ownership and drift

Applying a resource sets manifest ownership and records its source path. Manifest-owned fields are not editable from the dashboard. Dashboard-owned resources remain usable and can be exported before moving them into Git.

`status` compares normalized current manifests with the latest successful apply snapshot:

- `not_applied` — the environment has no successful configuration deployment.
- `in_sync` — current normalized state matches the latest snapshot.
- `drifted` — at least one resource differs, is missing, or was added.

Application credentials are excluded from comparison because the server cannot recover hashed secrets.

## CI example

```yaml
- name: Validate Authometry configuration
  run: pnpm --filter @authometry/cli dev -- validate --directory authometry

- name: Apply Authometry configuration
  env:
    AUTHOMETRY_SERVER: ${{ vars.AUTHOMETRY_SERVER }}
    AUTHOMETRY_TOKEN: ${{ secrets.AUTHOMETRY_TOKEN }}
    AUTHOMETRY_ENVIRONMENT: production
    CUSTOMER_PORTAL_CLIENT_SECRET: ${{ secrets.CUSTOMER_PORTAL_CLIENT_SECRET }}
  run: >-
    pnpm --filter @authometry/cli dev -- apply
    --directory authometry
    --non-interactive
    --revision "$GITHUB_SHA"
    --repository "$GITHUB_REPOSITORY"
```

Protect the apply job with branch and environment approvals. Use a short-lived personal token where possible, pin the public server origin, and run `plan` on pull requests before allowing `apply` from the protected branch.
