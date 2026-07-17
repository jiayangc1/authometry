# Deployment and operations

Authometry ships a multi-stage Dockerfile with separate `web` and `server` runtime targets. A production installation also requires PostgreSQL and a reverse proxy or platform that exposes one HTTPS origin.

## Production topology

- Expose the `web` container on the public HTTPS origin.
- Keep the `server` container reachable by the web container but private from the internet when the platform permits it.
- Set the web build argument `INTERNAL_API_ORIGIN` to the server's internal URL.
- Give the server a persistent PostgreSQL database.
- Forward the original HTTPS host and protocol through the reverse proxy.

The protocol issuer is security-sensitive and must be stable. Do not place Authometry behind multiple public origins for the same environment.

## Build images

```bash
docker build --target web \
  --build-arg INTERNAL_API_ORIGIN=http://authometry-api:4000 \
  -t authometry-web .

docker build --target server -t authometry-server .
```

Both runtime images use Node.js 24 Alpine and run as non-root users. The web container listens on 3000; the server listens on 4000 by default.

## Environment variables

### Server runtime

| Variable                                   | Required in production | Purpose                                                                               |
| ------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------- |
| `NODE_ENV`                                 | Yes                    | Set to `production` to enable secure cookies and production validation.               |
| `PORT`                                     | No                     | API listen port; defaults to `4000`.                                                  |
| `PUBLIC_ORIGIN`                            | Yes                    | Public HTTPS web origin and default issuer base.                                      |
| `DATABASE_URL`                             | Yes                    | PostgreSQL connection string.                                                         |
| `COOKIE_SECRET`                            | Yes                    | Signs administrative cookies; minimum 32 characters.                                  |
| `CSRF_SECRET`                              | Yes                    | Signs CSRF values; minimum 32 characters.                                             |
| `ACCESS_TOKEN_SECRET`                      | Yes                    | Signs administrative access envelopes; minimum 32 characters.                         |
| `REFRESH_TOKEN_SECRET`                     | Yes                    | Signs administrative refresh envelopes; minimum 32 characters.                        |
| `INSTALLATION_ENCRYPTION_KEY`              | Yes                    | Root encryption material for private JWKs and webhook secrets; minimum 32 characters. |
| `TOKEN_HMAC_KEY`                           | Yes                    | Installation token hashing key; minimum 32 characters.                                |
| `BOOTSTRAP_TOKEN`                          | Yes                    | One-time bootstrap credential; minimum 16 characters.                                 |
| `BOOTSTRAP_TOKEN_EXPIRES_AT`               | Yes                    | Future ISO 8601 expiry; required when `NODE_ENV=production`.                          |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | No                     | Enable Google identity login when both are present.                                   |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | No                     | Enable GitHub identity login when both are present.                                   |
| `RESEND_API_KEY`                           | No                     | Enables outbound mail through Resend.                                                 |
| `RESEND_FROM`                              | No                     | Verified Resend sender identity; defaults to `Authometry <auth@cams.ch3n.cc>`.        |
| `SMTP_HOST`                                | No                     | Enables SMTP fallback when Resend is not configured.                                  |
| `SMTP_PORT`                                | No                     | SMTP port; defaults to `587`.                                                         |
| `SMTP_USER`, `SMTP_PASSWORD`               | No                     | Optional SMTP authentication.                                                         |
| `SMTP_FROM`                                | No                     | Sender identity.                                                                      |
| `SMTP_SECURE`                              | No                     | Set `true` for implicit TLS.                                                          |

When both providers are configured, Resend is used. Do not reuse secret values between variables. Store them in the deployment platform's secret manager, not in an image, Compose file, or repository.

### Web build and runtime

| Variable              | Stage   | Purpose                                            |
| --------------------- | ------- | -------------------------------------------------- |
| `INTERNAL_API_ORIGIN` | Build   | Private API origin compiled into Next.js rewrites. |
| `PORT`                | Runtime | Web listen port; the image defaults to `3000`.     |
| `NODE_ENV`            | Runtime | The image sets `production`.                       |

Changing `INTERNAL_API_ORIGIN` requires rebuilding the web image.

## Google and GitHub identity providers

Create one production web OAuth client per provider. For a deployment whose `PUBLIC_ORIGIN` is
`https://auth.example.com`, register these exact callback URLs:

- Google: `https://auth.example.com/api/v1/authorize/social/google/callback`
- GitHub: `https://auth.example.com/api/v1/authorize/social/github/callback`

Do not add paths, query strings, wildcards, or a trailing slash. Set the provider homepage to the
same `PUBLIC_ORIGIN`. Google branding should also use:

- Homepage: `https://auth.example.com/`
- Privacy policy: `https://auth.example.com/privacy`
- Terms of service: `https://auth.example.com/terms`
- Authorized domain: `auth.example.com` (and complete domain verification when requested)

Authometry requests only `openid email profile` from Google and `read:user user:email` from GitHub.
Keep the Google consent screen in testing until the branding, developer contact, authorized domain,
homepage, policy links, and exact production callback have been reviewed. Then publish the app and
complete any Google verification workflow shown for the project. Publishing removes the testing-user
limit; Google, not Authometry, decides whether branding or app verification is required.

Store the generated client secrets only in the deployment secret manager. Restart the API after
setting the four provider variables, then confirm `/api/v1/authorize/providers` reports both
providers as enabled.

## Database migrations

The API runs migrations before it starts accepting traffic. Each migration runs transactionally and applied filenames are recorded in `schema_migrations`. A PostgreSQL advisory lock prevents multiple starting replicas from applying migrations concurrently.

Before deploying a release:

1. Back up PostgreSQL.
2. Review new migration files and release notes.
3. Deploy the API and wait for readiness.
4. Deploy or restart the web service.
5. Run discovery and protocol smoke checks.

Do not edit an already-applied migration. Add a new numbered migration.

## Health and smoke checks

| Endpoint                            | Meaning                                                             |
| ----------------------------------- | ------------------------------------------------------------------- |
| `/health/live`                      | Process is serving HTTP; no database dependency.                    |
| `/health/ready`                     | API can execute a PostgreSQL query.                                 |
| `/.well-known/openid-configuration` | The default environment resolves and advertises protocol endpoints. |
| `/.well-known/jwks.json`            | Public active/retiring signing keys are available.                  |

Run the repository smoke plan against the public origin:

```bash
pnpm conformance -- https://auth.example.com
```

The script checks liveness, discovery metadata, supported grants, endpoint origins, and public JWKS metadata. It is not an OpenID Foundation certification run.

The repository also contains `scripts/production-verification.ts`, an invasive release verification that creates test applications and users and exercises complete protocol flows. Run it only against an environment where those mutations are approved.

## Backups

Back up the entire PostgreSQL database, not selected tables. Retain the exact `INSTALLATION_ENCRYPTION_KEY` separately: a database restore without the matching key cannot decrypt signing keys or webhook secrets.

A reasonable baseline is one complete backup daily at 03:00 UTC with the latest 14 successful copies retained. Adjust frequency and retention for your recovery objectives.

### Restore procedure

1. Put the environment into maintenance mode or stop both services.
2. Take a safety backup of the current database.
3. Restore the selected backup into the Authometry database.
4. Restore the matching installation encryption key and all signing/HMAC secrets.
5. Start the API and wait for `/health/ready`; newer migrations apply automatically.
6. Start the web service and verify discovery and JWKS.
7. Complete an Authorization Code with PKCE flow and inspect its trace.
8. If compromise is suspected, revoke restored sessions, refresh-token families, personal tokens, and credentials.

Never restore production data into a shared development database.

## Signing-key rotation

Owners and administrators can rotate an environment's signing key from Settings. Rotation creates a new active key and moves the previous key to a retiring state so already-issued JWTs remain verifiable through JWKS. Do not remove retiring public keys before the longest possible issued token has expired.

## Webhooks and retention

Pending webhooks are dispatched on API startup and every 30 seconds. Delivery responses are recorded with bounded response metadata. Retention runs on startup and hourly using the configured instance retention periods for traces, audit events, and webhook deliveries.

Monitor API logs for `webhook_worker` and `retention_worker` errors. A worker failure does not stop the HTTP server; correct the cause and the next interval will retry eligible work.

## Graceful shutdown

On `SIGTERM` or `SIGINT`, the API stops accepting connections, closes PostgreSQL after the HTTP server drains, and enforces a ten-second shutdown deadline. Configure the platform's termination grace period to exceed ten seconds.
