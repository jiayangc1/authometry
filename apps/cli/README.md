# Authometry CLI

Configuration-as-code CLI for [Authometry](https://github.com/jiayangc1/authometry).

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

Set the Authometry server, personal access token, and target environment before running remote commands:

```bash
export AUTHOMETRY_SERVER=https://auth.example.com
export AUTHOMETRY_TOKEN=amt_your_token
export AUTHOMETRY_ENVIRONMENT=production
```

See the [configuration documentation](https://github.com/jiayangc1/authometry/blob/main/docs/configuration.md) for manifests, commands, and CI examples.
