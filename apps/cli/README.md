# Authometry CLI

Provision and manage OAuth applications on [Authometry](https://authometry.ch3n.cc).

## Install with Homebrew

```bash
brew install jiayangc1/tap/authometry
```

## Run with a JavaScript package manager

```bash
npx authometry --help
```

Or install it globally:

```bash
npm install --global authometry
authometry --help
```

Other JavaScript package managers work too:

```bash
pnpm dlx authometry --help
yarn dlx authometry --help
bunx authometry --help
```

## Provision an OAuth application

Create an API token with application access, then set it for the CLI. Authometry Cloud is the default server and `production` is the default environment.

```bash
export AUTHOMETRY_TOKEN=amt_your_token

authometry apps create \
  --name "Customer Portal" \
  --type web \
  --redirect-uri https://app.example.com/auth/callback \
  --post-logout-redirect-uri https://app.example.com/ \
  --scope openid \
  --scope profile \
  --scope email \
  --output-env .env.local
```

The command creates the Authometry application and writes its issuer, application ID, client ID, and one-time client secret directly to the environment file with mode `0600`. It refuses to replace existing Authometry values unless `--overwrite-env` is passed. Use `--json` for machine-readable output.

Set `AUTHOMETRY_ENVIRONMENT` or pass `--environment` for a non-default Cloud environment. Set `AUTHOMETRY_SERVER` or pass `--server` only when targeting a self-hosted installation.

See the [configuration documentation](https://github.com/jiayangc1/authometry/blob/main/docs/configuration.md) for manifest, drift, and CI workflows.
